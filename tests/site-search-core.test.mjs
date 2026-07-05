import test from "node:test";
import assert from "node:assert/strict";
import {
  groupKey,
  groupResults,
  highlight,
  makeSnippet,
  scoreEntry,
  searchEntries,
  tokenize,
  withinOneEdit
} from "../assets/js/workbench/search-core.mjs";

const entries = [
  { id: "site-home", name: "Home", url: "/", kind: "internal", category: "Site", description: "Front page", tags: ["home"] },
  { id: "note-automation-trap", name: "The Automation Trap", url: "/notes/automation-trap/", kind: "note", category: "Notes", description: "Automation amplifies what's already there.", tags: ["note"], content: "If the process is broken, automation just breaks it faster and at scale. Fix the process first." },
  { id: "/grimoires/005-zapier-101.html#m18", name: "M18 · Task economy", url: "/grimoires/005-zapier-101.html#m18", kind: "grimoire-section", category: "Grimoires", description: "Zapier 101", tags: ["grimoire", "section", "g005"] },
  { id: "billing", name: "Billing Workspace", url: "/workbench/billing/", kind: "internal", category: "Workbench", description: "Invoice calendar and calculators", tags: ["invoice", "billing"] },
  { id: "changelog-3.5", name: "v3.5 — QA hardening", url: "/", kind: "changelog", category: "Changelog", description: "Full audit then fixes.", tags: ["changelog"] }
];

test("tokenize splits and lowercases", () => {
  assert.deepEqual(tokenize("Task-Economy  ZAPIER"), ["task", "economy", "zapier"]);
});

test("withinOneEdit accepts single typo, rejects two", () => {
  assert.equal(withinOneEdit("billing", "biling"), true);
  assert.equal(withinOneEdit("billing", "bling"), false);
  assert.equal(withinOneEdit("same", "same"), true);
});

test("exact name outranks content match", () => {
  const hits = searchEntries(entries, "automation");
  assert.equal(hits[0].id, "note-automation-trap");
});

test("content-only phrase finds the note", () => {
  const hits = searchEntries(entries, "breaks it faster");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].kind, "note");
});

test("every token must match somewhere", () => {
  assert.equal(searchEntries(entries, "billing zebra").length, 0);
});

test("typo in name still matches", () => {
  const hits = searchEntries(entries, "billng workspace");
  assert.equal(hits[0]?.id, "billing");
});

test("grimoire section matches by tag and name", () => {
  const hits = searchEntries(entries, "g005");
  assert.equal(hits[0].kind, "grimoire-section");
  assert.equal(searchEntries(entries, "task economy")[0].kind, "grimoire-section");
});

test("scoreEntry returns 0 for empty tokens", () => {
  assert.equal(scoreEntry(entries[0], []), 0);
});

test("snippet centers on first hit and adds ellipses", () => {
  const snippet = makeSnippet(entries[1].content, ["faster"]);
  assert.ok(snippet.includes("faster"));
  assert.ok(snippet.startsWith("…") || snippet.startsWith("If"));
});

test("highlight wraps matches post-escape", () => {
  assert.equal(highlight("Billing tools", ["billing"]), "<mark>Billing</mark> tools");
  assert.equal(highlight("a &amp; b", ["zzz"]), "a &amp; b");
});

test("groups map kinds to labels in stable order", () => {
  assert.equal(groupKey(entries[1]), "Notes");
  assert.equal(groupKey(entries[2]), "Grimoires");
  const grouped = groupResults(entries);
  assert.deepEqual(grouped.map((g) => g.label), ["Site", "Workbench", "Grimoires", "Notes", "Changelog"]);
});

test("partial fallback: unmatched extra word degrades instead of dead-ending", async () => {
  const { searchWithMeta } = await import("../assets/js/workbench/search-core.mjs");
  const strict = searchWithMeta(entries, "billing workspace");
  assert.equal(strict.partial, false);
  const fallback = searchWithMeta(entries, "billing zebra");
  assert.equal(fallback.partial, true);
  assert.equal(fallback.results[0].id, "billing");
  const nothing = searchWithMeta(entries, "zzz qqq");
  assert.equal(nothing.results.length, 0);
});
