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
    """Real execution via the Claude Agent SDK. Not wired yet.

    Plan: one session per job; the firm's desk skill is the entrypoint; each charter
    agent becomes an isolated subagent (blind seats never share context); tool use that
    needs Rafael pauses the session and becomes a question card; steering notes are
    injected as a new user turn at the next step boundary.
    """

    def __init__(self, *a, **k):
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise RuntimeError("Set ANTHROPIC_API_KEY in the server environment to use the real runner.")
        raise NotImplementedError("AgentSDKRunner is the next build step (CTO firm first).")
