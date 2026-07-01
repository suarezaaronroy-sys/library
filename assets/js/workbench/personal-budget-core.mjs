export function calculatePersonalBudget(profile, expenses) {
  const income = numeric(profile.monthlyIncome);
  const taxReserve = income * numeric(profile.taxPercent) / 100;
  const recurringExpenses = expenses.reduce((sum, item) => sum + numeric(item.amount), 0);
  const savingsTarget = numeric(profile.savingsTarget);
  const plannedOutflow = taxReserve + recurringExpenses + savingsTarget;
  return {
    income,
    taxReserve,
    recurringExpenses,
    savingsTarget,
    plannedOutflow,
    freeCash: income - plannedOutflow,
    committedPercent: income ? plannedOutflow / income * 100 : 0
  };
}

export function buildPersonalBudgetSummary(profile, expenses, totals) {
  const currency = profile.currency || "PHP";
  const lines = [
    "# PERSONAL BUDGET PLAN",
    "",
    "Artifact type: personal-budget",
    `Month / label: ${profile.label || "Monthly baseline"}`,
    `Currency: ${currency}`,
    "",
    "## Income and reserves",
    `Monthly income: ${currency} ${money(totals.income)}`,
    `Tax reserve (${numeric(profile.taxPercent)}%): ${currency} ${money(totals.taxReserve)}`,
    `Savings target: ${currency} ${money(totals.savingsTarget)}`,
    "",
    "## Recurring expenses",
    ...(expenses.length ? expenses
      .slice()
      .sort((a, b) => numeric(a.dueDay) - numeric(b.dueDay))
      .map((item) => `- Day ${String(item.dueDay).padStart(2, "0")} | ${item.category}: ${item.name} | ${currency} ${money(item.amount)}`)
      : ["None recorded."]),
    "",
    "## Plan result",
    `Recurring expenses: ${currency} ${money(totals.recurringExpenses)}`,
    `Total planned outflow: ${currency} ${money(totals.plannedOutflow)}`,
    `Free cash after plan: ${currency} ${money(totals.freeCash)}`,
    `Income committed: ${number(totals.committedPercent)}%`,
    "",
    "## Notes",
    profile.notes?.trim() || "None recorded."
  ];
  return lines.join("\n");
}

export function buildExpenseCalendar(profile, expenses, now = new Date()) {
  const currency = profile.currency || "PHP";
  const stamp = utcStamp(now);
  const events = expenses.map((item) => {
    const day = Math.min(28, Math.max(1, numeric(item.dueDay) || 1));
    const start = nextOccurrence(day, now);
    return [
      "BEGIN:VEVENT",
      `UID:${escapeICS(item.id || `${item.name}-${day}`)}@operator-workbench`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${localStamp(start)}`,
      `RRULE:FREQ=MONTHLY;BYMONTHDAY=${day}`,
      `SUMMARY:${escapeICS(`Bill: ${item.name}`)}`,
      `DESCRIPTION:${escapeICS(`${item.category} - planned amount ${currency} ${money(item.amount)}. Review before paying.`)}`,
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeICS(`Upcoming bill: ${item.name}`)}`,
      "END:VALARM",
      "END:VEVENT"
    ].join("\r\n");
  });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Aaron Suarez//Operator Workbench//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
    ""
  ].join("\r\n");
}

function nextOccurrence(day, now) {
  const candidate = new Date(now.getFullYear(), now.getMonth(), day, 9, 0, 0);
  if (candidate < now) candidate.setMonth(candidate.getMonth() + 1);
  return candidate;
}

function localStamp(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T090000`;
}

function utcStamp(date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function escapeICS(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function numeric(value) {
  return Number(value) || 0;
}

function money(value) {
  return numeric(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function number(value) {
  return numeric(value).toLocaleString("en-US", { maximumFractionDigits: 1 });
}
