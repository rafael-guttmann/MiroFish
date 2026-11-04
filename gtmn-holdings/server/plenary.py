"""The GTMN Plenary: two or more firms on one mandate. Follows plenary-protocol in a
compact form: Chair convenes the minimum firms, blind positions in parallel, one issues
list, one cross-examination turn, Rafael decides what stays open, a verified decision memo.
The Chair never takes a view on substance; firm text is filed verbatim."""
import json
import re
import threading
import time

MAX_FIRMS, SEATS_PER_FIRM, MAX_CARDS, MAX_LATE, PARALLEL = 6, 5, 4, 6, 6


def _json(raw):
    return json.loads(raw[raw.index("{"):raw.rindex("}") + 1])


def _frontmatter(path):
    txt = path.read_text()
    desc = re.search(r'^description:\s*"?(.*?)"?\s*$', txt, re.M)
    h1 = re.search(r"^#\s+(.*)$", txt, re.M)
    name = re.split(r"\s[—-]\s", h1[1])[0].strip() if h1 else path.stem
    return name, (desc[1] if desc else "")[:220]


def run(r, job_id):
    s, root = r.s, r.root
    j = s.one("SELECT * FROM jobs WHERE id=?", (job_id,))
    title, firm = j["title"], "plenary"
    sem = threading.Semaphore(PARALLEL)

    def say(*a, **k):
        with sem:
            return r._say(*a, **k)
    vault = root / "server" / "data" / "vault" / f"job-{job_id}"
    (vault / "envelopes").mkdir(parents=True, exist_ok=True)

    def approved(fid):
        x = s.one("SELECT decision FROM charter_reviews WHERE charter=? ORDER BY id DESC LIMIT 1", (fid,))
        return bool(x) and x["decision"] == "approved"

    def agents_dir(fid):
        return root / "firms" / fid / "agents"

    avail = {fid: c for fid, c in r.charters.items() if fid != "dani" and agents_dir(fid).is_dir() and approved(fid)}
    try:
        s.run("UPDATE jobs SET status='working' WHERE id=?", (job_id,))
        s.event("start", "The Chair opened the Plenary", job_id, firm)
        r._stage(job_id, firm, 0, 5, "Chair is deciding which firms must be in the room")

        # 1. Convene: the minimum set of firms, then seats per firm
        ev = s.one("SELECT text FROM events WHERE job=? AND kind='picks'", (job_id,))
        chosen = [f for f in (ev["text"].split(": ", 1)[1].split(", ") if ev else []) if f in avail]
        if len(chosen) >= 2:
            avail = {f: avail[f] for f in chosen}
        menu = "\n".join(f"- {fid}: {c['name']} — owns {', '.join(c.get('owns', []))[:160]}. {c['summary'][:200]}" for fid, c in avail.items())
        pick = _json(say("You are the Chair of the GTMN Plenary. You convene the minimum set of firms that covers every issue in the mandate, never fewer than two, never more than six (if Rafael already chose the firms, they are the only ones listed: convene them all, however many). You have no view on substance. Reply with JSON only.",
                            f"Mandate: {title}\n\nFirms available:\n{menu}\n\nReturn {{\"firms\": [firm ids], \"lead\": firm id that holds the pen, \"why\": one sentence, \"issues\": [the 2-4 questions the mandate breaks into]}}", 900))
        fids = chosen if len(chosen) >= 2 else [f for f in pick["firms"] if f in avail][:MAX_FIRMS]
        if len(fids) < 2:
            fids = [f for f in avail if f != "gtmn-cto"][:2] if len(fids) == 0 else fids + [next(f for f in avail if f not in fids)]
        lead = pick.get("lead") if pick.get("lead") in fids else fids[0]
        s.event("step", f"Convened: {', '.join(avail[f]['name'] for f in fids)}. Lead: {avail[lead]['name']}. {pick.get('why', '')[:140]}", job_id, firm)

        seats = []

        def choose(fid):
            ds = {p.stem: _frontmatter(p) for p in agents_dir(fid).glob("*.md")}
            lst = "\n".join(f"- {k}: {v[0]} — {v[1]}" for k, v in ds.items())
            got = _json(say(f"You are the Chair of the GTMN Plenary choosing seats from one firm's bench. Each person has a specialty. Pick every seat whose specialty the mandate actually needs, at least one and at most {SEATS_PER_FIRM}, and leave the rest of the bench out; more can be called in later. Reply with JSON only.",
                               f"Mandate: {title}\nIssues: {pick.get('issues')}\n\nBench of {avail[fid]['name']}:\n{lst}\n\nReturn {{\"seats\": [seat ids, one to {SEATS_PER_FIRM}]}}", 300))
            for sid in got["seats"][:SEATS_PER_FIRM]:
                if sid in ds:
                    seats.append((fid, sid, ds[sid][0]))
        ts = [threading.Thread(target=choose, args=(f,)) for f in fids]
        [t.start() for t in ts]
        [t.join() for t in ts]
        if len({f for f, _, _ in seats}) < 2:
            raise RuntimeError("could not seat two firms")
        seats.sort(key=lambda x: fids.index(x[0]))
        s.event("step", "Seated: " + "; ".join(f"{n} ({avail[f]['name']})" for f, _, n in seats), job_id, firm)

        # 2. Round one: blind positions across all firms in one wave
        r._stage(job_id, firm, 1, 5, "Round one: every seat files a blind position")
        sources, env = {}, {}
        facts = f"Mandate as stated by Rafael: {title}"

        def blind(f, sid, nm):
            sysm = (r._persona_at(f, sid) + "\n\nYou are seated at the GTMN Plenary for " + avail[f]["name"] + ". Stay inside your firm's lane: " + ", ".join(avail[f].get("owns", [])) +
                    ". Use web_search and web_fetch to verify facts you rely on and cite them; mark anything unverified as UNVERIFIED. You see only the mandate and the fact ledger, not the other firms.")
            env[(f, sid)] = say(sysm, f"{facts}\n\nFile your position in four labelled sections: POSITION (verdict and reasons, from your lane only), NEEDS (what you need from another lane), CONSTRAINTS (what you will not accept), FACTS CHALLENGED. Under 450 words.",
                                   2500, True, sources, job_id, nm)
            (vault / "envelopes" / f"{f}--{sid}.md").write_text(env[(f, sid)])
            s.event("step", f"{nm} ({avail[f]['name']}) filed a blind position", job_id, firm)
        ts = [threading.Thread(target=blind, args=a) for a in seats]
        [t.start() for t in ts]
        [t.join() for t in ts]
        names = {(f, sid): nm for f, sid, nm in seats}
        block = lambda keys, src=None: "\n\n".join(f"### {names[k]} · {avail[k[0]]['name']}\n{(env if src is None else src)[k]}" for k in keys if k in (env if src is None else src))
        v1 = block(list(names))

        # 3. One issues list, each with an owner and respondents; the Chair does not conclude
        r._stage(job_id, firm, 2, 5, "Chair is listing the issues and sending them for cross-examination")
        iss = _json(say("You are the Chair of the GTMN Plenary. You list issues; you never conclude, average or take a view on substance. Every issue has an owning firm and the seats who must respond. Reply with JSON only.",
                           f"Mandate: {title}\n\nPositions, verbatim:\n{v1}\n\nSeat keys: {[f'{f}/{sid}' for f, sid, _ in seats]}\n\nReturn {{\"issues\": [{{\"id\": \"I1\", \"question\": ..., \"owner\": firm id, \"respondents\": [seat keys], \"kind\": \"disagreement|need|fact\"}}]}} with at most 6 issues, only where seats actually differ or need something from each other.", 1500))["issues"][:5]
        (vault / "text-v1.md").write_text(f"# Single text v1\n\n[Chair] Issues: {json.dumps(iss, indent=1)}\n\n## Positions\n\n{v1}\n")
        s.event("step", f"{len(iss)} issue(s) opened", job_id, firm)

        # 4. Cross-examination, one turn, lane-bounded
        r._stage(job_id, firm, 3, 5, "Cross-examination: respondents answer inside their own lanes")
        replies = {}

        def cross(f, sid, nm):
            mine = [i for i in iss if f"{f}/{sid}" in i["respondents"]]
            if not mine:
                return
            replies[(f, sid)] = say(r._persona_at(f, sid) + "\n\nYou are cross-examining at the GTMN Plenary. Answer only inside your firm's lane. No vote outside it.",
                                       f"Mandate: {title}\n\nAll positions, verbatim:\n{v1}\n\nIssues you must answer:\n{json.dumps(mine, indent=1)}\n\nFor each issue reply: ID, then AGREE, DISAGREE or CONDITIONAL, then your reason in two sentences. Under 250 words.", 1200)
            s.event("step", f"{nm} answered cross-examination", job_id, firm)
        ts = [threading.Thread(target=cross, args=a) for a in seats]
        [t.start() for t in ts]
        [t.join() for t in ts]
        v2 = block(list(replies), replies)

        # 4b. Rotation: the Chair calls in specialists nobody seated covers, from any firm in the room
        r._stage(job_id, firm, 3, 5, "Chair is checking whether another specialist is needed")
        seated = {(f, sid) for f, sid, _ in seats}
        benches = {f: {p.stem: _frontmatter(p) for p in agents_dir(f).glob("*.md")} for f in fids}
        bench_txt = "\n".join(f"[{f}] {sid}: {n} — {d}" for f in fids for sid, (n, d) in benches[f].items() if (f, sid) not in seated)
        try:
            calls = _json(say("You are the Chair of the GTMN Plenary. After cross-examination you may call in specialists who are not yet seated, only where an issue needs a skill nobody in the room has, or a reply exposed a gap. Never add people for volume. Reply with JSON only.",
                              f"Mandate: {title}\n\nIssues: {json.dumps(iss)}\n\nPositions:\n{v1}\n\nReplies:\n{v2}\n\nNot yet seated:\n{bench_txt[:14000]}\n\nReturn {{\"calls\": [{{\"firm\": firm id, \"seat\": seat id, \"issue\": issue id, \"why\": one sentence}}]}} with at most {MAX_LATE} calls, or an empty list.", 900))["calls"]
        except Exception:
            calls = []
        calls = [c for c in calls if c.get("firm") in benches and c.get("seat") in benches[c["firm"]] and (c["firm"], c["seat"]) not in seated][:MAX_LATE]
        late = []
        for c in calls:
            late.append((c["firm"], c["seat"], benches[c["firm"]][c["seat"]][0]))
            names[(c["firm"], c["seat"])] = benches[c["firm"]][c["seat"]][0]
            s.event("step", f"Chair called in {names[(c['firm'], c['seat'])]} ({avail[c['firm']]['name']}): {str(c.get('why', ''))[:120]}", job_id, firm)
        if late:
            seats.extend(late)

            def join(c):
                f, sid = c["firm"], c["seat"]
                nm = names[(f, sid)]
                iid = c.get("issue")
                mine = [i for i in iss if i["id"] == iid] or iss
                out = say(r._persona_at(f, sid) + "\n\nYou have been called into the GTMN Plenary as a specialist after round one. Stay inside your firm's lane: " + ", ".join(avail[f].get("owns", [])) + ". Use web_search and web_fetch for facts and cite them; mark anything unverified as UNVERIFIED.",
                          f"Mandate: {title}\n\nAll positions, verbatim:\n{v1}\n\nCross-examination so far:\n{v2}\n\nThe issue you were called for:\n{json.dumps(mine, indent=1)}\n\nReply: AGREE, DISAGREE or CONDITIONAL with your reason, then what the room is missing from your specialty. Under 350 words.",
                          2500, True, sources, job_id, nm)
                env[(f, sid)] = out
                replies[(f, sid)] = out
                for i in mine:
                    if f"{f}/{sid}" not in i["respondents"]:
                        i["respondents"].append(f"{f}/{sid}")
                (vault / "envelopes" / f"{f}--{sid}.md").write_text(out)
                s.event("step", f"{nm} ({avail[f]['name']}) joined and filed", job_id, firm)
            ts = [threading.Thread(target=join, args=(c,)) for c in calls]
            [t.start() for t in ts]
            [t.join() for t in ts]
            v1 = block(list(names))
            v2 = block(list(replies), replies)
        s.event("step", "Seats released: " + ", ".join(n for k, n in names.items() if k not in replies) if any(k not in replies for k in names) else "Every seat took part in the cross-examination", job_id, firm)
        st = _json(say("You are the Chair. Classify each issue from the replies. An issue is closed only if every respondent agrees; silence, fatigue or averaging never closes one. Reply with JSON only.",
                          f"Issues: {json.dumps(iss)}\n\nReplies, verbatim:\n{v2}\n\nReturn {{\"issues\": [{{\"id\": ..., \"status\": \"closed|open\", \"state\": one neutral line}}]}}", 1200))["issues"]
        stat = {x["id"]: x for x in st}
        open_i = [i for i in iss if stat.get(i["id"], {}).get("status") != "closed"]
        (vault / "text-v2.md").write_text(f"# Single text v2\n\nStatus: {json.dumps(st, indent=1)}\n\n## Cross-examination replies\n\n{v2}\n")
        s.event("step", f"{len(iss) - len(open_i)} closed, {len(open_i)} open", job_id, firm)

        # 5. What stays open goes to Rafael, one question per issue
        r._stage(job_id, firm, 4, 5, "Open issues are with Rafael")
        decisions = []
        for i in open_i[:MAX_CARDS]:
            pos = block([(f, sid) for f, sid, _ in seats if f"{f}/{sid}" in i["respondents"]])
            card = _json(say("You are the Chair. Put one open issue to Rafael as a question. The options are the seats' positions as they stand, neutral, plus one to send it back. Reply with JSON only.",
                                f"Issue: {i['question']}\n\nPositions:\n{pos}\n\nCross-examination:\n{v2}\n\nReturn {{\"q\": ..., \"why\": one sentence on the consequence, \"opts\": [[label, one-line consequence], ...2-3 options, last one \"Send back with an instruction\"]]}}", 800))
            payload = {"kind": "one", "q": card["q"], "opts": card["opts"], "why": card.get("why", ""), "def": "Nothing moves until you answer."}
            cid = s.run("INSERT INTO cards(job,firm,payload,created) VALUES(?,?,?,?)", (job_id, firm, json.dumps(payload), time.time()))
            s.run("UPDATE jobs SET status='asking' WHERE id=?", (job_id,))
            s.event("card", payload["q"], job_id, firm, {"card": cid})
            ev = r.waiting[cid] = threading.Event()
            ev.wait()
            ans = (s.one("SELECT answer FROM cards WHERE id=?", (cid,)) or {}).get("answer") or ""
            decisions.append((i, ans))
            s.run("UPDATE jobs SET status='working' WHERE id=?", (job_id,))
        left = open_i[MAX_CARDS:]
        s.event("step", "Desk is writing the decision memo", job_id, firm)

        # 6. Decision memo, one pen (lead firm), dissent preserved; then independent verification
        steer = "\n".join(r.notes.get(job_id, []))
        rec = "\n".join(f"- {i['question']} → Rafael decided: {a}" for i, a in decisions) or "none needed"
        memo = say(f"You hold the pen for the GTMN Plenary as {avail[lead]['name']}'s orchestrator, writing a decision memo to Rafael in a senior consulting partner's register. Structure: answer first; what the firms agreed; what Rafael decided; dissent preserved verbatim in each firm's own words, never averaged; remaining open items; next steps. Each section credits the firm. Markdown, under 1100 words.",
                      f"Header rule: the memo starts with the line \"TO: Rafael\" exactly. Do not add a surname or title for him, and do not name any company other than GTMN Holdings and the firms listed.\n\nMandate: {title}\n\nFirms: {', '.join(avail[f]['name'] for f in fids)}\n\nPositions, verbatim:\n{v1}\n\nCross-examination:\n{v2}\n\nIssue status: {json.dumps(st)}\n\nRafael's decisions:\n{rec}\n\nStill open, not asked: {json.dumps(left)}\n\nRafael's steering notes (apply them): {steer or 'none'}", 3000)
        ver, verdict = r._verify(job_id, firm, memo, sources)
        (vault / "facts.md").write_text(f"# Fact ledger\n\n- {facts}\n" + "".join(f"- Rafael decided on {i['id']}: {a}\n" for i, a in decisions))
        (vault / "decision-memo.md").write_text(f"# {title}\n\n{memo}\n\n---\n## Verification ({verdict})\n\n{ver}\n\n## Sources consulted\n\n" + "\n".join(f"- {v}: {k}" for k, v in sources.items()) + f"\n\n---\n## Plenary file\n\n### Blind positions\n\n{v1}\n\n### Cross-examination\n\n{v2}\n")
        fmts = j["formats"]
        s.run("UPDATE jobs SET status='done', progress=1, stage=4 WHERE id=?", (job_id,))
        s.run("INSERT INTO docs(job,name,kind,by,formats,created) VALUES(?,?,?,?,?,?)", (job_id, title, "Plenary decision memo (verified: " + verdict + ")", "plenary-chair", fmts, time.time()))
        s.event("done", f"Plenary closed with {len(seats)} seats from {len(fids)} firms. Memo is in the Library.", job_id, firm)
        if not json.loads(fmts):
            r.sim._ask_formats(job_id, firm)
    except Exception as e:
        s.run("UPDATE jobs SET status='waiting' WHERE id=?", (job_id,))
        s.event("error", f"Plenary stopped: {type(e).__name__}: {str(e)[:160]}", job_id, firm)
