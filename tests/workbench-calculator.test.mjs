import test from "node:test";
import assert from "node:assert/strict";
import { evaluate, fmt, group } from "../assets/js/workbench/calculator-core.mjs";

const approx = (a, b) => Math.abs(a - b) < 1e-9;
const val = (expr, ctx) => { const r = evaluate(expr, ctx); assert.ok(r.ok, `expected ok: ${expr} (${r.error})`); return r.value; };

test("precedence, parens, right-assoc power, unary", () => {
  assert.equal(val("1+2*3", "rad"), 7);
  assert.equal(val("(1+2)*3", "rad"), 9);
  assert.equal(val("2^3^2", "rad"), 512);
  assert.equal(val("-3^2", "rad"), 9);      // owner's engine: unary binds tighter than ^
  assert.equal(val("(-3)^2", "rad"), 9);
  assert.equal(val("2^-3", "rad"), 0.125);
  assert.ok(approx(val("3+4*2/(1-5)^2", "rad"), 3.5));
});

test("percent (postfix) and modulo", () => {
  assert.equal(val("50%", "rad"), 0.5);
  assert.equal(val("200*10%", "rad"), 20);
  assert.equal(val("10 % 3", "rad"), 1);
});

test("scientific functions and constants", () => {
  assert.equal(val("sqrt(16)", "rad"), 4);
  assert.ok(approx(val("2pi", "rad"), 2 * Math.PI));
  assert.ok(approx(val("sin(90)", "deg"), 1));
  assert.ok(approx(val("sin(30)", "deg"), 0.5));
  assert.ok(approx(val("ln(e)", "rad"), 1));
  assert.equal(val("log(1000)", "rad"), 3);
  assert.equal(val("5!", "rad"), 120);
  assert.equal(val("fact(6)", "rad"), 720);
  assert.ok(approx(val("abs(-7)+cbrt(27)", "rad"), 10));
  assert.equal(val("2(3+1)", "rad"), 8);         // implicit multiply
  assert.ok(approx(val("3sin(30)", "deg"), 1.5));
  assert.equal(val("1e3+5", "rad"), 1005);
});

test("currency-aware math with manual rates", () => {
  const R = { PHP: 1, GBP: 2, USD: 4, CAD: 1, AUD: 1 };
  let r = evaluate("10 GBP + 5", { rates: R, display: "PHP" });
  assert.ok(r.ok && r.currency && approx(r.value, 25));
  r = evaluate("2 USD", { rates: R, display: "PHP" });
  assert.ok(r.ok && r.currency && approx(r.value, 8));
  r = evaluate("10 GBP", { rates: R, display: "GBP" });
  assert.ok(r.ok && r.currency && approx(r.value, 10));
});

test("named variables", () => {
  assert.equal(val("x*2", { vars: { x: 5 } }), 10);
  assert.equal(val("rate*hrs", { vars: { rate: 45, hrs: 3 } }), 135);
});

test("graceful errors, not throws", () => {
  for (const bad of ["2++", "(1+2", "sqrt(", "abc", "GBP", "x*2"]) {
    assert.equal(evaluate(bad, {}).ok, false, `should fail: ${bad}`);
  }
});

test("empty input returns null value", () => {
  const r = evaluate("   ", {});
  assert.ok(r.ok && r.value === null);
});

test("formatting groups and trims fp noise", () => {
  assert.equal(group(fmt(1234.5)), "1,234.5");
  assert.equal(fmt(0.1 + 0.2), "0.3");
});
