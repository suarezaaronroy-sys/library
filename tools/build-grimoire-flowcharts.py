#!/usr/bin/env python3
"""Extract the flowcharts *taught inside* the Grimoires into editable Whiteboard
boards -> _data/grimoire_flowcharts.json.

Two sources per grimoire:
  1. Mermaid diagrams (<pre> starting with graph/flowchart) — parsed into
     nodes + edges with decision branches preserved.
  2. .flow step-sequences (<div class="flow"> of <div class="flow-step">) —
     each becomes a linear board labelled by its <h4> steps.

Every board is associated with the nearest preceding section anchor, so it
carries a title node that deep-links back to where the flowchart is taught.

Re-run after editing a grimoire:  python3 tools/build-grimoire-flowcharts.py
"""
import json, re, html as ihtml
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "_data" / "grimoire_flowcharts.json"
SECTIONS = json.loads((ROOT / "_data" / "grimoire_sections.json").read_text(encoding="utf-8"))

def grimoire_meta():
    text = (ROOT / "_data" / "grimoires.yml").read_text(encoding="utf-8")
    meta, cur = {}, None
    for line in text.splitlines():
        m = re.match(r'- num: "(\d+)"', line.strip())
        if m: cur = {"num": m.group(1)}
        elif cur is not None:
            for key in ("title", "href", "status"):
                mm = re.match(rf'{key}: (.+)', line.strip())
                if mm: cur[key] = mm.group(1).strip().strip('"')
            if cur.get("status") and cur.get("href"): meta[cur["num"]] = cur
    return meta

def clean(text):
    text = re.sub(r'<br\s*/?>', ' ', text, flags=re.I)
    text = re.sub(r'<[^>]+>', '', text)
    return re.sub(r'\s+', ' ', ihtml.unescape(text)).strip()

# ---------- section association ----------
def anchor_index(doc, valid):
    """positions of id="anchor" for anchors known in grimoire_sections."""
    out = []
    for m in re.finditer(r'\bid="([A-Za-z][\w-]*)"', doc):
        if m.group(1) in valid:
            out.append((m.start(), m.group(1)))
    return out

def nearest_anchor(pos, idx):
    best = None
    for at, anc in idx:
        if at <= pos: best = anc
        else: break
    return best

# ---------- mermaid parser ----------
SHAPE = re.compile(r'(\[\[.*?\]\]|\[\(.*?\)\]|\(\(.*?\)\)|\(\[.*?\]\)|\[.*?\]|\{.*?\}|\(.*?\))')
NODE_HEAD = re.compile(r'^([A-Za-z0-9_]+)\s*')
EDGE_OP = re.compile(r'^\s*(-\.->|-->|===>|==>|---|--)\s*(?:\|([^|]*)\||"([^"]*)")?\s*')

def shape_type(shape):
    if not shape: return "action"
    if shape.startswith("{"): return "condition"
    if shape.startswith("([") or shape.startswith("(("): return "trigger"
    if shape.startswith("[(") or shape.startswith("[["): return "database"
    if shape.startswith("("): return "note"
    return "action"

def parse_mermaid(src):
    lines = [l.rstrip() for l in src.splitlines()]
    direction = "TD"
    nodes, edges = {}, []
    for raw in lines:
        line = raw.strip()
        if not line: continue
        m = re.match(r'(?:graph|flowchart)\s+(LR|RL|TD|TB|BT)', line, re.I)
        if m: direction = m.group(1).upper(); continue
        if re.match(r'(subgraph|end|classDef|class |style |click |%%|linkStyle|direction)', line): continue
        # walk node/edge/node...
        pos, last = 0, None
        s = line
        def take_node(s, pos):
            mh = NODE_HEAD.match(s[pos:])
            if not mh: return None, pos
            nid = mh.group(1); pos += mh.end()
            ms = SHAPE.match(s[pos:])
            label = None
            if ms:
                inner = ms.group(1)
                label = re.sub(r'^[\[\({]+|[\]\)}]+$', '', inner).strip().strip('"')
                nodes.setdefault(nid, {"label": clean(label) or nid, "type": shape_type(ms.group(1))})
                pos += ms.end()
            else:
                nodes.setdefault(nid, {"label": nid, "type": "action"})
            return nid, pos
        nid, pos = take_node(s, pos)
        if nid is None: continue
        last = nid
        while pos < len(s):
            me = EDGE_OP.match(s[pos:])
            if not me: break
            label = (me.group(2) or me.group(3) or "").strip().strip('"')
            pos += me.end()
            nxt, pos = take_node(s, pos)
            if nxt is None: break
            edges.append((last, nxt, clean(label)))
            last = nxt
    return direction, nodes, edges

# ---------- layered layout (ignores back-edges for ranking) ----------
def layout(direction, nodes, edges):
    ids = list(nodes.keys())
    adj = {i: [] for i in ids}
    indeg = {i: 0 for i in ids}
    for a, b, _ in edges:
        if a in adj and b in indeg:
            adj[a].append(b); indeg[b] += 1
    # rank via BFS from roots; nodes in cycles get first-visit rank
    from collections import deque
    rank = {}
    roots = [i for i in ids if indeg[i] == 0] or ids[:1]
    dq = deque((r, 0) for r in roots)
    for r in roots: rank[r] = 0
    while dq:
        n, r = dq.popleft()
        for m in adj[n]:
            if m not in rank:
                rank[m] = r + 1; dq.append((m, r + 1))
    for i in ids: rank.setdefault(i, 0)
    # order within rank
    buckets = {}
    for i in ids: buckets.setdefault(rank[i], []).append(i)
    MAIN, CROSS = 300, 150
    pos = {}
    for r, group in buckets.items():
        for j, i in enumerate(group):
            if direction in ("LR", "RL"):
                pos[i] = (140 + r * MAIN, 160 + j * CROSS)
            else:
                pos[i] = (160 + j * MAIN, 140 + r * CROSS)
    return pos

def board_from_mermaid(num, meta, anchor, src, seq):
    direction, nodes, edges = parse_mermaid(src)
    if len(nodes) < 2: return None
    pos = layout(direction, nodes, edges)
    link, piece = resolve(num, meta, anchor)
    out_nodes = []
    for nid, nd in nodes.items():
        x, y = pos[nid]
        out_nodes.append({"id": nid, "type": nd["type"], "title": nd["label"], "x": x, "y": y,
                          "link": link})
    out_edges = [[a, b, lbl] for (a, b, lbl) in edges]
    label = f"G{num} · {piece} — flow {seq}"
    return {"id": f"gflow-{num}-m{seq}", "label": label[:70],
            "note": f"A flowchart from {meta['title'].split(':')[0]} ({len(nodes)} nodes).",
            "grimoireId": f"grimoire-{num}", "href": meta["href"],
            "nodes": out_nodes, "edges": out_edges}

# ---------- .flow step sequences ----------
def board_from_flow(num, meta, anchor, steps, seq, kind="steps"):
    if len(steps) < 2: return None
    link, piece = resolve(num, meta, anchor)
    COLS = 4; DX, DY = 300, 165
    nodes, edges = [], []
    for i, label in enumerate(steps):
        t = "trigger" if i == 0 else ("condition" if label.rstrip().endswith("?") else "action")
        nodes.append({"id": f"s{i}", "type": t, "title": label[:52], "x": 140 + (i % COLS) * DX,
                      "y": 200 + (i // COLS) * DY, "link": link})
        if i: edges.append([f"s{i-1}", f"s{i}", ""])
    label = f"G{num} · {piece} — {kind} {seq}"
    return {"id": f"gflow-{num}-s{seq}", "label": label[:70],
            "note": f"A step sequence from {meta['title'].split(':')[0]} ({len(steps)} steps).",
            "grimoireId": f"grimoire-{num}", "href": meta["href"],
            "nodes": nodes, "edges": edges}

SEC_TITLES = {}
VALID_ANCHORS = {}
GRIMOIRE_SHORT = {}
def sec_title(num, anchor):
    return SEC_TITLES.get((num, anchor), anchor)
def resolve(num, meta, anchor):
    """-> (link_url, label_piece). Falls back to the grimoire top when the
    anchor isn't a real section (e.g. grimoires with no section ids)."""
    href = meta["href"]
    if anchor and anchor in VALID_ANCHORS.get(num, set()):
        return f"{href}#{anchor}", sec_title(num, anchor)
    return href, GRIMOIRE_SHORT.get(num, f"G{num}")

def main():
    meta = grimoire_meta()
    for e in SECTIONS:
        SEC_TITLES[(e["num"], e["anchor"])] = re.sub(r'^(CH\d+|Chapter \d+|M\d+|P\d+|Part \d+)\s*[·:.-]?\s*', '', e["title"]).strip() or e["title"]
    valid_by_num = {}
    for e in SECTIONS: valid_by_num.setdefault(e["num"], set()).add(e["anchor"])
    VALID_ANCHORS.update(valid_by_num)
    for num, mm in meta.items():
        GRIMOIRE_SHORT[num] = re.sub(r'\s+', ' ', mm.get("title", f"G{num}").split(":")[0]).strip()[:34]
    boards = []
    for f in sorted((ROOT / "grimoires").glob("0*.html")):
        num = f.name[:3]
        m = meta.get(num)
        if not m or m.get("status") != "live": continue
        if num in ("001", "002"): continue  # hand-authored as curated framework maps
        doc = f.read_text(encoding="utf-8", errors="replace")
        idx = anchor_index(doc, valid_by_num.get(num, set()))
        # mermaid
        seq = 0
        for pm in re.finditer(r'<pre[^>]*>(.*?)</pre>', doc, re.S):
            body = ihtml.unescape(re.sub(r'<[^>]+>', '', pm.group(1)))
            if not re.match(r'\s*(graph|flowchart)\s', body): continue
            seq += 1
            anc = nearest_anchor(pm.start(), idx) or (idx[0][1] if idx else "top")
            b = board_from_mermaid(num, m, anc, body, seq)
            if b: boards.append(b)
        # .fl item sequences (G001 style) — fl-dot marker + fl-t title,
        # grouped when the marker restarts or switches numeric<->non-numeric
        fl_items = []
        for fm in re.finditer(r'<div class="fl-dot[^"]*">([^<]*)</div><div><div class="fl-t">(.*?)</div>', doc, re.S):
            marker = fm.group(1).strip()
            label = clean(fm.group(2))
            if label: fl_items.append((marker, label, fm.start()))
        def is_num(tok): return bool(re.fullmatch(r'\d+', tok))
        fl_groups, cur, prev = [], [], None
        for marker, label, pos in fl_items:
            new = marker == "1" or (prev is not None and is_num(marker) != is_num(prev))
            if new and cur: fl_groups.append(cur); cur = []
            cur.append((marker, label, pos)); prev = marker
        if cur: fl_groups.append(cur)
        for gseq, group in enumerate(fl_groups, 1):
            steps = [label for _, label, _ in group]
            if len(steps) < 2: continue
            anc = nearest_anchor(group[0][2], idx) or (idx[0][1] if idx else "top")
            b = board_from_flow(num, m, anc, steps, 100 + gseq)
            if b: boards.append(b)

        # pipeline-flow (G002 style) — a horizontal funnel of pf-box nodes.
        # Skip the first hit (the CSS definition inside <style>); use real
        # container positions so the section association is correct.
        pipe_hits = [pmatch for pmatch in re.finditer(r'<div class="pipeline-flow"', doc)]
        for pseq, pmatch in enumerate(pipe_hits, 1):
            chunk = doc[pmatch.start():pmatch.start() + 1600]
            boxes = [clean(x) for x in re.findall(r'class="pf-box[^"]*"[^>]*>(.*?)</div>', chunk, re.S)]
            boxes = [b for b in boxes if b]
            if len(boxes) < 2: continue
            anc = nearest_anchor(pmatch.start(), idx) or (idx[0][1] if idx else "top")
            b = board_from_flow(num, m, anc, boxes, 200 + pseq, kind="pipeline")
            if b: boards.append(b)

        # .flow step sequences — collect flow-steps, split on num reset to 1
        items = []
        for fm in re.finditer(r'<div class="flow-step">\s*<div class="flow-step-num">(\d+)</div>\s*<div class="flow-step-content">(.*?)</div>\s*</div>', doc, re.S):
            n = int(fm.group(1)); content = fm.group(2)
            lm = re.search(r'<(h4|h3|strong|b)[^>]*>(.*?)</\1>', content, re.S)
            label = clean(lm.group(2)) if lm else clean(content)
            if label: items.append((n, label, fm.start()))
        groups, cur = [], []
        for n, label, pos in items:
            if n == 1 and cur: groups.append(cur); cur = []
            cur.append((n, label, pos))
        if cur: groups.append(cur)
        for fseq, group in enumerate(groups, 1):
            steps = [label for _, label, _ in group]
            if len(steps) < 2: continue
            anc = nearest_anchor(group[0][2], idx) or (idx[0][1] if idx else "top")
            b = board_from_flow(num, m, anc, steps, fseq)
            if b: boards.append(b)
    boards.sort(key=lambda x: x["id"])
    OUT.write_text(json.dumps(boards, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    by_g = {}
    for b in boards: by_g[b["id"].split("-")[1]] = by_g.get(b["id"].split("-")[1], 0) + 1
    print(f"wrote {len(boards)} flowchart boards ({sum(len(b['nodes']) for b in boards)} nodes) -> {OUT.name}")
    print(" ", ", ".join(f"G{k}:{v}" for k, v in sorted(by_g.items())))

if __name__ == "__main__":
    main()
