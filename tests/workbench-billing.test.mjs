import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInvoiceSummary,
  buildMonthStatuses,
  calculateBilling,
  cycleDayState,
  daysInMonth
} from "../assets/js/workbench/billing-core.mjs";

test("weekdays start full and weekends start off", () => {
  const statuses = buildMonthStatuses("2026-06");
  assert.equal(statuses["2026-06-01"], "full");
  assert.equal(statuses["2026-06-06"], "off");
  assert.equal(Object.keys(statuses).length, 30);
});

test("hourly billing calculates days, hours, and PHP estimate", () => {
  const statuses = Object.fromEntries(
    Array.from({ length: 21 }, (_, index) => [`day-${index}`, "full"])
  );
  const totals = calculateBilling({
    currency: "USD",
    rateType: "hourly",
    rate: 6,
    hoursPerDay: 8,
    fxRate: 58
  }, statuses);

  assert.equal(totals.billableDays, 21);
  assert.equal(totals.billableHours, 168);
  assert.equal(totals.dailyEquivalent, 48);
  assert.equal(totals.nativeTotal, 1008);
  assert.equal(totals.phpTotal, 58464);
});

test("daily billing weights half days", () => {
  const totals = calculateBilling({
    currency: "GBP",
    rateType: "daily",
    rate: 32,
    hoursPerDay: 8,
    fxRate: 74
  }, { a: "full", b: "half", c: "holiday", d: "off" });

  assert.equal(totals.billableDays, 1.5);
  assert.equal(totals.nativeTotal, 48);
  assert.equal(totals.phpTotal, 3552);
});

test("calendar helpers handle leap years and state order", () => {
  assert.equal(daysInMonth("2028-02"), 29);
  assert.equal(cycleDayState("full"), "half");
  assert.equal(cycleDayState("half"), "holiday");
  assert.equal(cycleDayState("holiday"), "off");
  assert.equal(cycleDayState("off"), "full");
});

test("invoice output contains the working totals", () => {
  const profile = {
    clientName: "Example Client",
    currency: "USD",
    rateType: "hourly",
    rate: 6,
    hoursPerDay: 8,
    fxRate: 58,
    notes: "Net 15"
  };
  const totals = calculateBilling(profile, { a: "full", b: "half" });
  const summary = buildInvoiceSummary(profile, "2026-06", totals);

  assert.match(summary, /Billing period: 1 June 2026 to 30 June 2026/);
  assert.match(summary, /Client: Example Client/);
  assert.match(summary, /Total: USD 72.00/);
  assert.match(summary, /Notes: Net 15/);
  assert.match(summary, /Exchange rates are estimates/);
});
