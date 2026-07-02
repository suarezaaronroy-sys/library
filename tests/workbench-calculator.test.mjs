import test from "node:test";
import assert from "node:assert/strict";
import { evaluate, formatResult, CalcError } from "../assets/js/workbench/calculator-core.mjs";

test("operator precedence and parentheses", () => {
  assert.equal(evaluate("2 + 3 * 4"), 14);
  assert.equal(evaluate("(2 + 3) * 4"), 20);
  assert.equal(evaluate("10 - 2 - 3"), 5);
});

test("power is right associative and binds tighter than multiply", () => {
  assert.equal(evaluate("2 ^ 3 ^ 2"), 512);
  assert.equal(evaluate("2 * 3 ^ 2"), 18);
  assert.equal(evaluate("-3 ^ 2"), -9);
  assert.equal(evaluate("2 ^ -1"), 0.5);
});

test("unary minus and mixed signs", () => {
  assert.equal(evaluate("-5"), -5);
  assert.equal(evaluate("3 * -2"), -6);
  assert.equal(evaluate("3 + -2"), 1);
});

test("smart percent semantics", () => {
  assert.equal(evaluate("200 + 10%"), 220);
  assert.equal(evaluate("200 - 10%"), 180);
  assert.equal(evaluate("200 * 10%"), 20);
  assert.equal(evaluate("100 / 10%"), 1000);
  assert.equal(evaluate("50%"), 0.5);
});

test("constants, functions, and ans", () => {
  assert.equal(evaluate("sqrt(16)"), 4);
  assert.equal(evaluate("abs(-7)"), 7);
  assert.ok(Math.abs(evaluate("pi") - Math.PI) < 1e-12);
  assert.equal(evaluate("ans * 2", { ans: 21 }), 42);
  assert.equal(evaluate("ans + 1"), 1); // ans defaults to 0
});

test("grouped and spaced numbers are accepted", () => {
  assert.equal(evaluate("1,000 + 5"), 1005);
  assert.equal(evaluate("1_000 * 2"), 2000);
});

test("empty input evaluates to null", () => {
  assert.equal(evaluate("   "), null);
});

test("invalid expressions throw CalcError", () => {
  assert.throws(() => evaluate("2 +"), CalcError);
  assert.throws(() => evaluate("(1"), CalcError);
  assert.throws(() => evaluate("1 / 0"), CalcError);
  assert.throws(() => evaluate("abc"), CalcError);
  assert.throws(() => evaluate("(1)2"), CalcError);
});

test("formatResult groups, trims noise, and stays plain in range", () => {
  assert.equal(formatResult(1234.5), "1,234.5");
  assert.equal(formatResult(2), "2");
  assert.equal(formatResult(0.1 + 0.2), "0.3");
  assert.equal(formatResult(evaluate("1 / 3")), "0.3333333333");
});
