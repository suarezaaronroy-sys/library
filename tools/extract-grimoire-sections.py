#!/usr/bin/env python3
"""Extract section anchors from grimoire HTML files into _data/grimoire_sections.json.

Grimoires are self-contained HTML that Jekyll copies verbatim, so their
internal structure is invisible to Liquid. This script scans each file for
anchorable sections (<section id=...>, <h2/h3 id=...>) and records them so
site search can offer jump-to-section results.

Re-run after adding or editing any grimoire:
    python3 tools/extract-grimoire-sections.py
Only grimoires with status "live" in _data/grimoires.yml are included.
"""
import json, re, sys, html
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GRIMOIRES = ROOT / "grimoires"
OUT = ROOT / "_data" / "grimoire_sections.json"

TAG_RE = re.compile(r'<(section|h2|h3|div)\b([^>]*)\bid="([a-zA-Z][\w-]*)"([^>]*)>', re.I)
HEAD_RE = re.compile(r'<h[1-6][^>]*>(.*?)</h[1-6]>', re.I | re.S)
MODULE_TITLE_RE = re.compile(r'class="module-title"[^>]*>(.*?)</', re.I | re.S)
MODULE_NUM_RE = re.compile(r'class="module-num"[^>]*>(.*?)</', re.I | re.S)
STRIP = re.compile(r'<[^>]+>')

def live_hrefs():
    text = (ROOT / "_data" / "grimoires.yml").read_text(encoding="utf-8")
    entries, cur = [], None
    for line in text.splitlines():
        m = re.match(r'- num: "(\d+)"', line.strip())
        if m:
            cur = {"num": m.group(1)}; entries.append(cur)
            continue
        if cur is not None:
            for key in ("title", "href", "status"):
                m = re.match(rf'{key}: (.+)', line.strip())
                if m:
                    cur[key] = m.group(1).strip().strip('"')
    return {e["href"]: e for e in entries if e.get("status") == "live" and e.get("href")}

def clean(text):
    text = STRIP.sub("", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip(" ⭐️*#").strip()

def label_for(match, body):
    attrs = match.group(2) + match.group(4)
    aria = re.search(r'aria-label="([^"]+)"', attrs)
    if aria:
        return aria.group(1)
    if match.group(1).lower() in ("h2", "h3"):
        end = body.find(">", match.end()) + 1
        close = body.find("</", end)
        text = clean(body[end:close]) if close > end else ""
        if text:
            return text
    window = body[match.end():match.end() + 2500]
    ch = re.search(r'class="chapter-num"[^>]*>(.*?)</', window, re.I | re.S)
    if ch:
        head2 = HEAD_RE.search(window)
        if head2:
            return clean(ch.group(1)) + " · " + clean(head2.group(1))
    mt = MODULE_TITLE_RE.search(window)
    head = HEAD_RE.search(window)
    pick, at = None, None
    if mt and (not head or mt.start() < head.start()):
        pick, at = clean(mt.group(1)), mt.start()
    elif head:
        pick, at = clean(head.group(1)), head.start()
    if pick:
        num = MODULE_NUM_RE.search(window[:at + 200])
        if num:
            tag = clean(num.group(1))
            if tag and tag.lower() not in pick.lower() and len(tag) <= 8:
                pick = tag + " · " + pick
        return pick
    return match.group(3).replace("-", " ").title()

def main():
    live = live_hrefs()
    out = []
    for f in sorted(GRIMOIRES.glob("0*.html")):
        href = f"/grimoires/{f.name}"
        meta = live.get(href)
        if not meta:
            continue
        body = f.read_text(encoding="utf-8", errors="replace")
        seen = set()
        for m in TAG_RE.finditer(body):
            anchor = m.group(3)
            if anchor in seen or anchor in ("top", "main", "main-content"):
                continue
            if m.group(1).lower() == "div" and "chapter" not in (m.group(2) + m.group(4)):
                continue  # divs only count when they are chapter containers
            seen.add(anchor)
            title = html.unescape(re.sub(r"\s+", " ", label_for(m, body)))[:90]
            out.append({"num": meta["num"], "grimoire": meta.get("title", ""),
                        "href": href, "anchor": anchor, "title": title})
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    counts = {}
    for e in out:
        counts[e["num"]] = counts.get(e["num"], 0) + 1
    print(f"wrote {len(out)} sections from {len(counts)} grimoires -> {OUT.name}")
    print(" ", ", ".join(f"G{k}:{v}" for k, v in sorted(counts.items())))

if __name__ == "__main__":
    sys.exit(main())
