"""Spend tracking and the monthly cap. Every Claude call is priced from its token usage."""
import calendar
import os
import time

# USD per million tokens (input, output, cache-read multiplier); web search is USD per search.
PRICES = {
    "claude-fable-5-1": (10.0, 50.0, 0.025),
    "claude-opus-5-5": (4.0, 20.0, 0.05),
    "claude-sonnet-5-5": (2.0, 10.0, 0.05),
    "claude-haiku-5-5": (0.10, 0.50, 0.10),
    "claude-opus-4-5": (5.0, 25.0, 0.10),
    "claude-opus-4-1": (15.0, 75.0, 0.10),
    "claude-opus-4": (15.0, 75.0, 0.10),
    "claude-sonnet-4-5": (3.0, 15.0, 0.10),
    "sonnet": (3.0, 15.0, 0.10),
}
# Haiku 5.5 charges more once a single prompt (input + cache read + cache write) passes 100k tokens.
LONG_PROMPT = {"claude-haiku-5-5": (100_000, (0.50, 2.50, 0.10))}
SEARCH = 0.01
DEFAULT_CAP = float(os.environ.get("HOLDINGS_DEFAULT_CAP", "25"))


class CapStop(Exception):
    pass


class JobStopped(CapStop):
    pass


def _check_job(s, job_id):
    if job_id:
        j = s.one("SELECT status FROM jobs WHERE id=?", (job_id,))
        if not j or j["status"] == "stopped":
            raise JobStopped("stopped by Rafael")


def _price(model, prompt_tokens=0):
    m = (model or "").lower()
    key = max((k for k in PRICES if k in m), key=len, default="sonnet")
    tier = LONG_PROMPT.get(key)
    return tier[1] if tier and prompt_tokens > tier[0] else PRICES[key]


def _month(t=None):
    return time.strftime("%Y-%m", time.gmtime(t or time.time()))


def get(s, key, default=None):
    r = s.one("SELECT value FROM settings WHERE key=?", (key,))
    return r["value"] if r else default


def put(s, key, value):
    s.run("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, str(value)))


def record(s, job_id, model, usage):
    if usage is None:
        return 0.0
    g = lambda k: getattr(usage, k, 0) or 0
    prompt = g("input_tokens") + g("cache_read_input_tokens") + g("cache_creation_input_tokens")
    pin, pout, cache_read_multiplier = _price(model, prompt)
    st = getattr(usage, "server_tool_use", None)
    searches = (getattr(st, "web_search_requests", 0) or 0) if st else 0
    usd = (g("input_tokens") * pin + g("output_tokens") * pout
           + g("cache_read_input_tokens") * pin * cache_read_multiplier
           + g("cache_creation_input_tokens") * pin * 1.25) / 1e6 + searches * SEARCH
    s.run("INSERT INTO usage(job,model,tokens_in,tokens_out,usd,created) VALUES(?,?,?,?,?,?)",
          (job_id, model, prompt, g("output_tokens"), usd, time.time()))
    return usd


def status(s):
    now = time.time()
    month = _month(now)
    spent = (s.one("SELECT COALESCE(SUM(usd),0) AS v FROM usage WHERE created>=?", (_start_of_month(now),)) or {"v": 0})["v"]
    today = (s.one("SELECT COALESCE(SUM(usd),0) AS v FROM usage WHERE created>=?", (now - now % 86400,)) or {"v": 0})["v"]
    base = float(get(s, "cap_usd", DEFAULT_CAP))
    extra = float(get(s, "extra_usd", 0)) if get(s, "extra_month") == month else 0.0
    cap = base + extra
    return {"spent": round(spent, 4), "today": round(today, 4), "cap": cap, "base": base, "extra": extra, "month": month,
            "paused": spent >= cap, "stopped_epoch": int(get(s, "stop_epoch", 0))}


def _start_of_month(now):
    t = time.gmtime(now)
    return calendar.timegm((t.tm_year, t.tm_mon, 1, 0, 0, 0))


def gate(s, job_id=None, who=""):
    """Block a call while the cap is reached. Raises CapStop if Rafael chooses to stop."""
    _check_job(s, job_id)
    st = status(s)
    if not st["paused"]:
        return
    epoch = st["stopped_epoch"]
    if job_id and not get(s, f"paused_noted_{job_id}_{st['month']}_{int(st['cap'])}"):
        put(s, f"paused_noted_{job_id}_{st['month']}_{int(st['cap'])}", 1)
        s.event("cost", f"Paused: the ${st['cap']:.0f} monthly cap is reached. Waiting for Rafael to extend or stop.", job_id, None)
    while True:
        time.sleep(2)
        _check_job(s, job_id)
        st = status(s)
        if st["stopped_epoch"] != epoch:
            raise CapStop("stopped at the spending cap")
        if not st["paused"]:
            if job_id:
                s.event("cost", "Cap extended. Work resumes.", job_id, None)
            return
