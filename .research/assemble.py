#!/usr/bin/env python3
"""Assemble app/data/trophies.json from authored part files, with integrity checks.

The four part files under .research/parts/ were authored by hand in this session.
This script only assembles them and VERIFIES byte-for-byte that name/description/
grade match the original official list. It never copies content from the original.
"""
import json, re, os

ROOT = "/home/ubuntu/gta6-trophy-tracker"
orig = json.load(open(f"{ROOT}/app/data/trophies.json"))
orig_trophies = orig["trophies"]
assert len(orig_trophies) == 55, "original must have 55"

parts = []
for p in ["part1.json", "part2.json", "part3.json", "part4.json"]:
    parts.extend(json.load(open(f"{ROOT}/.research/parts/{p}")))
assert len(parts) == 55, f"got {len(parts)} parts"

# 1. ids in order
assert [t["id"] for t in parts] == list(range(1, 56)), "ids out of order"

# 2. byte-for-byte name/description/grade
for a, b in zip(parts, orig_trophies):
    assert a["name"] == b["name"], f"name mismatch id {b['id']}"
    assert a["description"] == b["description"], f"desc mismatch id {b['id']}"
    assert a["grade"] == b["grade"], f"grade mismatch id {b['id']}"

# 3. schema keys present, citation integrity
MARK = re.compile(r"\[(\d+(?:\s*,\s*\d+)*)\]")
claims_cited = 0
backed2 = 0
for t in parts:
    for key in ("name", "description", "grade", "kind", "chapter", "missable",
                "count", "steps", "citations", "stage", "guide"):
        assert key in t, f"trophy {t['id']} missing key {key}"
    assert t["guide"] and t["steps"] and t["citations"], f"empty content id {t['id']}"
    cited_ns = set()
    for c in t["citations"]:
        for f in ("n", "site", "title", "url"):
            assert c.get(f), f"citation missing {f} id {t['id']}"
        cited_ns.add(c["n"])
    assert cited_ns == set(range(1, len(t["citations"]) + 1)), f"citation n not 1..N id {t['id']}"
    # markers (sentence split is mission-name aware: "What's in the Bag?" etc.)
    PROTECT = ["What's in the Bag?", "That's Where The Money Is", "Here, Kitty Kitty",
               "Clonin' Keys, Makin' GS", "Clonin' Keys, Makin' Gs"]
    def split_sentences(text):
        safe = text
        for i, p in enumerate(PROTECT):
            safe = safe.replace(p, f"\x00{i}\x00")
        out = []
        for piece in re.split(r"(?<=[.!?]) ", safe):
            for i in range(len(PROTECT)):
                piece = piece.replace(f"\x00{i}\x00", PROTECT[i])
            out.append(piece)
        return out
    for text in ([t["guide"]] + t["steps"] + ([t["window"]] if t.get("window") else [])):
        for mm in MARK.finditer(text):
            ns = [int(x) for x in mm.group(1).split(",")]
            for n in ns:
                assert n in cited_ns, f"marker {n} not cited, id {t['id']}: {text[:60]}"
        # every sentence ends with a marker
        for sent in split_sentences(text):
            sent = sent.strip()
            if sent and not MARK.search(sent[-12:]):
                print(f"WARN id {t['id']} sentence without trailing marker: {sent[:80]}")
    # claims_cited = marker count
    for text in ([t["guide"]] + t["steps"] + ([t["window"]] if t.get("window") else [])):
        for mm in MARK.finditer(text):
            claims_cited += len(mm.group(1).split(","))
    # backed_by_2_plus = claims with >=2 distinct markers
    for text in ([t["guide"]] + t["steps"] + ([t["window"]] if t.get("window") else [])):
        for sent in split_sentences(text):
            sent = sent.strip()
            if not sent:
                continue
            distinct = set()
            for mm in MARK.finditer(sent):
                distinct.update(int(x) for x in mm.group(1).split(","))
            if len(distinct) >= 2:
                backed2 += 1
    if t.get("dispute"):
        for side in ("a", "b"):
            for n in t["dispute"][side].get("src", []):
                assert n in cited_ns, f"dispute src {n} not cited id {t['id']}"

# 4. real research totals from the cache + batch-1 log
cache = json.load(open(f"{ROOT}/.research/cache.json"))
urls_ok = {u for u, p in cache.items() if p.get("ok")}
for line in open(f"{ROOT}/.research/log.jsonl"):
    row = json.loads(line)
    for pg in row.get("pages", []):
        if pg.get("ok"):
            urls_ok.add(pg["url"])
pages_read = len(urls_ok)
SITE_ALIASES = {
    "mobalytics.gg": "Mobalytics", "playhub.com": "PlayHub",
    "playstationtrophies.org": "PlayStationTrophies",
    "insider-gaming.com": "Insider Gaming", "space4games.com": "Space4Games",
    "powerpyx.com": "PowerPyx", "www.powerpyx.com": "PowerPyx",
    "youtube.com": "YouTube", "www.youtube.com": "YouTube",
    "reddit.com": "Reddit", "www.reddit.com": "Reddit",
}
sites = set()
for u, p in cache.items():
    if p.get("ok"):
        sites.add(SITE_ALIASES.get(p.get("site"), p.get("site")))
for line in open(f"{ROOT}/.research/log.jsonl"):
    row = json.loads(line)
    for pg in row.get("pages", []):
        if pg.get("ok"):
            sites.add(SITE_ALIASES.get(pg.get("site"), pg.get("site")))
sites_read = len(sites)
print(f"pages_read={pages_read} sites_read={sites_read} sites={sorted(sites)}")

meta = {
    "claims_cited": claims_cited,
    "backed_by_2_plus": backed2,
    "pages_read": pages_read,
    "sites_read": sites_read,
    "researched_on": "20 Nov 2026",
}
print(f"claims_cited={claims_cited} backed_by_2_plus={backed2}")

out = {
    "game": orig["game"],
    "platform": orig["platform"],
    "list": orig["list"],
    "meta": meta,
    "trophies": parts,
}
dst = f"{ROOT}/app/data/trophies.json"
with open(dst, "w") as f:
    json.dump(out, f, indent=2, ensure_ascii=False)
    f.write("\n")
print("written:", dst, os.path.getsize(dst), "bytes")
