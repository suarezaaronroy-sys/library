import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, slug, money, number } from "../assets/js/workbench/utils.mjs";

test("escapeHtml covers all five characters and is null-safe", () => {
  assert.equal(escapeHtml(`<a href="x" data='y'>&`), "&lt;a href=&quot;x&quot; data=&#39;y&#39;&gt;&amp;");
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
  assert.equal(escapeHtml(0), "0");
});

test("slug normalizes and falls back", () => {
  assert.equal(slug("Hello, World!"), "hello-world");
  assert.equal(slug("  --Trim-- "), "trim");
  assert.equal(slug(""), "untitled");
  assert.equal(slug(null, "budget"), "budget");
});

test("money and number format safely", () => {
  assert.equal(money(1234.5), "1,234.50");
  assert.equal(money("bad"), "0.00");
  assert.equal(number(1234.56), "1,234.6");
  assert.equal(number(null), "0");
});
