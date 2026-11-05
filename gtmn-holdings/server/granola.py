"""Read-only Granola meeting-notes tools for the agents. Needs GRANOLA_API_KEY in .env."""
import json
import os
import urllib.request

BASE = "https://public-api.granola.ai/v1"
MAX_CHARS = 7000

TOOLS = [
    {"name": "meeting_search",
     "description": "Search Rafael's Granola meeting notes by keywords in titles and summaries. Returns note ids, titles and dates. "
                    "Use it for prior decisions, commitments and counterparties relevant to the mandate.",
     "input_schema": {"type": "object", "properties": {
         "keywords": {"type": "array", "items": {"type": "string"}, "description": "Any-of keyword phrases"},
         "participant": {"type": "string", "description": "Optional email or domain of a calendar participant"},
         "after": {"type": "string", "description": "Optional YYYY-MM-DD lower bound on meeting date"}},
         "required": ["keywords"]}},
    {"name": "meeting_read",
     "description": "Read one Granola note (summary, and a transcript excerpt if asked) by its not_ id from meeting_search.",
     "input_schema": {"type": "object", "properties": {
         "id": {"type": "string"}, "transcript": {"type": "boolean"}}, "required": ["id"]}},
]


def enabled():
    return bool(os.environ.get("GRANOLA_API_KEY"))


def _call(path, body=None):
    req = urllib.request.Request(BASE + path, method="POST" if body is not None else "GET",
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": "Bearer " + os.environ["GRANOLA_API_KEY"],
                                          "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def run(name, args):
    """Returns (text for the model, short label for the audit log)."""
    try:
        if name == "meeting_search":
            body = {"keywords": [str(k) for k in args.get("keywords", [])][:6], "page_size": 8}
            if args.get("participant"):
                body["participant"] = args["participant"]
            if args.get("after"):
                body["meeting_after"] = args["after"]
            d = _call("/notes/search", body)
            rows = [{"id": n.get("id"), "title": n.get("title"), "meeting_at": n.get("meeting_at")} for n in d.get("notes", [])]
            return json.dumps(rows)[:MAX_CHARS], "search " + ", ".join(body["keywords"])
        if name == "meeting_read":
            nid = str(args.get("id", ""))
            if not nid.startswith("not_"):
                return "Invalid id; use a not_ id from meeting_search.", "read (invalid id)"
            d = _call(f"/notes/{nid}" + ("?include=transcript" if args.get("transcript") else ""))
            out = {"title": d.get("title"), "summary": d.get("summary")}
            if args.get("transcript"):
                out["transcript"] = " ".join(t.get("text", "") for t in d.get("transcript", []))
            return json.dumps(out)[:MAX_CHARS], "read " + str(d.get("title"))[:60]
    except Exception as e:
        return f"Granola error: {str(e)[:150]}", f"{name} failed"
    return "Unknown tool.", name
