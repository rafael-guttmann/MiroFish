#!/usr/bin/env python3
"""Search Daniel W. Dippold's public words (book, paper, blog and LinkedIn posts, EWOR articles, his podcast turns)
and what others wrote about him. Standard library only; runs anywhere with Python 3.8+.

  python3 search.py "how do you pick founders"            top 8 passages of his own words
  python3 search.py "Gründer auswählen" --k 5              German works too (half his podcasts are German)
  python3 search.py "fundraising round size" --kind spoken  only podcasts (or: written, about, all)
  python3 search.py "EWOR founded" --about                 also show 3 passages written ABOUT him (facts only)
  python3 search.py --id V812 --around 1                   one passage in full, with its neighbours
  python3 search.py --stats                                what the corpus holds

Ids: V.. = his own words, A.. = written about him by others. Data: ../data/dani_chunks.jsonl (or $DANI_DATA)."""
import argparse, json, math, os, re, sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get("DANI_DATA") or os.path.join(HERE, "..", "data", "dani_chunks.jsonl")
STOP = set("""a an and are as at be been but by can could do does did for from had has have how i if in into is it its me my of on or
our so that the their them then there these they this to us was we what when where which who why will with would you your
about just like really also very much more most some any all one get got make made think know want need thing things lot
der die das und ist ein eine einen zu den dem des nicht mit sich auf für von wie was wir ich es im in an als auch du ja
so dass da hat haben habe wird werden oder aber wenn man noch nur schon mal also sehr dann""".split())

def stem(w):
    # light suffix stripping so "rounds"/"round", "raising"/"raise", "founders"/"founder" meet
    if len(w) > 5 and w.endswith("ies"): return w[:-3] + "y"
    if len(w) > 5 and w.endswith("ing"): return w[:-3]
    if len(w) > 4 and w.endswith("ed"): return w[:-2]
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss"): return w[:-1]
    return w

def tok(s):
    return [stem(w) for w in re.findall(r"\w+", s.lower()) if w not in STOP and len(w) > 1]

def load():
    with open(DATA, encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]

def TEAM(r): return r.get("src", "").startswith("raw/text/ewor-team/")

def where(r):
    if r["kind"] == "spoken":
        return "podcast · {} · \"{}\" · {} · at {}{}".format(r.get("show") or "?", r["title"], r.get("date") or "undated", r.get("at", "?"),
                                                           " · in German" if r.get("lang") == "de" else "")
    if r["kind"] == "about": label = "written by others ABOUT him (facts only, not his words)"
    elif TEAM(r): label = "EWOR team article (generic house style; counts as his voice, weigh below his own words)"
    else: label = "written by him"
    return "{} · \"{}\" · {}".format(label, r["title"], r.get("date") or "undated")

def show(r, full=False, cover=None):
    head = "[{}] {}".format(r["id"], where(r)) + ("" if cover is None else " · match {}".format("strong" if cover >= 0.45 else "weak"))
    out = [head]
    if r.get("asked"):
        out.append("  previous speaker (interviewer or guest, NOT his words): \"…{}\"".format(r["asked"][-200:].strip()))
    text = r["text"] if full else (r["text"][:1400] + ("…" if len(r["text"]) > 1400 else ""))
    out.append("  " + text.replace("\n", "\n  "))
    if r.get("url") and full: out.append("  url: " + r["url"])
    return "\n".join(out)

def bm25(rows, q, k1=1.5, b=0.75):
    docs = [tok(r.get("title", "") + " " + r.get("asked", "")[-200:] + " " + r["text"]) for r in rows]
    N = len(docs); avg = sum(map(len, docs)) / max(N, 1)
    df = Counter(w for d in docs for w in set(d))
    qt = list(dict.fromkeys(tok(q)))
    idf = {w: math.log(1 + (N - df.get(w, 0) + 0.5) / (df.get(w, 0) + 0.5)) for w in qt}
    phrases = [p.lower() for p in re.findall(r'"([^"]+)"', q)]
    scores = []
    for r, d in zip(rows, docs):
        tf = Counter(d); s = 0.0; hit = 0.0
        for w in qt:
            f = tf.get(w, 0)
            if f: hit += idf[w]; s += idf[w] * f * (k1 + 1) / (f + k1 * (1 - b + b * len(d) / avg))
        low = r["text"].lower()
        s += sum(3.0 for p in phrases if p in low)
        if TEAM(r): s *= 0.75   # his own words first; team articles fill gaps
        scores.append((s, hit / max(sum(idf.values()), 1e-9)))   # share of the query's rare-word weight found
    return scores

def main():
    ap = argparse.ArgumentParser(description="Search Daniel Dippold's public words.")
    ap.add_argument("query", nargs="?", default="")
    ap.add_argument("--k", type=int, default=8)
    ap.add_argument("--kind", default="voice", choices=["voice", "spoken", "written", "about", "all"])
    ap.add_argument("--about", action="store_true", help="also list 3 passages written about him")
    ap.add_argument("--lang", choices=["en", "de"])
    ap.add_argument("--id"); ap.add_argument("--around", type=int, default=0)
    ap.add_argument("--full", action="store_true"); ap.add_argument("--stats", action="store_true")
    a = ap.parse_args()
    rows = load()
    if a.stats:
        c = Counter((r["kind"], r.get("show") or "") for r in rows)
        print("passages:", len(rows)); [print(" ", k[0], k[1], n) for k, n in sorted(c.items())]
        return
    if a.id:
        idx = {r["id"]: i for i, r in enumerate(rows)}
        if a.id not in idx: sys.exit("no passage " + a.id)
        i = idx[a.id]; src = rows[i]["src"]
        for j in range(i - a.around, i + a.around + 1):
            if 0 <= j < len(rows) and rows[j]["src"] == src:
                print(show(rows[j], full=True)); print()
        return
    if not a.query.strip(): sys.exit("give a query, --id or --stats")
    def pool(kinds):
        return [r for r in rows if r["kind"] in kinds and (not a.lang or r.get("lang") == a.lang)]
    kinds = {"voice": ("spoken", "written"), "spoken": ("spoken",), "written": ("written",), "about": ("about",),
             "all": ("spoken", "written", "about")}[a.kind]
    p = pool(kinds); sc = bm25(p, a.query)
    best = sorted(range(len(p)), key=lambda i: -sc[i][0])
    hits = [i for i in best if sc[i][0] > 0][:a.k]
    if not hits:
        print("NO MATCH in his words for: {!r}. Try other words, a German phrasing, or treat the topic as off-record.".format(a.query))
    for i in hits:
        print(show(p[i], full=a.full, cover=sc[i][1])); print()
    if a.about and a.kind != "about":
        pa = pool(("about",)); sa = bm25(pa, a.query)
        top = [i for i in sorted(range(len(pa)), key=lambda i: -sa[i][0]) if sa[i][0] > 0][:3]
        if top: print("--- written ABOUT him (facts and dates only) ---\n")
        for i in top: print(show(pa[i], full=a.full, cover=sa[i][1])); print()

if __name__ == "__main__":
    main()
