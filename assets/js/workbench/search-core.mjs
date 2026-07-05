// search-core.mjs — scoring engine for universal site search.
// Pure functions, no DOM. Tested in tests/site-search-core.test.mjs.

export function tokenize(query) {
  return String(query).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function fieldWords(value) {
  return String(value || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

// Levenshtein distance capped at 1 — cheap typo tolerance.
export function withinOneEdit(a, b) {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i += 1; j += 1; continue; }
    if (edits) return false;
    edits = 1;
    if (la > lb) i += 1;
    else if (lb > la) j += 1;
    else { i += 1; j += 1; }
  }
  return edits + (la - i) + (lb - j) <= 1;
}

const FIELD_WEIGHTS = [
  ["name", 10],
  ["tags", 5],
  ["breadcrumb", 3],
  ["category", 3],
  ["description", 2],
  ["content", 1]
];

// Score one entry against pre-tokenized query words.
function scoreTokens(entry, tokens) {
  const cache = {};
  const words = (field) => {
    if (!cache[field]) {
      const raw = field === "tags" ? (entry.tags || []).join(" ") : entry[field];
      cache[field] = fieldWords(raw);
    }
    return cache[field];
  };
  let total = 0;
  let matched = 0;
  for (const token of tokens) {
    let best = 0;
    for (const [field, weight] of FIELD_WEIGHTS) {
      for (const word of words(field)) {
        if (word === token) { best = Math.max(best, weight * 2); }
        else if (word.startsWith(token)) { best = Math.max(best, weight); }
        else if (token.length >= 5 && field === "name" && withinOneEdit(word, token)) {
          best = Math.max(best, 3);
        }
      }
      if (best >= weight * 2) break; // exact hit at this weight tier — done
    }
    if (best) { matched += 1; total += best; }
  }
  if (matched === tokens.length && words("name").join(" ") === tokens.join(" ")) total += 8;
  return { total, matched };
}

// Strict scoring: every token must land somewhere (typo-tolerant on name).
export function scoreEntry(entry, tokens) {
  if (!tokens.length) return 0;
  const { total, matched } = scoreTokens(entry, tokens);
  return matched === tokens.length ? total : 0;
}

// Strict pass first; when nothing matches every word, fall back to
// closest matches — most words matched wins, then score.
export function searchWithMeta(entries, query, limit = 40) {
  const tokens = tokenize(query);
  if (!tokens.length) return { results: [], partial: false };
  const strict = rank(entries, tokens, limit, tokens.length);
  if (strict.length) return { results: strict, partial: false };
  const minimum = Math.max(1, Math.ceil(tokens.length / 2));
  return { results: rank(entries, tokens, limit, minimum), partial: true };
}

function rank(entries, tokens, limit, minimumMatched) {
  return entries
    .map((entry) => ({ entry, ...scoreTokens(entry, tokens) }))
    .filter((item) => item.matched >= minimumMatched && item.total > 0)
    .sort((a, b) => b.matched - a.matched || b.total - a.total
      || String(a.entry.name).localeCompare(String(b.entry.name)))
    .slice(0, limit)
    .map((item) => item.entry);
}

export function searchEntries(entries, query, limit = 40) {
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  return rank(entries, tokens, limit, tokens.length);
}

// Context snippet around the first matched token in long text.
export function makeSnippet(text, tokens, radius = 70) {
  const value = String(text || "");
  const lower = value.toLowerCase();
  let hit = -1;
  for (const token of tokens) {
    const index = lower.indexOf(token);
    if (index !== -1 && (hit === -1 || index < hit)) hit = index;
  }
  if (hit === -1) return "";
  const start = Math.max(0, hit - radius);
  const end = Math.min(value.length, hit + radius * 2);
  return (start > 0 ? "…" : "") + value.slice(start, end).trim() + (end < value.length ? "…" : "");
}

// Wrap matched tokens in <mark> — input must already be HTML-escaped.
export function highlight(escapedText, tokens) {
  if (!tokens.length) return escapedText;
  const pattern = tokens
    .filter((token) => /^[a-z0-9]+$/.test(token))
    .sort((a, b) => b.length - a.length)
    .join("|");
  if (!pattern) return escapedText;
  return escapedText.replace(new RegExp(`(${pattern})`, "gi"), "<mark>$1</mark>");
}

export const GROUP_ORDER = ["Site", "Workbench", "Grimoires", "Notes", "Changelog", "Resources"];

export function groupKey(entry) {
  if (entry.kind === "note") return "Notes";
  if (entry.kind === "grimoire-section") return "Grimoires";
  if (entry.kind === "changelog") return "Changelog";
  if (entry.id && entry.id.startsWith("grimoire-")) return "Grimoires";
  if (entry.id && entry.id.startsWith("site-")) return "Site";
  if (entry.kind === "external") return "Resources";
  return "Workbench";
}

// Interleave grouped results: cap per group, preserve score order inside groups.
export function groupResults(entries, perGroup = 6) {
  const groups = new Map();
  for (const entry of entries) {
    const key = groupKey(entry);
    if (!groups.has(key)) groups.set(key, []);
    const bucket = groups.get(key);
    if (bucket.length < perGroup) bucket.push(entry);
  }
  return GROUP_ORDER.filter((key) => groups.has(key)).map((key) => ({ label: key, items: groups.get(key) }));
}
