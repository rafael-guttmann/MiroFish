"""Per-demand model choice. Rafael picks a preset when he files a demand, and the preset says
which Claude model does each kind of work on that demand:

  work    seats, chairs, planners and cards: the many research and reasoning calls
  pen     the memo, the deliverables and their editor: the words Rafael reads
  verify  the independent fact-check

Only presets whose models this API key can actually run are offered.
"""
import os
import re

import cost

ROLES = ("work", "pen", "verify")
ROLE_LABEL = {"work": "Research", "pen": "Writing", "verify": "Fact-check"}
DEFAULT_PRESET = "auto"
BASELINE = "claude-sonnet-5-5"

# No speed word: Anthropic rates Haiku "fastest" per word, but on a whole demand here it searched 13-15 times
# against Sonnet's 2, wrote 4-9x more, and ran 2-5x slower for a bill only about 10% lower. The Haiku line
# says what was measured; re-measure (see README) before changing it.
PRESETS = [
    {"id": "auto", "badge": "Recommended",
     "tagline": "Best balance. A fast model researches; a stronger one writes and checks the facts."},
    {"id": "fable", "model": "claude-fable-5-1",
     "tagline": "Deepest reasoning, for the hardest calls."},
    {"id": "opus", "model": "claude-opus-5-5",
     "tagline": "Thorough, polished work on complex mandates."},
    {"id": "sonnet", "model": "claude-sonnet-5-5",
     "tagline": "Fast and capable for everyday demands."},
    {"id": "haiku", "model": "claude-haiku-5-5",
     "tagline": "Smallest model, built for simple tasks. In our tests it ran slower than Sonnet at a similar total cost."},
]
BY_ID = {p["id"]: p for p in PRESETS}
_LABEL = re.compile(r"claude-(opus|sonnet|haiku|fable)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?")


def label(model_id):
    """claude-sonnet-5-5 -> Sonnet 5.5; dated ids such as claude-opus-4-5-20251101 -> Opus 4.5."""
    m = _LABEL.fullmatch(model_id or "")
    if not m:
        return model_id or ""
    return f"{m[1].capitalize()} {m[2]}" + (f".{m[3]}" if m[3] else "")


def _auto():
    work = os.environ.get("HOLDINGS_MODEL") or "claude-sonnet-5-5"
    pen = os.environ.get("HOLDINGS_MODEL_PEN") or "claude-opus-5-5"
    return {"work": work, "pen": pen, "verify": os.environ.get("HOLDINGS_MODEL_VERIFY") or pen}


def roles_for(preset_id):
    """The model for each role. A missing or unknown preset means Auto."""
    p = BY_ID.get(preset_id) if isinstance(preset_id, str) else None
    if p and "model" in p:
        return {r: p["model"] for r in ROLES}
    return _auto()


def preset_name(preset_id):
    p = BY_ID.get(preset_id) if isinstance(preset_id, str) else None
    if not p:
        return None
    return label(p["model"]) if "model" in p else "Auto"


def find(model_id, available):
    """The id the API lists for this model; an alias matches its dated snapshot. None if not listed."""
    if not available:
        return None
    if model_id in available:
        return model_id
    prefix = model_id + "-"
    return next((a for a in available if a.startswith(prefix) and re.fullmatch(r"\d{8}", a[len(prefix):])), None)


def supports_effort(model_id, available):
    """False only when the API says this model rejects the effort setting."""
    listed = find(model_id, available)
    return listed is None or available[listed] is not False


# Words, not multiples, and a price per word rather than a bill: a demand's bill also depends on how much
# research each model chooses to do (Haiku's whole demand cost 90% of Sonnet's despite a 1/20 token price).
# The Work tab shows what each demand actually cost.
COST_TIERS = ("lowest", "standard", "higher", "highest")


def _tier(model_id):
    """Where this model's token price sits against Sonnet's."""
    r = cost._price(model_id)[0] / cost._price(BASELINE)[0]
    return 0 if r < 0.5 else 1 if r < 1.5 else 2 if r < 3 else 3


def _cost_note(used):
    tiers = sorted({_tier(m) for m in used})
    if len(tiers) == 1:
        return f"{COST_TIERS[tiers[0]].capitalize()} price per word"
    return f"{COST_TIERS[tiers[0]].capitalize()} to {COST_TIERS[tiers[-1]]} price per word"


def _summary(roles):
    by_model = {}
    for role in ROLES:
        by_model.setdefault(roles[role], []).append(ROLE_LABEL[role])
    if len(by_model) == 1:
        return f"Everything runs on {label(roles['work'])}."
    return " · ".join(f"{' and '.join([names[0]] + [n.lower() for n in names[1:]])}: {label(m)}" for m, names in by_model.items())


def _entry(p):
    roles = roles_for(p["id"])
    return {"id": p["id"], "name": preset_name(p["id"]), "badge": p.get("badge", ""), "tagline": p["tagline"],
            "cost": _cost_note(roles.values()), "summary": _summary(roles),
            "roles": [{"role": r, "label": ROLE_LABEL[r], "model": roles[r], "name": label(roles[r])} for r in ROLES]}


def available_presets(available=None):
    """Presets whose every model is listed for this key. available=None means the list is unknown: offer all."""
    return [p for p in PRESETS if available is None or all(find(m, available) for m in set(roles_for(p["id"]).values()))]


def catalog(available=None):
    return [_entry(p) for p in available_presets(available)]


def validate(preset_id, available=None):
    """Return the preset id to store, or raise ValueError with a message Rafael can read."""
    pid = DEFAULT_PRESET if preset_id in (None, "") else preset_id
    if not isinstance(pid, str) or pid not in BY_ID:
        raise ValueError("Unknown model choice.")
    if pid not in {p["id"] for p in available_presets(available)}:
        raise ValueError(f"{preset_name(pid)} is not available on this account right now. Choose another model.")
    return pid


def ran_on(rows):
    """Model labels a job actually used, biggest spend first. rows: [{model, usd}] from the usage table."""
    out = []
    for r in sorted(rows, key=lambda r: -(r.get("usd") or 0)):
        name = label(r.get("model"))
        if name and name not in out:
            out.append(name)
    return out
