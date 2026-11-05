"""Holdings server: front desk, job board, event stream, cards, library.

Run:  python3 app.py            (http://127.0.0.1:8841, also serves ../ui-prototype)
Env:  HOLDINGS_RUNNER=simulated|sdk   HOLDINGS_TOKEN=<secret>   HOLDINGS_HOST  HOLDINGS_PORT
Binds to localhost by default. Set HOLDINGS_TOKEN before exposing it anywhere else.
"""
import json
import cost
import os
import re
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import hashlib
import hmac
from urllib.parse import quote, unquote, urlparse

from runner import AgentSDKRunner, SimulatedRunner
import backup
import render
from store import Store
from urllib.parse import parse_qs

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
USER = os.environ.get("HOLDINGS_USER", "")
PW_HASH = os.environ.get("HOLDINGS_PW_HASH", "")
fails = {}


def check_login(user, password):
    try:
        _, it, salt, h = PW_HASH.split("$")
        got = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(it)).hex()
    except ValueError:
        return False
    return hmac.compare_digest(user, USER) & hmac.compare_digest(got, h)


def make_session(user):
    exp = str(int(time.time()) + 30 * 86400)
    sig = hmac.new(TOKEN.encode(), f"{user}|{exp}".encode(), "sha256").hexdigest()
    return f"{user}|{exp}|{sig}"


def valid_session(v):
    try:
        user, exp, sig = v.rsplit("|", 2)
    except ValueError:
        return False
    good = hmac.new(TOKEN.encode(), f"{user}|{exp}".encode(), "sha256").hexdigest()
    return hmac.compare_digest(sig, good) and int(exp) > time.time() and hmac.compare_digest(user, USER)
FORMATS = {"Excel", "PowerPoint", "Word", "PDF", "JPEG", "Markdown"}

charters = {}
for f in (ROOT / "charters").glob("*.json"):
    if f.name != "schema.json":
        c = json.loads(f.read_text())
        charters[c["id"]] = c

DATA = Path(os.environ.get("HOLDINGS_DATA") or HERE / "data")
DATA.mkdir(parents=True, exist_ok=True)
store = Store(DATA / "holdings.db")
EDITABLE = ("summary", "notes", "owns")
for e in store.rows("SELECT charter, patch FROM charter_edits WHERE id IN (SELECT MAX(id) FROM charter_edits GROUP BY charter)"):
    if e["charter"] in charters:
        charters[e["charter"]].update(json.loads(e["patch"]))
runner = AgentSDKRunner(store, charters, ROOT) if os.environ.get("HOLDINGS_RUNNER") == "sdk" else SimulatedRunner(store, charters)


BACKUP_DIRS = [os.environ.get("HOLDINGS_BACKUP_DIR") or str(DATA / "backups")] + ([os.environ["HOLDINGS_BACKUP_DIR2"]] if os.environ.get("HOLDINGS_BACKUP_DIR2") else [])
last_backup = {}


def do_backup(reason="manual"):
    r = backup.run_backup(DATA, DATA / "holdings.db", BACKUP_DIRS)
    last_backup.clear()
    last_backup.update(r)
    store.event("backup", f"Backup saved ({reason}): {r['files']} files, {len(r['locations'])} location(s)")
    return r


def approved(firm):
    r = store.one("SELECT decision FROM charter_reviews WHERE charter=? ORDER BY id DESC LIMIT 1", (firm,))
    return bool(r) and r["decision"] == "approved"


def route_firm(text, requested):
    if requested and (requested in charters or requested == "plenary"):
        return requested
    t = text.lower()
    rules = [(r"plenar|joint assessment|take this to plenary|across .{2,30} and ", "plenary"), (r"contract|clause|indemn|legal|law", "ogc-dg"), (r"joint venture|\bjv\b|alliance|partnership", "alliance-house"),
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
        if ctype in ("text/html", "text/javascript", "text/css"):
            self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def authed(self):
        if not TOKEN:
            return True
        got = self.headers.get("Authorization", "")
        if got.startswith("Bearer ") and hmac.compare_digest(got[7:], TOKEN):
            return True
        m = re.search(r"(?:^|;\s*)holdings_session=([^;]+)", self.headers.get("Cookie", ""))
        return bool(m) and valid_session(unquote(m.group(1)))

    def login_page(self, err=""):
        html = ("<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'><title>GTMN Holdings</title>"
                "<body style='font:16px system-ui;background:#f5f2ec;display:grid;place-items:center;height:100vh;margin:0'>"
                "<form method=post action=/login style='background:#fff;padding:32px;border-radius:12px;width:min(340px,90vw);box-shadow:0 2px 12px #0002'>"
                "<h2 style='margin:0 0 4px'>GTMN Holdings</h2><p style='margin:0 0 16px;color:#666'>Sign in.</p>"
                "<input name=user placeholder=Username autocomplete=username autofocus required style='width:100%;padding:10px;box-sizing:border-box;border:1px solid #bbb;border-radius:8px;margin-bottom:8px'>"
                "<input type=password name=password placeholder=Password autocomplete=current-password required style='width:100%;padding:10px;box-sizing:border-box;border:1px solid #bbb;border-radius:8px'>"
                f"<p style='color:#b00;min-height:1.2em'>{err}</p><button style='width:100%;padding:10px;border:0;border-radius:8px;background:#1a1a1a;color:#fff'>Open</button></form>")
        self.send(200, html.encode(), "text/html; charset=utf-8")

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BODY:
            raise ValueError("body too large")
        return json.loads(self.rfile.read(n) or b"{}")

    def do_GET(self):
        p = urlparse(self.path).path
        if not p.startswith("/api/"):
            if not self.authed():
                return self.login_page()
            return self.static(p)
        if not self.authed():
            return self.send(401, {"error": "unauthorized"})
        if p == "/api/firms":
            return self.send(200, [{"id": c["id"], "name": c["name"], "accent": c.get("accent"), "agents": len(c["agents"]),
                                    "partners": c.get("senior_panel", []), "outputs": c.get("outputs", [])} for c in charters.values()])
        if p == "/api/charters":
            return self.send(200, store.rows("SELECT charter, decision, note, created FROM charter_reviews r WHERE id=(SELECT MAX(id) FROM charter_reviews WHERE charter=r.charter)"))
        if p == "/api/cost":
            st = cost.status(store)
            st["by_job"] = store.rows("SELECT job, ROUND(SUM(usd),4) AS usd FROM usage WHERE job IS NOT NULL GROUP BY job ORDER BY job DESC LIMIT 50")
            return self.send(200, st)
        if p == "/api/charter-edits":
            return self.send(200, {e["charter"]: {**json.loads(e["patch"]), "applied": e["applied"], "cannot": e["cannot"], "created": e["created"]}
                                   for e in store.rows("SELECT * FROM charter_edits WHERE id IN (SELECT MAX(id) FROM charter_edits GROUP BY charter)")})
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
        m = re.fullmatch(r"/api/docs/(\d+)/file", p)
        if m:
            return self.docfile(int(m[1]), parse_qs(urlparse(self.path).query))
        if p == "/api/backup":
            if not last_backup:
                found = sorted(Path(BACKUP_DIRS[0]).glob("holdings-*.zip"))
                if found:
                    last_backup.update({"name": found[-1].name, "at": found[-1].stat().st_mtime, "locations": BACKUP_DIRS})
            return self.send(200, {"last": last_backup or None, "locations": BACKUP_DIRS, "second": len(BACKUP_DIRS) > 1})
        if p == "/api/stream":
            return self.stream()
        self.send(404, {"error": "not found"})

    def do_POST(self):
        p = urlparse(self.path).path
        if p == "/login":
            raw = self.rfile.read(min(int(self.headers.get("Content-Length") or 0), 2000)).decode()
            q = parse_qs(raw)
            ip = self.headers.get("X-Forwarded-For", self.client_address[0]).split(",")[0].strip()
            now = time.time()
            fails[ip] = [x for x in fails.get(ip, []) if now - x < 600]
            if len(fails[ip]) >= 8:
                return self.send(429, {"error": "too many attempts, wait 10 minutes"})
            if TOKEN and check_login(q.get("user", [""])[0], q.get("password", [""])[0]):
                secure = "; Secure" if self.headers.get("X-Forwarded-Proto") == "https" else ""
                self.send_response(303)
                self.send_header("Set-Cookie", f"holdings_session={quote(make_session(q['user'][0]))}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000{secure}")
                self.send_header("Location", "/")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            fails[ip].append(now)
            return self.login_page("Wrong username or password.")
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
            firm = "plenary" if len([f for f in b.get("firms", []) if f in charters]) > 1 else route_firm(title, b.get("firm"))
            if firm in charters and not approved(firm):
                return self.send(409, {"error": "charter not approved", "firm": firm, "name": charters[firm]["name"]})
            picks = [f for f in b.get("firms", []) if f in charters] if firm == "plenary" else []
            if picks:
                if len(picks) < 2:
                    return self.send(400, {"error": "a plenary needs at least two firms"})
                for f in picks:
                    if not approved(f):
                        return self.send(409, {"error": "charter not approved", "firm": f, "name": charters[f]["name"]})
            jid = store.run("INSERT INTO jobs(title,firm,formats,design,created,granola) VALUES(?,?,?,?,?,?)",
                            (title, firm, json.dumps(fmts), b.get("design"), time.time(), 0 if b.get("granola") is False else 1))
            if picks:
                store.event("picks", "Rafael chose the firms: " + ", ".join(picks), jid, firm)
            store.event("routed", f"Front desk routed the demand to {firm}", jid, firm)
            runner.start(jid)
            return self.send(201, {"id": jid, "firm": firm})
        if p == "/api/backup":
            try:
                return self.send(200, do_backup())
            except Exception as e:
                return self.send(500, {"error": f"backup failed: {type(e).__name__}"})
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
        if p == "/api/cost":
            try:
                if "cap" in b:
                    v = float(b["cap"])
                    if not 0 <= v <= 100000:
                        raise ValueError
                    cost.put(store, "cap_usd", v)
                    cost.put(store, "extra_usd", 0)
                if "extend" in b:
                    v = float(b["extend"])
                    if not 0 < v <= 100000:
                        raise ValueError
                    st = cost.status(store)
                    cost.put(store, "extra_usd", st["extra"] + v)
                    cost.put(store, "extra_month", st["month"])
                if b.get("stop"):
                    cost.put(store, "stop_epoch", int(cost.get(store, "stop_epoch", 0)) + 1)
            except (TypeError, ValueError):
                return self.send(400, {"error": "bad amount"})
            store.event("cost", f"Cap now ${cost.status(store)['cap']:.0f}" + (" (stopped waiting runs)" if b.get("stop") else ""))
            return self.send(200, cost.status(store))
        if p == "/api/charters/apply-changes":
            if not hasattr(runner, "client"):
                return self.send(400, {"error": "needs the live Claude runner"})
            pending = store.rows("SELECT charter, note FROM charter_reviews r WHERE id=(SELECT MAX(id) FROM charter_reviews WHERE charter=r.charter) AND decision='changes' AND TRIM(note)<>''")
            out = []
            for r in pending:
                c = charters.get(r["charter"])
                if not c:
                    continue
                cur = {k: c.get(k) for k in EDITABLE}
                try:
                    txt = runner._say(
                        "You revise a firm's charter for Rafael, the principal. Reply with ONE JSON object only, no prose, with keys: "
                        "summary (string), notes (string), owns (array of strings), applied (one or two plain sentences saying what you changed), "
                        "cannot (plain sentence on any request you could not do because it needs the gates, seats, vetoes or outputs changed by a developer, else empty string). "
                        "Gates, vetoes, seats and outputs are enforced elsewhere: never pretend to change them in the notes; put such requests in cannot. Change only what the request asks. Keep every other word as it is. Never remove a safeguard or veto.",
                        f"Current charter fields:\n{json.dumps(cur)}\n\nRafael's requested changes:\n{r['note']}", max_tokens=1500, who="Charter desk")
                    j = json.loads(txt[txt.index("{"): txt.rindex("}") + 1])
                    patch = {k: j[k] for k in EDITABLE if k in j and type(j[k]) is type(cur[k] if cur[k] is not None else j[k])}
                except Exception as ex:
                    out.append({"charter": r["charter"], "error": str(ex)[:120]})
                    continue
                c.update(patch)
                now = time.time()
                store.run("INSERT INTO charter_edits(charter,patch,applied,cannot,request,created) VALUES(?,?,?,?,?,?)",
                          (r["charter"], json.dumps(patch), str(j.get("applied", ""))[:600], str(j.get("cannot", ""))[:600], r["note"], now))
                store.run("INSERT INTO charter_reviews(charter,decision,note,created) VALUES(?,?,?,?)", (r["charter"], "proposed", "", now))
                store.event("charter", f"Charter desk updated the {c['name']} charter from Rafael's requested changes", None, r["charter"])
                out.append({"charter": r["charter"], "applied": j.get("applied", ""), "cannot": j.get("cannot", "")})
            return self.send(200, {"results": out})
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

    def docfile(self, did, q):
        d = store.one("SELECT * FROM docs WHERE id=?", (did,))
        fmt = (q.get("format") or ["PDF"])[0]
        if d and fmt in ("text", "Markdown"):
            f = DATA / "vault" / f"job-{d['job']}" / (d.get("src") or "decision-memo.md")
            if not f.is_file():
                return self.send(404, {"error": "no source"})
            if fmt == "text":
                return self.send(200, f.read_bytes(), "text/plain; charset=utf-8")
            slug = re.sub(r"[^A-Za-z0-9]+", "-", d["name"]).strip("-")[:60] or "deliverable"
            body = f.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/markdown; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Content-Disposition", f'{"inline" if q.get("inline") else "attachment"}; filename="{slug}.md"')
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            return self.wfile.write(body)
        if not d or fmt not in render.BUILD:
            return self.send(404, {"error": "not found"})
        vault = DATA / "vault" / f"job-{d['job']}"
        src = vault / (d.get("src") or "decision-memo.md")
        if not src.is_file():
            return self.send(404, {"error": "no source file for this deliverable yet"})
        mime, ext = render.MIME[fmt]
        out = vault / f"{src.stem}.{ext}"
        if not out.is_file() or out.stat().st_mtime < src.stat().st_mtime:
            try:
                out.write_bytes(render.BUILD[fmt](d["name"], src.read_text()))
            except Exception as e:
                return self.send(500, {"error": f"render failed: {type(e).__name__}"})
        slug = re.sub(r"[^A-Za-z0-9]+", "-", d["name"]).strip("-")[:60] or "deliverable"
        body = out.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        disp = "inline" if q.get("inline") else "attachment"
        self.send_header("Content-Disposition", f'{disp}; filename="{slug}.{ext}"')
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def static(self, p):
        rel = "index.html" if p in ("", "/") else p.lstrip("/")
        f = (UI / rel).resolve()
        if UI.resolve() not in f.parents and f != UI.resolve() or not f.is_file():
            return self.send(404, {"error": "not found"})
        ct = {".html": "text/html", ".js": "text/javascript", ".css": "text/css"}.get(f.suffix, "application/octet-stream")
        self.send(200, f.read_bytes(), ct)


if __name__ == "__main__":
    host, port = os.environ.get("HOLDINGS_HOST", "127.0.0.1"), int(os.environ.get("PORT") or os.environ.get("HOLDINGS_PORT", "8841"))
    if host not in ("127.0.0.1", "localhost") and not TOKEN:
        raise SystemExit("Refusing to listen on a public address without HOLDINGS_TOKEN.")
    print(f"Holdings server on http://{host}:{port}  runner={type(runner).__name__}  firms={len(charters)}")
    backup.schedule(lambda: do_backup("nightly"), int(os.environ.get("HOLDINGS_BACKUP_HOUR", "2")))
    ThreadingHTTPServer((host, port), H).serve_forever()
