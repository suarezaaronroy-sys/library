import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExpenseCalendar,
  buildPersonalBudgetSummary,
  calculatePersonalBudget
} from "../assets/js/workbench/personal-budget-core.mjs";

test("personal budget separates tax, recurring expenses, savings, and free cash", () => {
  const profile = {
    label: "Monthly baseline",
    currency: "PHP",
    monthlyIncome: 60000,
    taxPercent: 10,
    savingsTarget: 10000
  };
  const expenses = [
    { id: "electricity", name: "Electricity", category: "Utilities", amount: 3500, dueDay: 12 }
  ];
  const totals = calculatePersonalBudget(profile, expenses);
  assert.equal(totals.taxReserve, 6000);
  assert.equal(totals.recurringExpenses, 3500);
  assert.equal(totals.plannedOutflow, 19500);
  assert.equal(totals.freeCash, 40500);
  assert.match(buildPersonalBudgetSummary(profile, expenses, totals), /Artifact type: personal-budget/);
});

test("calendar export produces a monthly recurring event and reminder", () => {
  const calendar = buildExpenseCalendar(
    { currency: "PHP" },
    [{ id: "insurance", name: "Health Insurance", category: "Insurance", amount: 2400, dueDay: 15 }],
    new Date("2026-07-01T00:00:00Z")
  );
  assert.match(calendar, /BEGIN:VCALENDAR/);
  assert.match(calendar, /RRULE:FREQ=MONTHLY;BYMONTHDAY=15/);
  assert.match(calendar, /SUMMARY:Bill: Health Insurance/);
  assert.match(calendar, /BEGIN:VALARM/);
});
