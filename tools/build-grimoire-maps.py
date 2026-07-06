#!/usr/bin/env python3
"""Generate a chapter-map per live Grimoire into _data/grimoire_maps_auto.json.

Each map is a reading path: a title node (opens the grimoire) followed by its
chapters laid out in a flowing grid, every node deep-linking to its section.
Grimoires with many sections are sampled evenly so the whole book is covered
without an unusable node count.

Re-run after adding/editing a grimoire (the update-search-index workflow can
call this too):  python3 tools/build-grimoire-maps.py
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SECTIONS = json.loads((ROOT / "_data" / "grimoire_sections.json").read_text(encoding="utf-8"))
OUT = ROOT / "_data" / "grimoire_maps_auto.json"
MAX_NODES = 16          # chapter cap per map (excludes the title node)
COLS = 4
DX, DY = 300, 165
X0, Y0 = 120, 260       # first chapter position (title sits above)

def grimoire_meta():
    text = (ROOT / "_data" / "grimoires.yml").read_text(encoding="utf-8")
    meta, cur = {}, None
    for line in text.splitlines():
        m = re.match(r'- num: "(\d+)"', line.strip())
        if m:
            cur = {"num": m.group(1)}
        elif cur is not None:
            for key in ("title", "href", "status"):
                m = re.match(rf'{key}: (.+)', line.strip())
                if m:
                    cur[key] = m.group(1).strip().strip('"')
            if cur.get("status") and cur.get("href"):
                meta[cur["num"]] = cur
    return meta

def sample(items, cap):
    if len(items) <= cap:
        return items
    # even spread, always keep first and last
    step = (len(items) - 1) / (cap - 1)
    idx = sorted({round(i * step) for i in range(cap)})
    return [items[i] for i in idx]

def short(title):
    return re.sub(r'\s+', ' ', title).strip()[:46]

def main():
    by_num = {}
    for e in SECTIONS:
        by_num.setdefault(e["num"], []).append(e)
    meta = grimoire_meta()
    maps = []
    for num, secs in by_num.items():
        m = meta.get(num)
        if not m or m.get("status") != "live":
            continue
        picked = sample(secs, MAX_NODES)
        gtitle = short(m["title"].split(":")[0])
        title_node = {
            "id": "g-title",
            "type": "document",
            "title": f"G{num} · {gtitle}",
            "x": X0, "y": Y0 - 150,
            "link": m["href"],           # grimoire top — opens in a new window
        }
        nodes = [title_node]
        for i, sec in enumerate(picked):
            nodes.append({
                "id": f"c{i}",
                "type": "grimoire",
                "title": short(sec["title"]),
                "x": X0 + (i % COLS) * DX,
                "y": Y0 + (i // COLS) * DY,
                "anchor": sec["anchor"],
            })
        edges = [["g-title", "c0", "open ↗"]]
        for i in range(len(picked) - 1):
            edges.append([f"c{i}", f"c{i+1}", ""])
        maps.append({
            "id": f"gmap-auto-{num}",
            "label": f"G{num} · {gtitle} — chapters",
            "note": f"Every chapter of {gtitle}, each opening its section. {len(picked)} of {len(secs)} sections.",
            "grimoireId": f"grimoire-{num}",
            "href": m["href"],
            "nodes": nodes,
            "edges": edges,
        })
    maps.sort(key=lambda x: x["id"])
    OUT.write_text(json.dumps(maps, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {len(maps)} chapter maps ({sum(len(m['nodes']) for m in maps)} nodes) -> {OUT.name}")

if __name__ == "__main__":
    main()
