export const DAY_STATES = ["full", "half", "custom", "holiday", "off"];

export function formatMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function daysInMonth(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

export function buildMonthStatuses(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const statuses = {};

  for (let day = 1; day <= daysInMonth(monthKey); day += 1) {
    const date = new Date(year, month - 1, day);
    const key = `${monthKey}-${String(day).padStart(2, "0")}`;
    statuses[key] = date.getDay() === 0 || date.getDay() === 6 ? "off" : "full";
  }

  return statuses;
}

export function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function buildPeriodStatuses(start, end, existing = {}) {
  const statuses = {};
  const cursor = parseDateKey(start);
  const last = parseDateKey(end);
  if (cursor > last) return statuses;

  while (cursor <= last) {
    const key = formatDateKey(cursor);
    const weekend = cursor.getDay() === 0 || cursor.getDay() === 6;
    statuses[key] = existing[key] || (weekend ? "off" : "full");
    cursor.setDate(cursor.getDate() + 1);
  }
  return statuses;
}

export function monthsInPeriod(start, end) {
  const first = parseDateKey(start);
  const last = parseDateKey(end);
  const months = [];
  if (first > last) return months;
  const cursor = new Date(first.getFullYear(), first.getMonth(), 1);
  while (cursor <= last) {
    months.push(formatMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

export function cycleDayState(state) {
  const base = typeof state === "string" && state.startsWith("custom") ? "custom" : state;
  const index = DAY_STATES.indexOf(base);
  return DAY_STATES[(index + 1) % DAY_STATES.length];
}

export function calculateBilling(profile, statuses) {
  const weights = { full: 1, half: 0.5, holiday: 0, off: 0 };
  const hoursPerDay = positiveNumber(profile.hoursPerDay, 8);
  const billableDays = Object.values(statuses).reduce((total, state) => {
    if (typeof state === "string" && state.startsWith("custom")) {
      const h = Number(state.split(":")[1]) || 0;
      return total + (hoursPerDay > 0 ? h / hoursPerDay : 0);
    }
    return total + (weights[state] || 0);
  }, 0);
  const rate = positiveNumber(profile.rate, 0);
  const fxRate = positiveNumber(profile.fxRate, profile.currency === "PHP" ? 1 : 0);
  const billableHours = billableDays * hoursPerDay;
  const dailyEquivalent = profile.rateType === "daily" ? rate : rate * hoursPerDay;
  const nativeTotal = profile.rateType === "daily"
    ? billableDays * rate
    : billableHours * rate;

  return {
    billableDays,
    billableHours,
    dailyEquivalent,
    nativeTotal,
    phpTotal: nativeTotal * fxRate
  };
}

export function buildInvoiceSummary(profile, period, totals) {
  const client = profile.clientName.trim() || "Client";
  const provider = profile.providerName?.trim() || "Provider";
  const currency = profile.currency || "PHP";
  const rateLabel = profile.rateType === "daily"
    ? `${currency} ${money(profile.rate)} / day`
    : `${currency} ${money(profile.rate)} / hour`;
  const notes = profile.notes.trim();
  const paymentDetails = profile.paymentDetails?.trim();
  const fxSource = profile.fxSource?.trim();
  const fxDate = profile.fxDate?.trim();

  return [
    `INVOICE`,
    profile.invoiceNumber ? `Invoice number: ${profile.invoiceNumber}` : null,
    profile.issueDate ? `Issue date: ${profile.issueDate}` : null,
    profile.dueDate ? `Due date: ${profile.dueDate}` : null,
    ``,
    `FROM`,
    provider,
    profile.providerEmail?.trim() || null,
    ``,
    `BILL TO`,
    client,
    profile.clientEmail?.trim() || null,
    ``,
    `SERVICE`,
    `Billing period: ${billingPeriod(period.start, period.end)}`,
    ``,
    `Rate: ${rateLabel}`,
    profile.rateType === "hourly" ? `Hours per day: ${number(profile.hoursPerDay)}` : null,
    `Billable days: ${number(totals.billableDays)}`,
    `Billable hours: ${number(totals.billableHours)}`,
    ``,
    `Total: ${currency} ${money(totals.nativeTotal)}`,
    currency !== "PHP" ? `PHP estimate: PHP ${money(totals.phpTotal)}` : null,
    currency !== "PHP" ? `Manual exchange rate: 1 ${currency} = PHP ${number(profile.fxRate)}` : null,
    currency !== "PHP" && (fxSource || fxDate)
      ? `Rate reference: ${[fxSource, fxDate ? `checked ${fxDate}` : ""].filter(Boolean).join(" · ")}`
      : null,
    notes ? `` : null,
    notes ? `Notes: ${notes}` : null,
    paymentDetails ? `` : null,
    paymentDetails ? `PAYMENT INSTRUCTIONS` : null,
    paymentDetails || null,
    ``,
    currency !== "PHP"
      ? `The PHP conversion uses a manually entered reference rate. Confirm the final payout with your payment provider.`
      : null
  ].filter((line) => line !== null).join("\n");
}

export function calculateBudget(budget) {
  const rate = positiveNumber(budget.rate, 0);
  const hours = positiveNumber(budget.hours, 0);
  const fixedRevenue = positiveNumber(budget.fixedRevenue, 0);
  const revenue = fixedRevenue > 0 ? fixedRevenue : rate * hours;
  const baseCosts = positiveNumber(budget.fixedCosts, 0) + positiveNumber(budget.variableCosts, 0);
  const contingencyRate = positiveNumber(budget.contingency, 0) / 100;
  const contingencyAmount = baseCosts * contingencyRate;
  const totalCosts = baseCosts + contingencyAmount;
  const remaining = revenue - totalCosts;
  const margin = revenue > 0 ? (remaining / revenue) * 100 : 0;
  const effectiveNetHourly = hours > 0 ? remaining / hours : 0;

  return {
    revenue,
    baseCosts,
    contingencyAmount,
    totalCosts,
    remaining,
    margin,
    effectiveNetHourly
  };
}

export function buildBudgetSummary(budget, totals) {
  const currency = budget.currency || "PHP";
  const name = budget.name?.trim() || "Client / project";
  const notes = budget.notes?.trim();
  const revenueBasis = positiveNumber(budget.fixedRevenue, 0) > 0
    ? `Fixed project fee: ${currency} ${money(budget.fixedRevenue)}`
    : `Rate plan: ${currency} ${money(budget.rate)} × ${number(budget.hours)} hours`;

  return [
    `CLIENT BUDGET`,
    `Client / project: ${name}`,
    ``,
    revenueBasis,
    `Expected revenue: ${currency} ${money(totals.revenue)}`,
    `Fixed costs: ${currency} ${money(budget.fixedCosts)}`,
    `Variable costs: ${currency} ${money(budget.variableCosts)}`,
    `Contingency (${number(budget.contingency)}%): ${currency} ${money(totals.contingencyAmount)}`,
    `Total costs: ${currency} ${money(totals.totalCosts)}`,
    ``,
    `Budget remaining: ${currency} ${money(totals.remaining)}`,
    `Estimated margin: ${number(totals.margin)}%`,
    `Effective net per hour: ${currency} ${money(totals.effectiveNetHourly)}`,
    notes ? `` : null,
    notes ? `Notes: ${notes}` : null
  ].filter((line) => line !== null).join("\n");
}

export function monthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function billingPeriod(start, end) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
  const firstDate = parseDateKey(start);
  const lastDate = parseDateKey(end);
  const first = formatter.format(new Date(Date.UTC(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate())));
  const last = formatter.format(new Date(Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate())));
  return `${first} to ${last}`;
}

export function money(value) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

export function number(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
