"""Runners execute a job for a firm. The server only talks to the Runner interface.

SimulatedRunner needs no API key and walks every job through its firm's stages, asks
a question card, and honours steering notes. AgentSDKRunner is the real one and is a
stub until the CTO firm is wired to the Claude Agent SDK.
"""
import json
import os
import threading
import time

GENERIC = ["Intake", "Research", "Drafting", "Review", "Delivery"]


def stages_for(charter):
    gates = [g["name"] for g in charter.get("gates", [])]
    return gates if len(gates) >= 3 else GENERIC


class Runner:
    def start(self, job_id): raise NotImplementedError
    def steer(self, job_id, text, files): raise NotImplementedError
    def card_answered(self, card_id): raise NotImplementedError


class SimulatedRunner(Runner):
    def __init__(self, store, charters, tick=2.0):
        self.s, self.charters, self.tick = store, charters, tick
        self.notes, self.waiting = {}, {}

    def start(self, job_id):
        threading.Thread(target=self._run, args=(job_id,), daemon=True).start()

    def steer(self, job_id, text, files):
        self.notes.setdefault(job_id, []).append(text)
        j = self.s.one("SELECT * FROM jobs WHERE id=?", (job_id,))
        self.s.event("steer", f"Desk read your note and adjusts from here: {text[:80]}", job_id, j["firm"])

    def card_answered(self, card_id):
        ev = self.waiting.get(card_id)
        if ev:
            ev.set()

    def _run(self, job_id):
        s = self.s
        j = s.one("SELECT * FROM jobs WHERE id=?", (job_id,))
        ch = self.charters.get(j["firm"], {})
        stages, firm = stages_for(ch), j["firm"]
        seats = [a["id"] for a in ch.get("agents", [])][:4] or ["desk"]
        s.run("UPDATE jobs SET status='working' WHERE id=?", (job_id,))
        s.event("start", f"{ch.get('name', firm)} picked up the demand", job_id, firm)
        for i, stage in enumerate(stages):
            s.run("UPDATE jobs SET stage=?, progress=? WHERE id=?", (i, i / len(stages), job_id))
            s.event("stage", f"{seats[i % len(seats)]} started: {stage}", job_id, firm, {"stage": stage})
            time.sleep(self.tick)
            if i == len(stages) // 2:
                if not self._ask(job_id, firm, stage):
                    return
            s.event("step", f"{seats[(i + 1) % len(seats)]} finished: {stage}", job_id, firm)
        s.run("UPDATE jobs SET status='done', progress=1 WHERE id=?", (job_id,))
        fmts = json.loads(j["formats"])
        s.run("INSERT INTO docs(job,name,kind,by,formats,created) VALUES(?,?,?,?,?,?)",
              (job_id, f"{j['title']}", "Report", seats[0], j["formats"], time.time()))
        s.event("done", "All steps finished. The deliverable is in the Library.", job_id, firm)
        if not fmts:
            self._ask_formats(job_id, firm)

    def _ask(self, job_id, firm, stage):
        payload = {"kind": "one", "q": f"{stage} is ready for a direction. Which way should we go?",
                   "opts": [["Recommended path", "The safer option.", 1], ["Alternative", "Faster, with more risk."]],
                   "why": "The next steps depend on this choice.", "def": "Nothing moves until you answer."}
        cid = self.s.run("INSERT INTO cards(job,firm,payload,created) VALUES(?,?,?,?)", (job_id, firm, json.dumps(payload), time.time()))
        self.s.run("UPDATE jobs SET status='asking' WHERE id=?", (job_id,))
        self.s.event("card", payload["q"], job_id, firm, {"card": cid})
        ev = self.waiting[cid] = threading.Event()
        ev.wait()
        self.s.run("UPDATE jobs SET status='working' WHERE id=?", (job_id,))
        return True

    def _ask_formats(self, job_id, firm):
        payload = {"kind": "many", "q": "Which formats do you want for this deliverable?",
                   "opts": [["Excel", "", 0], ["PowerPoint", "", 0], ["Word", "", 0], ["PDF", "", 1], ["JPEG", "", 0]],
                   "why": "Each format is built for its purpose.", "def": "PDF if you don't answer."}
        cid = self.s.run("INSERT INTO cards(job,firm,payload,created) VALUES(?,?,?,?)", (job_id, firm, json.dumps(payload), time.time()))
        self.s.event("card", payload["q"], job_id, firm, {"card": cid})


class AgentSDKRunner(Runner):
    """Real execution through the Claude API. The CTO firm runs for real; other firms
    fall back to the simulated runner until their personas are wired.

    Flow: each seat gets only the mandate (blind, in parallel), the desk reads the three
    positions and asks Rafael one decision card, then writes the memo with his answer and
    any steering notes. The memo is saved in data/vault/<job>/.
    """
    REAL = {"gtmn-cto"}
    SEAT_NAMES = {"cto-majors": "Charity Majors", "cto-willison": "Simon Willison", "cto-larson": "Will Larson"}

    def __init__(self, store, charters, root):
        import anthropic
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise RuntimeError("ANTHROPIC_API_KEY is not set. Put it in server/.env")
        self.client = anthropic.Anthropic(max_retries=3, timeout=240)
        self.model = os.environ.get("HOLDINGS_MODEL", "claude-sonnet-4-5")
        self.s, self.charters, self.root = store, charters, root
        self.sim = SimulatedRunner(store, charters)
        self.notes, self.waiting = {}, {}

    def _real(self, job_id):
        j = self.s.one("SELECT firm FROM jobs WHERE id=?", (job_id,))
        return j and j["firm"] in self.REAL

    def start(self, job_id):
        if self._real(job_id):
            threading.Thread(target=self._run, args=(job_id,), daemon=True).start()
        else:
            self.sim.start(job_id)

    def steer(self, job_id, text, files):
        if not self._real(job_id):
            return self.sim.steer(job_id, text, files)
        self.notes.setdefault(job_id, []).append(text)
        j = self.s.one("SELECT firm FROM jobs WHERE id=?", (job_id,))
        self.s.event("steer", f"Desk will apply your note at the next step: {text[:80]}", job_id, j["firm"])

    def card_answered(self, card_id):
        ev = self.waiting.get(card_id)
        if ev:
            ev.set()
        else:
            self.sim.card_answered(card_id)

    def _persona(self, seat):
        txt = (self.root / "firms" / "gtmn-cto" / "agents" / f"{seat}.md").read_text()
        if txt.startswith("---"):
            txt = txt.split("---", 2)[2]
        return txt.strip() + "\n\nYou work for GTMN Holdings. Answer in plain prose under 450 words. You see only the mandate below."

    TOOLS = [{"type": "web_search_20250305", "name": "web_search", "max_uses": 5},
             {"type": "web_fetch_20250910", "name": "web_fetch", "max_uses": 4},
             {"type": "code_execution_20250522", "name": "code_execution"}]

    def _say(self, system, user, max_tokens=1800, tools=False, sources=None, job_id=None, who=""):
        msgs = [{"role": "user", "content": user}]
        for _ in range(6):
            kw = {"tools": self.TOOLS} if tools else {}
            r = self.client.beta.messages.create(model=self.model, max_tokens=max_tokens, system=system,
                                                 messages=msgs, betas=["web-fetch-2025-09-10", "code-execution-2025-05-22"], **kw)
            for b in r.content:
                if b.type == "server_tool_use" and job_id:
                    arg = b.input.get("query") or b.input.get("url") or (b.input.get("code") or "").strip().splitlines()[0:1] and b.input["code"].strip().splitlines()[0] or ""
                    self.s.event("tool", f"{who} used {b.name}: {str(arg)[:90]}", job_id, "gtmn-cto")
                if sources is not None:
                    if b.type == "web_search_tool_result" and isinstance(b.content, list):
                        sources.update({x.url: x.title for x in b.content if getattr(x, "url", None)})
                    elif b.type == "web_fetch_tool_result":
                        u = getattr(b.content, "url", None)
                        if u:
                            sources[u] = u
            if r.stop_reason != "pause_turn":
                break
            msgs = [msgs[0], {"role": "assistant", "content": r.content}]
        return "".join(b.text for b in r.content if b.type == "text").strip()

    def _stage(self, job_id, firm, i, n, label):
        self.s.run("UPDATE jobs SET stage=?, progress=? WHERE id=?", (i, i / n, job_id))
        self.s.event("stage", label, job_id, firm)

    def _run(self, job_id):
        s = self.s
        j = s.one("SELECT * FROM jobs WHERE id=?", (job_id,))
        firm, title = j["firm"], j["title"]
        try:
            s.run("UPDATE jobs SET status='working' WHERE id=?", (job_id,))
            s.event("start", "Office of the CTO picked up the demand", job_id, firm)
            self._stage(job_id, firm, 0, 4, "Desk framed the mandate; seats start blind")
            seats = list(self.SEAT_NAMES)
            sources = {}
            out = {}

            def work(seat):
                out[seat] = self._say(self._persona(seat) + "\nUse web_search and web_fetch to check facts you rely on, and code_execution (a sandbox) to compute any number you cite instead of estimating it. Cite sources by name and URL, and mark anything you could not verify as UNVERIFIED.",
                                      f"Mandate: {title}\n\nGive your independent position: verdict, the 3 things that matter most from your lane, and what would change your mind.",
                                      2500, True, sources, job_id, self.SEAT_NAMES[seat])
                s.event("step", f"{self.SEAT_NAMES[seat]} filed a blind position", job_id, firm)
            ts = [threading.Thread(target=work, args=(x,)) for x in seats]
            [t.start() for t in ts]
            [t.join() for t in ts]
            self._stage(job_id, firm, 1, 4, "All three positions filed; desk is comparing them")
            positions = "\n\n".join(f"### {self.SEAT_NAMES[k]}\n{v}" for k, v in out.items())
            raw = self._say("You are the orchestrating desk of the Office of the CTO. Reply with JSON only.",
                            f"Mandate: {title}\n\nBlind positions:\n{positions}\n\nFind the single decision where the seats pull apart or that only Rafael can make. Return JSON: {{\"q\": question, \"why\": one sentence, \"opts\": [[label, one-line consequence, 1 for recommended or omit], ...2-3 options]}}", 700)
            try:
                card = json.loads(raw[raw.index("{"):raw.rindex("}") + 1])
                payload = {"kind": "one", "q": card["q"], "opts": card["opts"], "why": card.get("why", ""), "def": "Nothing moves until you answer."}
            except Exception:
                payload = {"kind": "one", "q": "Which direction should the memo recommend?", "opts": [["Follow the majority", "", 1], ["Keep the dissent visible"]], "why": "The seats differ.", "def": "Nothing moves until you answer."}
            cid = s.run("INSERT INTO cards(job,firm,payload,created) VALUES(?,?,?,?)", (job_id, firm, json.dumps(payload), time.time()))
            s.run("UPDATE jobs SET status='asking' WHERE id=?", (job_id,))
            s.event("card", payload["q"], job_id, firm, {"card": cid})
            ev = self.waiting[cid] = threading.Event()
            ev.wait()
            answer = (s.one("SELECT answer FROM cards WHERE id=?", (cid,)) or {}).get("answer") or ""
            s.run("UPDATE jobs SET status='working' WHERE id=?", (job_id,))
            self._stage(job_id, firm, 2, 4, "Desk is writing the decision memo")
            steer = "\n".join(self.notes.get(job_id, []))
            memo = self._say("You are the orchestrating desk of the Office of the CTO at GTMN Holdings. Write a decision memo in a senior consulting partner's register: answer first, then reasoning, preserved dissent, risks, next steps. Markdown, under 900 words.",
                             f"Mandate: {title}\n\nBlind positions:\n{positions}\n\nRafael's decision: {answer}\n\nRafael's steering notes (apply them): {steer or 'none'}", 2600)
            self._stage(job_id, firm, 3, 5, "Verifier is checking every claim in the memo")
            ver = self._say("You are the independent verifier for the Office of the CTO. You did not write this memo. Check its factual claims (names, dates, numbers, quotes, product capabilities) using web_search and web_fetch. Output markdown: a table | Claim | Verdict (VERIFIED / UNVERIFIED / CONTRADICTED) | Evidence and URL |, then a one-line overall verdict: PASS, PASS WITH FLAGS, or FAIL. Do not soften a CONTRADICTED claim.",
                            f"Memo to verify:\n\n{memo}\n\nSources the authors already consulted:\n" + "\n".join(f"- {v} {k}" for k, v in sources.items()),
                            3000, True, sources, job_id, "Verifier")
            verdict = "FAIL" if "FAIL" in ver.split("verdict")[-1].upper()[:80] else ("PASS WITH FLAGS" if "FLAGS" in ver.upper()[-300:] else "PASS")
            s.event("verify", f"Verification result: {verdict}", job_id, firm)
            vault = self.root / "server" / "data" / "vault" / f"job-{job_id}"
            vault.mkdir(parents=True, exist_ok=True)
            (vault / "decision-memo.md").write_text(f"# {title}\n\n{memo}\n\n---\n## Blind positions\n\n{positions}\n\n---\n## Verification ({verdict})\n\n{ver}\n\n## Sources consulted\n\n" + "\n".join(f"- {v}: {k}" for k, v in sources.items()) + "\n")
            fmts = j["formats"]
            s.run("UPDATE jobs SET status='done', progress=1, stage=3 WHERE id=?", (job_id,))
            s.run("INSERT INTO docs(job,name,kind,by,formats,created) VALUES(?,?,?,?,?,?)", (job_id, title, "Decision memo (verified: " + verdict + ")", "cto-desk", fmts, time.time()))
            s.event("done", "Memo is in the vault and the Library.", job_id, firm)
            if not json.loads(fmts):
                self.sim._ask_formats(job_id, firm)
        except Exception as e:
            s.run("UPDATE jobs SET status='waiting' WHERE id=?", (job_id,))
            s.event("error", f"Run stopped: {type(e).__name__}: {str(e)[:160]}", job_id, firm)
