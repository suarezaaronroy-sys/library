import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBudgetSummary,
  buildInvoiceData,
  buildInvoiceSummary,
  buildMonthStatuses,
  buildPeriodStatuses,
  calculateBilling,
  calculateBudget,
  cycleDayState,
  daysInMonth,
  formatCurrencyMinor,
  invoiceNumberForDate,
  monthsInPeriod,
  nextBillingCycle,
  previousBillingCycle,
  shiftDateMonths
} from "../assets/js/workbench/billing-core.mjs";
import { renderInvoiceDocument } from "../assets/js/workbench/invoice-document.mjs";

test("invoice numbers use the issue date in INV-YYYYMMDD0 format", () => {
  assert.equal(invoiceNumberForDate("2026-09-02"), "INV-202609020");
  assert.equal(invoiceNumberForDate(""), "");
});

test("next billing cycle preserves monthly start, end, issue, and due anchors", () => {
  assert.deepEqual(nextBillingCycle({ start: "2026-06-28", end: "2026-07-27" }), {
    start: "2026-07-28",
    end: "2026-08-27",
    shiftMonths: 1
  });
  assert.deepEqual(nextBillingCycle({ start: "2026-07-28", end: "2026-08-27" }), {
    start: "2026-08-28",
    end: "2026-09-27",
    shiftMonths: 1
  });
  assert.equal(shiftDateMonths("2026-08-28", 1), "2026-09-28");
  assert.equal(shiftDateMonths("2026-09-04", 1), "2026-10-04");
  assert.deepEqual(nextBillingCycle({ start: "2026-08-12", end: "2026-09-11" }), {
    start: "2026-09-12",
    end: "2026-10-11",
    shiftMonths: 1
  });
  assert.deepEqual(previousBillingCycle({ start: "2026-07-28", end: "2026-08-27" }), {
    start: "2026-06-28",
    end: "2026-07-27",
    shiftMonths: -1
  });
});

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
  assert.equal(cycleDayState("half"), "custom");
  assert.equal(cycleDayState("custom"), "holiday");
  assert.equal(cycleDayState("custom:6"), "holiday");
  assert.equal(cycleDayState("holiday"), "off");
  assert.equal(cycleDayState("off"), "full");
});

test("billing periods can cross month and year boundaries", () => {
  const statuses = buildPeriodStatuses("2026-12-29", "2027-01-04");
  assert.equal(Object.keys(statuses).length, 7);
  assert.equal(statuses["2027-01-02"], "off");
  assert.deepEqual(monthsInPeriod("2026-12-29", "2027-01-04"), ["2026-12", "2027-01"]);
});

test("invoice output contains the working totals", () => {
  const profile = {
    providerName: "Aaron",
    clientName: "Example Client",
    currency: "USD",
    rateType: "hourly",
    rate: 6,
    hoursPerDay: 8,
    fxRate: 58,
    notes: "Net 15",
    paymentDetails: "Pay via Wise"
  };
  const totals = calculateBilling(profile, { a: "full", b: "half" });
  const summary = buildInvoiceSummary(profile, { start: "2026-06-01", end: "2026-06-30" }, totals);

  assert.match(summary, /Billing period: 1 June 2026 to 30 June 2026/);
  assert.match(summary, /BILL TO\nExample Client/);
  assert.match(summary, /Total: USD 72.00/);
  assert.match(summary, /Notes: Net 15/);
  assert.match(summary, /Manual exchange rate: 1 USD = PHP 58/);
  assert.match(summary, /PAYMENT INSTRUCTIONS\nPay via Wise/);
});

test("budget output exposes costs, margin, and effective hourly net", () => {
  const budget = {
    name: "Example Project",
    currency: "USD",
    rate: 20,
    hours: 40,
    fixedRevenue: 0,
    fixedCosts: 100,
    variableCosts: 50,
    contingency: 10,
    notes: "Keep ten percent unallocated"
  };
  const totals = calculateBudget(budget);
  const summary = buildBudgetSummary(budget, totals);

  assert.equal(totals.revenue, 800);
  assert.equal(totals.totalCosts, 165);
  assert.equal(totals.remaining, 635);
  assert.equal(totals.effectiveNetHourly, 15.875);
  assert.match(summary, /Budget remaining: USD 635.00/);
  assert.match(summary, /Estimated margin: 79.38%/);
});

test("custom-hours days bill their exact hours", () => {
  const totals = calculateBilling(
    { currency: "USD", rateType: "hourly", rate: 10, hoursPerDay: 8, fxRate: 1 },
    { a: "full", b: "custom:6", c: "half" }
  );
  // full 8h + custom 6h + half 4h = 18h => 2.25 day-units
  assert.equal(totals.billableHours, 18);
  assert.equal(totals.billableDays, 2.25);
  assert.equal(totals.nativeTotal, 180);
});

test("invoice document data reconciles half days and a credit in minor units", () => {
  const profile = {
    providerName: "Aaron Suarez",
    providerAddress: "Valencia City\nPhilippines",
    clientName: "AD Glazing",
    clientAddress: "Broxburn\nScotland",
    invoiceNumber: "INV-202608-003",
    issueDate: "2026-08-28",
    dueDate: "2026-09-04",
    terms: "Net 7",
    currency: "GBP",
    rateType: "hourly",
    rate: 4,
    hoursPerDay: 7.5,
    serviceDescription: "Social Media Management",
    adjustmentLabel: "Service credit",
    adjustmentAmount: -10.25,
    fxRate: 73,
    paymentMethod: "Wise",
    paymentDetails: "@aaronroybantaculos"
  };
  const invoice = buildInvoiceData(profile, { start: "2026-07-28", end: "2026-08-27" }, {
    a: "full",
    b: "half",
    c: "custom:3.75",
    d: "holiday",
    e: "off"
  });

  assert.equal(invoice.totals.billableDays, 2);
  assert.equal(invoice.totals.billableHours, 15);
  assert.equal(invoice.totals.subtotal, 6000);
  assert.equal(invoice.totals.adjustmentTotal, -1025);
  assert.equal(invoice.totals.grandTotal, 4975);
  assert.equal(invoice.lines[0].amount, invoice.totals.subtotal);
  assert.deepEqual(invoice.from.addressLines, ["Valencia City", "Philippines"]);
});

test("currency formatter emits stable ISO currency labels", () => {
  assert.equal(formatCurrencyMinor(69000, "GBP"), "GBP 690.00");
  assert.equal(formatCurrencyMinor(-1000, "GBP"), "GBP -10.00");
  assert.equal(formatCurrencyMinor(123456, "USD"), "USD 1,234.56");
  assert.equal(formatCurrencyMinor(987650, "PHP"), "PHP 9,876.50");
});

test("invoice renderer consumes only the document contract", () => {
  const invoice = buildInvoiceData({
    providerName: "Aaron Suarez",
    clientName: "AD Glazing",
    invoiceNumber: "INV-202608-003",
    issueDate: "2026-08-28",
    dueDate: "2026-09-04",
    currency: "GBP",
    rateType: "hourly",
    rate: 4,
    hoursPerDay: 7.5,
    serviceDescription: "Social Media Management",
    fxRate: 73,
    paymentMethod: "Wise",
    paymentDetails: "@aaronroybantaculos"
  }, { start: "2026-07-28", end: "2026-08-27" }, { a: "full" });
  const html = renderInvoiceDocument(invoice);

  assert.match(html, /INV-202608-003/);
  assert.match(html, /Social Media Management/);
  assert.match(html, /GBP 30\.00/);
  assert.match(html, /Indicative only:/);
  assert.doesNotMatch(html, /billing-calendar|providerName/);
});

test("invoice renderer skips optional line items when their values are blank", () => {
  const invoice = buildInvoiceData({
    invoiceNumber: "INV-202609-001",
    currency: "GBP",
    rateType: "daily",
    rate: 100,
    hoursPerDay: 8,
    fxRate: 0,
    providerName: "",
    clientName: "",
    dueDate: "",
    terms: "",
    paymentMethod: "",
    paymentDetails: "",
    footerTerms: "",
    website: ""
  }, { start: "2026-09-01", end: "2026-09-01" }, { a: "full" });
  const html = renderInvoiceDocument(invoice);

  assert.doesNotMatch(html, />From</);
  assert.doesNotMatch(html, />Bill to</);
  assert.doesNotMatch(html, /Payment method|Payment due|As agreed/);
  assert.doesNotMatch(html, /invoice-document-footer/);
  assert.doesNotMatch(html, /Client tax ID|PO reference|Terms/);
  assert.doesNotMatch(html, /<th>Hours<\/th>|hours\/day/);
});

test("daily invoice output omits hours while preserving half-day math", () => {
  const profile = {
    providerName: "Aaron Suarez",
    clientName: "AD Glazing",
    invoiceNumber: "INV-202608-003",
    currency: "GBP",
    rateType: "daily",
    rate: 30,
    hoursPerDay: 8,
    fxRate: 0
  };
  const statuses = { a: "full", b: "half" };
  const totals = calculateBilling(profile, statuses);
  const invoice = buildInvoiceData(profile, { start: "2026-08-01", end: "2026-08-02" }, statuses);
  const html = renderInvoiceDocument(invoice);
  const summary = buildInvoiceSummary(profile, { start: "2026-08-01", end: "2026-08-02" }, totals);

  assert.equal(invoice.totals.billableDays, 1.5);
  assert.equal(invoice.totals.grandTotal, 4500);
  assert.match(html, /GBP 30\.00 \/ day/);
  assert.doesNotMatch(html, /<th>Hours<\/th>|hours\/day/);
  assert.doesNotMatch(summary, /Billable hours/);
});
