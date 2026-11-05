"""Spend tracking and the monthly cap. Every Claude call is priced from its token usage."""
import calendar
import os
import time

# USD per million tokens (input, output); web search is USD per search.
PRICES = {"sonnet": (3.0, 15.0), "haiku": (1.0, 5.0), "opus": (15.0, 75.0)}
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


def _price(model):
    m = (model or "").lower()
    for k, v in PRICES.items():
        if k in m:
            return v
    return PRICES["sonnet"]


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
    pin, pout = _price(model)
    g = lambda k: getattr(usage, k, 0) or 0
    st = getattr(usage, "server_tool_use", None)
    searches = (getattr(st, "web_search_requests", 0) or 0) if st else 0
    usd = (g("input_tokens") * pin + g("output_tokens") * pout + g("cache_read_input_tokens") * pin * 0.1
           + g("cache_creation_input_tokens") * pin * 1.25) / 1e6 + searches * SEARCH
    s.run("INSERT INTO usage(job,model,tokens_in,tokens_out,usd,created) VALUES(?,?,?,?,?,?)",
          (job_id, model, g("input_tokens") + g("cache_read_input_tokens") + g("cache_creation_input_tokens"), g("output_tokens"), usd, time.time()))
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
