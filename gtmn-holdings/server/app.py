"""Holdings server: front desk, job board, event stream, cards, library.

Run:  python3 app.py            (http://127.0.0.1:8841, also serves ../ui-prototype)
Env:  HOLDINGS_RUNNER=simulated|sdk   HOLDINGS_TOKEN=<secret>   HOLDINGS_HOST  HOLDINGS_PORT
Binds to localhost by default. Set HOLDINGS_TOKEN before exposing it anywhere else.
"""
import json
import os
import re
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from runner import AgentSDKRunner, SimulatedRunner
from store import Store

HERE = Path(__file__).parent
_env = HERE / ".env"
if _env.exists():
    for _l in _env.read_text().splitlines():
        if "=" in _l and not _l.lstrip().startswith("#"):
            _k, _v = _l.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip().strip("\"'"))
ROOT = HERE.parent
UI = ROOT / "ui-prototype"
TOKEN = os.environ.get("HOLDINGS_TOKEN", "")
MAX_BODY = 1_000_000
FORMATS = {"Excel", "PowerPoint", "Word", "PDF", "JPEG"}

charters = {}
for f in (ROOT / "charters").glob("*.json"):
    if f.name != "schema.json":
        c = json.loads(f.read_text())
        charters[c["id"]] = c

store = Store(HERE / "data" / "holdings.db")
runner = AgentSDKRunner(store, charters, ROOT) if os.environ.get("HOLDINGS_RUNNER") == "sdk" else SimulatedRunner(store, charters)


def approved(firm):
    r = store.one("SELECT decision FROM charter_reviews WHERE charter=? ORDER BY id DESC LIMIT 1", (firm,))
    return bool(r) and r["decision"] == "approved"


def route_firm(text, requested):
    if requested and (requested in charters or requested == "plenary"):
        return requested
    t = text.lower()
    rules = [(r"contract|clause|indemn|legal|law", "ogc-dg"), (r"joint venture|\bjv\b|alliance|partnership", "alliance-house"),
             (r"valuation|raise|m&a|acquir", "dg-ib"), (r"allocation|family office|portfolio", "cio-ic-memo"),
             (r"startup|venture|seed|series", "spc-deal-team"), (r"brand|marketing|campaign|logo", "marketing-house"),
             (r"business plan|go/no-go|unit economics", "plan-house"), (r"mca|noteholder|credit", "zencredit-firm"),
             (r"architecture|vendor|security|tech", "gtmn-cto")]
    for rx, fid in rules:
        if re.search(rx, t):
            return fid
    return "gtmn-cto"


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, code, obj, ctype="application/json"):
        body = obj if isinstance(obj, bytes) else json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def authed(self):
        return not TOKEN or self.headers.get("Authorization") == f"Bearer {TOKEN}"

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BODY:
            raise ValueError("body too large")
        return json.loads(self.rfile.read(n) or b"{}")

    def do_GET(self):
        p = urlparse(self.path).path
        if not p.startswith("/api/"):
            return self.static(p)
        if not self.authed():
            return self.send(401, {"error": "unauthorized"})
        if p == "/api/firms":
            return self.send(200, [{"id": c["id"], "name": c["name"], "accent": c.get("accent"), "agents": len(c["agents"]),
                                    "partners": c.get("senior_panel", []), "outputs": c.get("outputs", [])} for c in charters.values()])
        if p == "/api/charters":
            return self.send(200, store.rows("SELECT charter, decision, note, created FROM charter_reviews r WHERE id=(SELECT MAX(id) FROM charter_reviews WHERE charter=r.charter)"))
        if p == "/api/jobs":
            return self.send(200, store.rows("SELECT * FROM jobs ORDER BY id DESC"))
        m = re.fullmatch(r"/api/jobs/(\d+)", p)
        if m:
            j = store.one("SELECT * FROM jobs WHERE id=?", (m[1],))
            if not j:
                return self.send(404, {"error": "not found"})
            j["events"] = store.rows("SELECT * FROM events WHERE job=? ORDER BY id", (m[1],))
            j["docs"] = store.rows("SELECT * FROM docs WHERE job=?", (m[1],))
            return self.send(200, j)
        if p == "/api/cards":
            cs = store.rows("SELECT * FROM cards WHERE state='open' ORDER BY id")
            for c in cs:
                c["payload"] = json.loads(c["payload"])
            return self.send(200, cs)
        if p == "/api/library":
            return self.send(200, {"docs": store.rows("SELECT * FROM docs ORDER BY id DESC"),
                                   "design_systems": store.rows("SELECT * FROM design_systems ORDER BY id")})
        if p == "/api/stream":
            return self.stream()
        self.send(404, {"error": "not found"})

    def do_POST(self):
        p = urlparse(self.path).path
        if not self.authed():
            return self.send(401, {"error": "unauthorized"})
        try:
            b = self.body()
        except (ValueError, json.JSONDecodeError):
            return self.send(400, {"error": "bad body"})
        if p == "/api/jobs":
            title = str(b.get("title", "")).strip()[:300]
            if not title:
                return self.send(400, {"error": "title required"})
            fmts = [f for f in b.get("formats", []) if f in FORMATS]
            firm = route_firm(title, b.get("firm"))
            if firm in charters and not approved(firm):
                return self.send(409, {"error": "charter not approved", "firm": firm, "name": charters[firm]["name"]})
            jid = store.run("INSERT INTO jobs(title,firm,formats,design,created) VALUES(?,?,?,?,?)",
                            (title, firm, json.dumps(fmts), b.get("design"), time.time()))
            store.event("routed", f"Front desk routed the demand to {firm}", jid, firm)
            runner.start(jid)
            return self.send(201, {"id": jid, "firm": firm})
        m = re.fullmatch(r"/api/jobs/(\d+)/steer", p)
        if m:
            text = str(b.get("text", "")).strip()[:2000]
            if not store.one("SELECT 1 FROM jobs WHERE id=?", (m[1],)):
                return self.send(404, {"error": "not found"})
            if text:
                runner.steer(int(m[1]), text, b.get("files", []))
            return self.send(202, {"ok": True})
        m = re.fullmatch(r"/api/cards/(\d+)/answer", p)
        if m:
            c = store.one("SELECT * FROM cards WHERE id=? AND state='open'", (m[1],))
            if not c:
                return self.send(404, {"error": "no open card"})
            store.run("UPDATE cards SET answer=?, state='answered' WHERE id=?", (str(b.get("answer", ""))[:2000], m[1]))
            payload = json.loads(c["payload"])
            if payload.get("q", "").startswith("Which formats"):
                got = [f for f in sorted(FORMATS) if f in str(b.get("answer", ""))]
                store.run("UPDATE docs SET formats=? WHERE job=?", (json.dumps(got or ["PDF"]), c["job"]))
            store.event("answer", "Rafael answered a card", c["job"], c["firm"])
            runner.card_answered(int(m[1]))
            return self.send(200, {"ok": True})
        m = re.fullmatch(r"/api/charters/([a-z0-9-]+)/review", p)
        if m:
            d = b.get("decision")
            if m[1] not in charters or d not in ("approved", "changes"):
                return self.send(400, {"error": "bad charter or decision"})
            store.run("INSERT INTO charter_reviews(charter,decision,note,created) VALUES(?,?,?,?)",
                      (m[1], d, str(b.get("note", ""))[:2000], time.time()))
            store.event("charter", f"Rafael {'approved' if d == 'approved' else 'requested changes to'} the {charters[m[1]]['name']} charter", None, m[1])
            return self.send(200, {"ok": True})
        if p == "/api/design-systems":
            name = str(b.get("name", "")).strip()[:120]
            url = str(b.get("url", "")).strip()
            if not name or (url and not url.startswith("https://")):
                return self.send(400, {"error": "name and https url required"})
            store.run("INSERT INTO design_systems(name,kind,url,created) VALUES(?,?,?,?)", (name, "link" if url else "file", url or None, time.time()))
            return self.send(201, {"ok": True})
        self.send(404, {"error": "not found"})

    def stream(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        last = int(self.headers.get("Last-Event-ID") or 0)
        try:
            while True:
                for e in store.events_after(last):
                    last = e["id"]
                    self.wfile.write(f"id: {last}\ndata: {json.dumps(e)}\n\n".encode())
                self.wfile.flush()
                time.sleep(1)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def static(self, p):
        rel = "index.html" if p in ("", "/") else p.lstrip("/")
        f = (UI / rel).resolve()
        if UI.resolve() not in f.parents and f != UI.resolve() or not f.is_file():
            return self.send(404, {"error": "not found"})
        ct = {".html": "text/html", ".js": "text/javascript", ".css": "text/css"}.get(f.suffix, "application/octet-stream")
        self.send(200, f.read_bytes(), ct)


if __name__ == "__main__":
    host, port = os.environ.get("HOLDINGS_HOST", "127.0.0.1"), int(os.environ.get("HOLDINGS_PORT", "8841"))
    print(f"Holdings server on http://{host}:{port}  runner={type(runner).__name__}  firms={len(charters)}")
    ThreadingHTTPServer((host, port), H).serve_forever()
