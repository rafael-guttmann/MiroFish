"""Runners execute a job for a firm. The server only talks to the Runner interface.

SimulatedRunner needs no API key and walks every job through its firm's stages, asks
a question card, and honours steering notes. AgentSDKRunner is the real one and is a
stub until the CTO firm is wired to the Claude Agent SDK.
"""
import json
import re
from pathlib import Path
import os
import cost
import granola
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
        self.s.run("INSERT INTO messages(job,role,text,created) VALUES(?,?,?,?)", (job_id, "me", text, time.time()))
        self.s.run("INSERT INTO messages(job,role,text,created) VALUES(?,?,?,?)", (job_id, "desk", "Noted. This firm is still a simulation, so I will adjust from the next step but cannot rewrite real files.", time.time()))
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
                   "opts": [["Excel", "", 0], ["PowerPoint", "", 0], ["Word", "", 0], ["PDF", "", 1], ["JPEG", "", 0], ["Markdown", "", 0]],
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
    REAL = {"gtmn-cto", "plenary"}
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
        return bool(j) and (j["firm"] in self.REAL or (j["firm"] == "dani" or j["firm"] in self.charters and (self.root / "firms" / j["firm"] / "agents").is_dir()))

    def start(self, job_id):
        if self._real(job_id):
            j = self.s.one("SELECT firm FROM jobs WHERE id=?", (job_id,))
            if j["firm"] == "dani":
                threading.Thread(target=self._run_dani, args=(job_id,), daemon=True).start()
            elif j["firm"] != "gtmn-cto":
                import plenary
                threading.Thread(target=plenary.run, args=(self, job_id), daemon=True).start()
            else:
                threading.Thread(target=self._run, args=(job_id,), daemon=True).start()
        else:
            self.sim.start(job_id)

    def steer(self, job_id, text, files):
        if not self._real(job_id):
            return self.sim.steer(job_id, text, files)
        self.notes.setdefault(job_id, []).append(text)
        j = self.s.one("SELECT firm FROM jobs WHERE id=?", (job_id,))
        self.s.run("INSERT INTO messages(job,role,text,created) VALUES(?,?,?,?)", (job_id, "me", text, time.time()))
        self.s.event("steer", f"Desk will apply your note at the next step: {text[:80]}", job_id, j["firm"])
        threading.Thread(target=self._steer_reply, args=(job_id, text), daemon=True).start()

    _revlock = threading.Lock()
    FMT_WORDS = {"Excel": r"excel|spreadsheet", "PowerPoint": r"power ?point|\bppt\b|\bdeck\b", "Word": r"\bword\b|docx", "PDF": r"\bpdf\b", "JPEG": r"jpe?g|image", "Markdown": r"markdown"}

    def _steer_reply(self, job_id, text):
        """The desk answers Rafael's note. While the run is open, the note is queued for the memo step.
        Once the run is done, the desk writes a revised version and keeps the earlier one."""
        s = self.s
        say = lambda m: s.run("INSERT INTO messages(job,role,text,created) VALUES(?,?,?,?)", (job_id, "desk", m, time.time()))
        try:
            j = s.one("SELECT * FROM jobs WHERE id=?", (job_id,))
            firm = self.charters.get(j["firm"], {}).get("name", j["firm"]) if j["firm"] != "plenary" else "Plenary"
            vault = Path(os.environ.get("HOLDINGS_DATA") or self.root / "server" / "data") / "vault" / f"job-{job_id}"
            src = vault / "decision-memo.md"
            if j["status"] != "done" or not src.is_file():
                say(self._say(f"You are the {firm} desk at GTMN Holdings, replying to Rafael in the steering thread of a run still in progress. "
                              "Reply in under 50 words, plain, first person. Say what you will change when the memo is written. Do not invent facts.",
                              f"Mandate: {j['title']}\nRun status: {j['status']}\nRafael's note: {text}", 300, job_id=job_id, who=f"{firm} desk").strip())
                return
            with self._revlock:
                s.run("UPDATE jobs SET status='working' WHERE id=?", (job_id,))
                s.event("steer", f"{firm} desk is revising the memo from your note", job_id, j["firm"])
                last = s.one("SELECT src FROM docs WHERE job=? AND src LIKE 'revision-%' ORDER BY version DESC LIMIT 1", (job_id,))
                raw = (vault / last["src"]).read_text() if last and (vault / last["src"]).is_file() else src.read_text()
                body = raw.split("\n\n---\n")[0]
                body = body.split("\n\n", 1)[1] if body.startswith("# ") and "\n\n" in body else body
                rev = self._say(f"You are the {firm} desk at GTMN Holdings revising a verified decision memo because Rafael asked for a change. "
                                "Apply his note. Keep everything he did not ask to change. Do not add new factual claims you cannot support from the memo itself; "
                                "if the note needs new facts, say so in a line marked 'Needs verification:'. Markdown, same register, answer first. Never mention attachments or file names: the system converts this text into Word, Excel, PDF or slides by itself, so if an Excel or deck is wanted, put the figures in markdown tables (and use '## ' headings for slides).",
                                f"Current memo:\n\n{body}\n\nRafael's note: {text}", 3000, job_id=job_id, who=f"{firm} desk")
                prev = s.one("SELECT * FROM docs WHERE job=? ORDER BY id LIMIT 1", (job_id,)) or {}
                ver = (s.one("SELECT COALESCE(MAX(version),1) AS v FROM docs WHERE job=?", (job_id,)) or {"v": 1})["v"] + 1
                fn = f"revision-{ver}.md"
                (vault / fn).write_text(f"# {j['title']} (v{ver})\n\n{rev}\n\n---\nRevised from Rafael's note: {text[:300]}\nThis revision was not re-verified; the earlier verified memo is unchanged.\n")
                fmts = json.loads(prev.get("formats") or '["PDF"]')
                for f, rx in self.FMT_WORDS.items():
                    if re.search(rx, text, re.I) and f not in fmts:
                        fmts.append(f)
                s.run("INSERT INTO docs(job,name,kind,by,version,formats,created,src,why) VALUES(?,?,?,?,?,?,?,?,?)",
                      (job_id, f"{j['title']} (v{ver})", "Revision (changes not re-verified)", prev.get("by") or "desk", ver, json.dumps(fmts), time.time(), fn, f"Your note: {text[:140]}"))
                s.run("UPDATE jobs SET status='done' WHERE id=?", (job_id,))
                s.event("deliver", f"Revised memo v{ver} is in the Library", job_id, j["firm"])
                say(f"Done. I wrote v{ver} with your change and kept the earlier version. It is in the Library as {', '.join(fmts)}. It was not re-verified, so treat new claims with care.")
        except cost.CapStop:
            s.run("UPDATE jobs SET status='done' WHERE id=?", (job_id,))
            say("Stopped at the spending cap before I could finish.")
        except Exception as e:
            s.run("UPDATE jobs SET status='done' WHERE id=? AND status='working'", (job_id,))
            say(f"I could not apply that: {type(e).__name__}. Try again in a moment.")

    def card_answered(self, card_id):
        ev = self.waiting.get(card_id)
        if ev:
            ev.set()
        else:
            self.sim.card_answered(card_id)

    def _persona_at(self, fid, seat):
        txt = (self.root / "firms" / fid / "agents" / f"{seat}.md").read_text()
        if txt.startswith("---"):
            txt = txt.split("---", 2)[2]
        return txt.strip()[:30000] + "\n\nYou work for GTMN Holdings. Answer in plain prose. You see only what is given below."

    VERIFIER = ("You are the independent verifier. You did not write this memo. Output only markdown, no narration before it: "
                "a table | Claim | Verdict | Evidence and URL |, then one line 'Overall: ...'.\n"
                "Verdicts: VERIFIED, UNVERIFIED, CONTRADICTED, or OUT OF SCOPE.\n"
                "OUT OF SCOPE (list them, they are not scored): names of the persona seats and of the firms, Rafael and GTMN Holdings, "
                "figures that come from Rafael's own books or portfolio (marked as client data, or that no public source could hold), "
                "hypotheticals, and the seats' recommendations or judgements.\n"
                "Everything else public is in scope: statutes, decrees, tax rates and thresholds, regulator rules, case law, dates, market facts, product facts.\n"
                "Rules for law, tax and regulation: fetch the primary text with web_fetch (official gazette, statute, regulator or court site) "
                "or, if that is blocked, a law-firm or Big Four note that cites the instrument. Check (a) the figure itself, (b) the effective date, "
                "(c) the taxpayer category it applies to (individual vs company, resident vs non-resident, loan vs receivables purchase), and "
                "(d) that it applies to the transaction as the memo uses it. A real figure applied to the wrong category or transaction is CONTRADICTED, "
                "and you say which category applies. Quote the operative number and its source in Evidence. "
                "Never state a corrected figure you did not read in a fetched source; if you cannot confirm the right figure, mark UNVERIFIED and say what to ask counsel.")

    def _verify(self, job_id, firm, memo, sources, stage=4, of=5):
        self._stage(job_id, firm, stage, of, "Verifier is checking every claim against primary sources")
        ver = self._say(self.VERIFIER,
                        f"Memo to verify:\n\n{memo}\n\nSources the authors already consulted:\n" + "\n".join(f"- {v} {k}" for k, v in sources.items()),
                        5000, True, sources, job_id, "Verifier", deep=True)
        bad = flags = 0
        for l in ver.splitlines():
            if l.startswith("|"):
                cells = [c.strip().strip("*").upper() for c in l.strip().strip("|").split("|")]
                v = cells[1] if len(cells) > 1 else ""
                bad += v.startswith("CONTRADICTED")
                flags += v.startswith("UNVERIFIED")
        verdict = "FAIL" if bad else ("PASS WITH FLAGS" if flags else "PASS")
        self.s.event("verify", f"Verification result: {verdict}", job_id, firm)
        return ver, verdict

    def _verify_fix(self, job_id, firm, memo, sources, stage=4, of=5):
        """Verify; if any claim is contradicted, correct the memo once from the verifier's findings and verify again."""
        ver, verdict = self._verify(job_id, firm, memo, sources, stage, of)
        if verdict != "FAIL":
            return memo, ver, verdict
        self.s.event("step", "Verifier found errors; the desk is correcting the memo once and re-checking", job_id, firm)
        fixed = self._say("You correct a decision memo after a fact-check. For every CONTRADICTED claim, replace it with the figure or rule the verifier found in a source it read. For every UNVERIFIED claim, keep it only if marked 'to be confirmed by counsel'. "
                          "Fix anything else that depended on a corrected figure. Change nothing else, keep the structure and the \"TO: Rafael\" header, and return the full corrected memo in Markdown only.",
                          f"Memo:\n\n{memo}\n\nVerifier findings:\n\n{ver}", 6000, False, None, job_id, "Desk")
        if len(fixed) < len(memo) * 0.5:
            return memo, ver, verdict
        ver2, verdict2 = self._verify(job_id, firm, fixed, sources, stage, of)
        return fixed, ver2, verdict2

    DOC_FORMATS = ("Word", "PDF", "Excel", "PowerPoint", "JPEG", "Markdown")

    def _deliver(self, job_id, firm, title, memo, verdict, by, requested):
        """The desk decides which deliverables this mandate needs and the best format for each.
        The decision memo is always first; extra reports are written from the verified memo."""
        s = self.s
        vault = Path(os.environ.get("HOLDINGS_DATA") or self.root / "server" / "data") / "vault" / f"job-{job_id}"
        plan = []
        try:
            raw = self._say("You are the delivery desk. Decide which deliverables this mandate needs and the best format for each. "
                            "The first is always the decision memo itself. Add up to three more only if a different audience or purpose needs it "
                            "(a model or schedule of numbers, a deck for a committee, a term sheet or checklist, a one-page visual). Do not pad. "
                            "Best format: Word for text a person will edit or sign; PDF for a final read-only document; Excel for any model, schedule or tables of numbers; "
                            "PowerPoint for a committee or board presentation; JPEG for a one-page visual summary; Markdown for notes or hand-over for other tools. Reply with JSON only.",
                            f"Mandate: {title}\n\nVerified memo:\n{memo[:7000]}\n\nReturn {{\"deliverables\": [{{\"name\": short title, \"kind\": e.g. Memo|Model|Deck|Checklist|Summary, "
                            f"\"format\": one of {list(self.DOC_FORMATS)}, \"why\": one sentence on why this format, \"brief\": what it must contain}}]}}", 1200)
            plan = json.loads(raw[raw.index("{"):raw.rindex("}") + 1])["deliverables"]
        except Exception:
            plan = []
        plan = [p for p in plan if isinstance(p, dict) and p.get("format") in self.DOC_FORMATS][:4]
        if not plan:
            plan = [{"name": title, "kind": "Memo", "format": "PDF", "why": "A final read-only document.", "brief": ""}]
        main = plan[0]
        main_fmts = requested or [main["format"]]
        self._ids = getattr(self, "_ids", {})
        rows = [(title, f"Decision memo (verified: {verdict})", main_fmts, main.get("why", ""), "decision-memo.md")]
        extras = plan[1:]
        out = {}

        def write(i, p):
            out[i] = self._say("You write one deliverable for GTMN Holdings from a verified decision memo. Use only facts in the memo; do not add new facts. "
                               "Markdown. Put numbers in markdown tables so they can become a spreadsheet; use '## ' headings, one per slide, if it is a deck. If it is a model or calculator, give each table a '### ' heading naming the sheet, put inputs in a labelled Inputs table with plain numbers (no units inside the cell; put units in the header), and write calculated cells as spreadsheet formulas such as =B2*C2 that refer to those cells, so the workbook recalculates. Do not invent input values the memo does not state: leave them as 0 and mark them 'to be provided'. Under 900 words.",
                               f"Deliverable: {p['name']} ({p.get('kind', '')})\nMust contain: {p.get('brief', '')}\n\nVerified memo:\n{memo}", 2600)
        ts = [threading.Thread(target=write, args=(i, p)) for i, p in enumerate(extras)]
        [t.start() for t in ts]
        [t.join() for t in ts]
        for i, p in enumerate(extras):
            if out.get(i):
                fn = f"report-{i + 1}.md"
                (vault / fn).write_text(f"# {p['name']}\n\n{out[i]}\n\n---\nDerived from the decision memo (verification: {verdict}).\n")
                rows.append((p["name"], f"{p.get('kind', 'Report')} (from the verified memo)", [p["format"]], p.get("why", ""), fn))
        for name, kind, fmts, why, src in rows:
            s.run("INSERT INTO docs(job,name,kind,by,formats,created,src,why) VALUES(?,?,?,?,?,?,?,?)",
                  (job_id, name, kind, by, json.dumps(fmts), time.time(), src, why))
        s.event("deliver", "Deliverables: " + "; ".join(f"{n} as {', '.join(f)}" for n, _, f, _, _ in rows), job_id, firm)

    def _persona(self, seat):
        txt = (self.root / "firms" / "gtmn-cto" / "agents" / f"{seat}.md").read_text()
        if txt.startswith("---"):
            txt = txt.split("---", 2)[2]
        return txt.strip() + "\n\nYou work for GTMN Holdings. Answer in plain prose under 450 words. You see only the mandate below."

    TOOLS = [{"type": "web_search_20250305", "name": "web_search", "max_uses": 5},
             {"type": "web_fetch_20250910", "name": "web_fetch", "max_uses": 4},
             {"type": "code_execution_20250522", "name": "code_execution"}]

    DEEP_TOOLS = [{"type": "web_search_20250305", "name": "web_search", "max_uses": 10},
                  {"type": "web_fetch_20250910", "name": "web_fetch", "max_uses": 10},
                  {"type": "code_execution_20250522", "name": "code_execution"}]

    def _say(self, system, user, max_tokens=1800, tools=False, sources=None, job_id=None, who="", deep=False):
        msgs = [{"role": "user", "content": user}]
        use_g = bool(tools and not deep and granola.enabled() and (not job_id or (self.s.one("SELECT granola FROM jobs WHERE id=?", (job_id,)) or {}).get("granola", 1)))
        if use_g:
            system += ("\nYou can search Rafael's own meeting notes with meeting_search and meeting_read. Use them once or twice for prior decisions, "
                       "commitments or counterparties that bear on the mandate; quote only what you read, and never send meeting content into web searches.")
        for _ in range(10 if deep else 6):
            kw = {"tools": (self.DEEP_TOOLS if deep else self.TOOLS) + (granola.TOOLS if use_g else [])} if tools else {}
            cost.gate(self.s, job_id, who)
            r = self.client.beta.messages.create(model=self.model, max_tokens=max_tokens, system=system,
                                                 messages=msgs, betas=["web-fetch-2025-09-10", "code-execution-2025-05-22"], **kw)
            cost.record(self.s, job_id, self.model, getattr(r, "usage", None))
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
            if r.stop_reason == "tool_use":
                res = []
                for b in r.content:
                    if b.type == "tool_use":
                        txt, label = granola.run(b.name, b.input)
                        if job_id:
                            self.s.event("tool", f"{who} used Granola: {label}", job_id, "granola")
                        res.append({"type": "tool_result", "tool_use_id": b.id, "content": txt})
                msgs = msgs + [{"role": "assistant", "content": r.content}, {"role": "user", "content": res}]
                continue
            if r.stop_reason != "pause_turn":
                break
            msgs = msgs + [{"role": "assistant", "content": r.content}]
        return "".join(b.text for b in r.content if b.type == "text").strip()

    def _stage(self, job_id, firm, i, n, label):
        self.s.run("UPDATE jobs SET stage=?, progress=? WHERE id=?", (i, i / n, job_id))
        self.s.event("stage", label, job_id, firm)

    def _run_dani(self, job_id):
        s = self.s
        j = s.one("SELECT * FROM jobs WHERE id=?", (job_id,))
        firm, title = j["firm"], j["title"]
        try:
            s.run("UPDATE jobs SET status='working' WHERE id=?", (job_id,))
            s.event("start", "Dani picked up the demand", job_id, firm)
            raw = (self.root / "firms" / "dani" / "agents" / "dani.md").read_text()
            persona = raw.split("---", 2)[2].strip() if raw.startswith("---") else raw
            sk = self.root / "firms" / "dani" / "skills" / "dani"
            ref = (sk / "references" / "persona.md").read_text() if (sk / "references" / "persona.md").exists() else ""
            self._stage(job_id, firm, 0, 2, "Dani is searching his own words")
            passages = ""
            try:
                qs = json.loads((lambda r: r[r.index("["):r.rindex("]") + 1])(self._say("Reply with a JSON array of 4 short keyword search queries (3 to 7 words each), 2 in English and 2 in German, in the words Daniel Dippold would use, to find what he has said that bears on this mandate.", title, 200, False, None, job_id, "Dani")))
                import subprocess
                for q in qs[:4]:
                    o = subprocess.run(["python3", str(sk / "scripts" / "search.py"), str(q), "--k", "5"], capture_output=True, text=True, timeout=60).stdout
                    passages += f"\n### Search: {q}\n{o[:6000]}"
            except Exception:
                passages = "(search failed; say so and answer as a take)"
            s.event("step", "Dani searched his corpus", job_id, firm)
            self._stage(job_id, firm, 1, 3, "Dani is writing his take")
            memo = self._say(persona + "\n\n" + ref[:14000] + "\n\nGround the answer in the passages below. Quote only words that appear verbatim; keep credits to others; say plainly when something is your take rather than on the record. Use web_search for outside facts; mark anything unverified. Write in Markdown, answer first, under 700 words; refer to Daniel in the third person. Lines marked as previous speaker are not his words. Start directly with the answer: no preamble, no meta-commentary about passages or frameworks."
                             f"Mandate: {title}\n\nSteering notes: {' '.join(self.notes.get(job_id, [])) or 'none'}\n\nPassages from his public words:\n{passages}", 2400, True, {}, job_id, "Dani")
            vault = Path(os.environ.get("HOLDINGS_DATA") or self.root / "server" / "data") / "vault" / f"job-{job_id}"
            vault.mkdir(parents=True, exist_ok=True)
            (vault / "decision-memo.md").write_text(f"# {title}\n\n{memo}\n\n---\nAdvisory second opinion from an AI modelled on Daniel Dippold. Not Daniel, not verified.\n")
            self._stage(job_id, firm, 2, 3, "Desk is preparing the files")
            self._deliver(job_id, firm, title, memo, "advisory, not verified", "dani", json.loads(j["formats"]))
            s.run("UPDATE jobs SET status='done', progress=1, stage=2 WHERE id=?", (job_id,))
            s.event("done", "Dani's take is in the Library.", job_id, firm)
        except cost.CapStop:
            s.run("UPDATE jobs SET status='waiting' WHERE id=?", (job_id,))
            s.event("error", "Stopped at your spend cap.", job_id, firm)
        except Exception as e:
            s.run("UPDATE jobs SET status='waiting' WHERE id=?", (job_id,))
            s.event("error", f"Run stopped: {type(e).__name__}: {str(e)[:160]}", job_id, firm)

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
            memo, ver, verdict = self._verify_fix(job_id, firm, memo, sources, 3, 4)
            vault = Path(os.environ.get("HOLDINGS_DATA") or self.root / "server" / "data") / "vault" / f"job-{job_id}"
            vault.mkdir(parents=True, exist_ok=True)
            (vault / "decision-memo.md").write_text(f"# {title}\n\n{memo}\n\n---\n## Blind positions\n\n{positions}\n\n---\n## Verification ({verdict})\n\n{ver}\n\n## Sources consulted\n\n" + "\n".join(f"- {v}: {k}" for k, v in sources.items()) + "\n")
            fmts = j["formats"]
            self._deliver(job_id, firm, title, memo, verdict, "cto-desk", json.loads(fmts))
            s.run("UPDATE jobs SET status='done', progress=1, stage=3 WHERE id=?", (job_id,))
            s.event("done", "Memo is in the vault and the Library.", job_id, firm)
        except Exception as e:
            s.run("UPDATE jobs SET status='waiting' WHERE id=?", (job_id,))
            s.event("error", f"Run stopped: {type(e).__name__}: {str(e)[:160]}", job_id, firm)
