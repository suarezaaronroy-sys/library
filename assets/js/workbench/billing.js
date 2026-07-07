import {
  buildBudgetSummary,
  buildInvoiceSummary,
  buildPeriodStatuses,
  calculateBilling,
  calculateBudget,
  cycleDayState,
  daysInMonth,
  formatDateKey,
  formatMonthKey,
  money,
  monthLabel,
  monthsInPeriod,
  number
} from "./billing-core.mjs?v=5";
import { loadState, saveState } from "./store.js?v=5";
import "./personal-budget.js?v=4";
import "./calculator.js?v=5";
import { downloadFile, escapeHtml, slug } from "./utils.mjs?v=1";

const STORAGE_KEY = "aaron-workbench:v1:billing";
const today = new Date();
const currentMonth = formatMonthKey(today);
const defaultPeriod = {
  start: `${currentMonth}-01`,
  end: `${currentMonth}-${String(daysInMonth(currentMonth)).padStart(2, "0")}`
};
const todayKey = formatDateKey(today);
const dueDate = new Date(today);
dueDate.setDate(dueDate.getDate() + 14);
const DEFAULT_BUDGET = {
  name: "",
  currency: "GBP",
  rate: 0,
  hours: 0,
  fixedRevenue: 0,
  fixedCosts: 0,
  variableCosts: 0,
  contingency: 10,
  notes: ""
};
const DEFAULT_STATE = {
  schemaVersion: 3,
  period: defaultPeriod,
  profile: {
    providerName: "",
    providerEmail: "",
    clientName: "",
    clientEmail: "",
    invoiceNumber: `INV-${currentMonth.replace("-", "")}-001`,
    issueDate: todayKey,
    dueDate: formatDateKey(dueDate),
    currency: "GBP",
    rateType: "hourly",
    rate: 0,
    hoursPerDay: 8,
    fxRate: 74,
    fxSource: "",
    fxDate: todayKey,
    notes: "",
    paymentDetails: ""
  },
  budget: DEFAULT_BUDGET,
  dates: {}
};

const root = document.querySelector("#billing-workspace");
if (root) {
  const state = migrateState(loadState(STORAGE_KEY, DEFAULT_STATE));
  const form = document.querySelector("#billing-form");
  const startInput = document.querySelector("#period-start");
  const endInput = document.querySelector("#period-end");
  const calendar = document.querySelector("#billing-calendar");
  const saveOutput = document.querySelector("#billing-save-state");
  const toast = document.querySelector("#billing-toast");
  const budgetForm = document.querySelector("#budget-form");
  const budgetToast = document.querySelector("#budget-toast");
  let toastTimer;
  let budgetToastTimer;

  // Isolated so a bad saved state in one panel can never leave the whole
  // workspace un-hydrated (which silently overwrites good data on next edit).
  try {
    ensurePeriod();
    hydrateForm();
    hydrateBudget();
    startInput.value = state.period.start;
    endInput.value = state.period.end;
    render();
    renderBudget();
  } catch (err) {
    console.error("Billing workspace failed to hydrate saved state:", err);
    announce("Couldn't load saved data. Avoid editing until the page is reloaded.");
  }

  document.querySelectorAll("[data-billing-view]").forEach((button) => {
    button.addEventListener("click", () => switchBillingView(button.dataset.billingView));
  });

  // Deep-linkable views: /workbench/billing/#calculator etc.
  const initialView = window.location.hash.slice(1);
  if (["budget", "personal", "calculator"].includes(initialView)) switchBillingView(initialView);

  form.addEventListener("input", () => {
    state.profile = Object.fromEntries(new FormData(form));
    state.profile.rate = Number(state.profile.rate);
    state.profile.hoursPerDay = Number(state.profile.hoursPerDay);
    state.profile.fxRate = Number(state.profile.fxRate);
    if (state.profile.rate < 0) {
      state.profile.rate = 0;
      form.elements.namedItem("rate").value = "0";
      announce("Rate can't be negative - reset to 0.");
    }
    persist();
    renderSummary();
  });

  document.querySelector("#currency").addEventListener("change", (event) => {
    const fxInput = document.querySelector("#fx-rate");
    if (event.target.value === "PHP") {
      fxInput.value = "1";
      fxInput.disabled = true;
      state.profile.fxRate = 1;
    } else {
      fxInput.disabled = false;
    }
    renderFxLabel();
    persist();
    renderSummary();
  });

  budgetForm.addEventListener("input", () => {
    state.budget = budgetFromForm();
    persist();
    renderBudget();
  });

  startInput.addEventListener("change", () => updatePeriod("start"));
  endInput.addEventListener("change", () => updatePeriod("end"));

  calendar.addEventListener("click", (event) => {
    const day = event.target.closest(".billing-day[data-date]");
    if (!day) return;
    const date = day.dataset.date;

    const adjust = event.target.closest("[data-adjust]");
    if (adjust) {
      const current = String(state.dates[date] || "");
      const base = current.startsWith("custom") ? Number(current.split(":")[1]) || 0 : 0;
      const hours = Math.max(0, Math.min(24, base + Number(adjust.dataset.adjust)));
      state.dates[date] = `custom:${hours}`;
      persist();
      render();
      return;
    }

    const next = cycleDayState(state.dates[date]);
    if (next === "custom") {
      const prev = String(state.dates[date] || "");
      const seed = prev.startsWith("custom") ? Number(prev.split(":")[1]) || 0 : Number(state.profile.hoursPerDay) || 0;
      state.dates[date] = `custom:${seed}`;
    } else {
      state.dates[date] = next;
    }
    persist();
    render();
  });

  // Keyboard access for the custom-hours +/- controls (role="button" spans).
  calendar.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.classList && event.target.classList.contains("cust-adj")) {
      event.preventDefault();
      event.target.click();
    }
  });

  root.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;

    if (action === "select-weekdays" || action === "reset-period") {
      state.dates = buildPeriodStatuses(state.period.start, state.period.end);
      persist();
      render();
      announce(action === "reset-period" ? "Period reset to weekdays." : "Weekdays selected.");
    } else if (action === "clear-period") {
      Object.keys(state.dates).forEach((date) => {
        if (date >= state.period.start && date <= state.period.end) state.dates[date] = "off";
      });
      persist();
      render();
    } else if (action === "copy-summary") {
      try {
        await navigator.clipboard.writeText(document.querySelector("#invoice-output").value);
        announce("Summary copied.");
      } catch {
        document.querySelector("#invoice-output").select();
        announce("Summary selected. Copy it from the text field.");
      }
    } else if (action === "print-invoice") {
      printArtifact(document.querySelector("#invoice-output").value, "Invoice");
    } else if (action === "download-invoice") {
      if (!calculateBilling(state.profile, periodDates()).billableDays) {
        announce("Nothing billable yet - mark days on the calendar first.");
        return;
      }
      downloadFile(document.querySelector("#invoice-output").value, invoiceFileName("txt"), "text/plain");
      announce("Invoice text prepared.");
    } else if (action === "download-csv") {
      if (!calculateBilling(state.profile, periodDates()).billableDays) {
        announce("Nothing billable yet - mark days on the calendar first.");
        return;
      }
      downloadFile(csvExport(), `billing-${state.period.start}-to-${state.period.end}.csv`, "text/csv");
      announce("CSV prepared.");
    } else if (action === "export-json") {
      downloadFile(JSON.stringify(state, null, 2), `billing-${state.period.start}-to-${state.period.end}.json`, "application/json");
      announce("JSON backup prepared.");
    }
  });

  document.querySelector("#budget-workspace").addEventListener("click", async (event) => {
    const action = event.target.closest("[data-budget-action]")?.dataset.budgetAction;
    if (!action) return;
    if (action === "copy") {
      try {
        await navigator.clipboard.writeText(document.querySelector("#budget-output").value);
        announceBudget("Budget summary copied.");
      } catch {
        document.querySelector("#budget-output").select();
        announceBudget("Budget summary selected. Copy it from the text field.");
      }
    } else if (action === "download") {
      downloadFile(document.querySelector("#budget-output").value, budgetFileName("txt"), "text/plain");
      announceBudget("Budget text prepared.");
    } else if (action === "export") {
      downloadFile(JSON.stringify(state.budget, null, 2), budgetFileName("json"), "application/json");
      announceBudget("Budget backup prepared.");
    }
  });

  function migrateState(loaded) {
    if (Number(loaded.schemaVersion) >= 2 && loaded.period) {
      return {
        ...loaded,
        schemaVersion: 3,
        profile: { ...DEFAULT_STATE.profile, ...(loaded.profile || {}) },
        budget: { ...DEFAULT_BUDGET, ...(loaded.budget || {}) }
      };
    }
    const month = loaded.month || currentMonth;
    const period = {
      start: `${month}-01`,
      end: `${month}-${String(daysInMonth(month)).padStart(2, "0")}`
    };
    return {
      schemaVersion: 3,
      period,
      profile: { ...DEFAULT_STATE.profile, ...(loaded.profile || {}) },
      budget: { ...DEFAULT_BUDGET, ...(loaded.budget || {}) },
      dates: { ...(loaded.months?.[month] || loaded.dates || {}) }
    };
  }

  function updatePeriod(changed) {
    if (!startInput.value || !endInput.value) return;
    if (startInput.value > endInput.value) {
      // Invalid range: revert the edit instead of silently rewriting the
      // other bound (which used to corrupt the saved period start).
      startInput.value = state.period.start;
      endInput.value = state.period.end;
      announce(changed === "end"
        ? "Period end can't be before the start - change reverted."
        : "Period start can't be after the end - change reverted.");
      return;
    }
    state.period = { start: startInput.value, end: endInput.value };
    ensurePeriod();
    persist();
    render();
  }

  function ensurePeriod() {
    state.dates = {
      ...state.dates,
      ...buildPeriodStatuses(state.period.start, state.period.end, state.dates)
    };
  }

  function periodDates() {
    return Object.fromEntries(
      Object.entries(state.dates).filter(([date]) => date >= state.period.start && date <= state.period.end)
    );
  }

  function hydrateForm() {
    Object.entries(state.profile).forEach(([name, value]) => {
      const field = form.elements.namedItem(name);
      if (field) field.value = value;
    });
    document.querySelector("#fx-rate").disabled = state.profile.currency === "PHP";
    renderFxLabel();
  }

  function hydrateBudget() {
    Object.entries(state.budget).forEach(([name, value]) => {
      const field = budgetForm.elements.namedItem(name);
      if (field) field.value = value;
    });
  }

  function renderFxLabel() {
    const currency = document.querySelector("#currency").value || state.profile.currency;
    document.querySelector("#fx-rate-label").textContent = currency === "PHP"
      ? "Manual exchange rate · PHP uses 1"
      : `Manual exchange rate · 1 ${currency} = PHP`;
  }

  function switchBillingView(view) {
    const hash = view === "invoice" ? window.location.pathname + window.location.search : `#${view}`;
    window.history.replaceState(null, "", hash);
    document.querySelectorAll("[data-billing-view]").forEach((button) => {
      const active = button.dataset.billingView === view;
      button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-billing-view-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.billingViewPanel !== view;
    });
  }

  function render() {
    renderCalendars();
    renderSummary();
  }

  function renderCalendars() {
    calendar.innerHTML = monthsInPeriod(state.period.start, state.period.end)
      .map((month) => renderMonth(month))
      .join("");
  }

  function renderMonth(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    const leadingCells = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    const cells = Array.from({ length: leadingCells }, () =>
      `<span class="billing-day is-empty" aria-hidden="true"></span>`
    );

    for (let day = 1; day <= daysInMonth(monthKey); day += 1) {
      const date = `${monthKey}-${String(day).padStart(2, "0")}`;
      if (date < state.period.start || date > state.period.end) {
        cells.push(`<span class="billing-day is-empty" aria-hidden="true"></span>`);
        continue;
      }
      const raw = state.dates[date] || "off";
      const isCustom = typeof raw === "string" && raw.startsWith("custom");
      const stateAttr = isCustom ? "custom" : raw;
      const customHours = isCustom ? Number(raw.split(":")[1]) || 0 : 0;
      const weekday = new Date(year, month - 1, day).getDay();
      const weekend = weekday === 0 || weekday === 6 ? " is-weekend" : "";
      const foot = isCustom
        ? `<span class="billing-day-custom">
            <span class="cust-adj" data-adjust="-1" role="button" tabindex="0" aria-label="Decrease hours">&#8722;</span>
            <span class="cust-val">${customHours}h</span>
            <span class="cust-adj" data-adjust="1" role="button" tabindex="0" aria-label="Increase hours">+</span>
          </span>`
        : `<span class="billing-day-state">${raw}</span>`;
      const aria = isCustom ? `${date}: ${customHours} custom hours` : `${date}: ${raw} day`;
      cells.push(
        `<button type="button" class="billing-day${weekend}" data-date="${date}" data-state="${stateAttr}" aria-label="${aria}">
          <span class="billing-day-number">${day}</span>
          ${foot}
        </button>`
      );
    }

    return `<section class="billing-month-section">
      <h3 class="billing-month-title">${monthLabel(monthKey)}</h3>
      <div class="calendar-weekdays" aria-hidden="true">
        <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
      </div>
      <div class="billing-calendar" role="group" aria-label="${monthLabel(monthKey)} billing days">${cells.join("")}</div>
    </section>`;
  }

  function renderSummary() {
    const totals = calculateBilling(state.profile, periodDates());
    const currency = state.profile.currency;
    document.querySelector("#selected-days").textContent = number(totals.billableDays);
    document.querySelector("#billable-hours").textContent = number(totals.billableHours);
    document.querySelector("#daily-total").textContent = `${currency} ${money(totals.dailyEquivalent)}`;
    document.querySelector("#native-total").textContent = `${currency} ${money(totals.nativeTotal)}`;
    document.querySelector("#php-total").textContent = `PHP ${money(totals.phpTotal)} estimate`;
    document.querySelector("#invoice-output").value = buildInvoiceSummary(state.profile, state.period, totals);
  }

  function budgetFromForm() {
    const values = Object.fromEntries(new FormData(budgetForm));
    ["rate", "hours", "fixedRevenue", "fixedCosts", "variableCosts", "contingency"].forEach((name) => {
      values[name] = Number(values[name]);
    });
    return values;
  }

  function renderBudget() {
    const totals = calculateBudget(state.budget);
    const currency = state.budget.currency;
    document.querySelector("#budget-revenue").textContent = `${currency} ${money(totals.revenue)}`;
    document.querySelector("#budget-costs").textContent = `${currency} ${money(totals.totalCosts)}`;
    document.querySelector("#budget-hourly").textContent = `${currency} ${money(totals.effectiveNetHourly)}`;
    document.querySelector("#budget-remaining").textContent = `${currency} ${money(totals.remaining)}`;
    document.querySelector("#budget-margin").textContent = `${number(totals.margin)}% estimated margin`;
    document.querySelector("#budget-output").value = buildBudgetSummary(state.budget, totals);
  }

  function persist() {
    const saved = saveState(STORAGE_KEY, state);
    const message = saved ? "Saved locally" : "Local save unavailable";
    saveOutput.textContent = message;
    document.querySelector("#budget-save-state").textContent = message;
  }

  function announce(message) {
    toast.textContent = message;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.textContent = "";
    }, 2400);
  }

  function announceBudget(message) {
    budgetToast.textContent = message;
    window.clearTimeout(budgetToastTimer);
    budgetToastTimer = window.setTimeout(() => {
      budgetToast.textContent = "";
    }, 2400);
  }

  function csvExport() {
    const dates = periodDates();
    const totals = calculateBilling(state.profile, dates);
    const rows = [
      ["date", "status"],
      ...Object.entries(dates),
      [],
      ["client", state.profile.clientName],
      ["period_start", state.period.start],
      ["period_end", state.period.end],
      ["currency", state.profile.currency],
      ["rate_type", state.profile.rateType],
      ["rate", state.profile.rate],
      ["billable_days", totals.billableDays],
      ["billable_hours", totals.billableHours],
      ["native_total", totals.nativeTotal],
      ["php_estimate", totals.phpTotal]
    ];
    return rows.map((row) => row.map(csvCell).join(",")).join("\n");
  }

  function csvCell(value) {
    let cell = String(value ?? "");
    // Guard against spreadsheet formula injection for text cells that start
    // with a formula trigger character (=, +, @, tab) or a non-numeric "-".
    if (/^[=+@\t\r]/.test(cell) || (/^-/.test(cell) && !/^-?\d+(\.\d+)?$/.test(cell))) {
      cell = `'${cell}`;
    }
    return `"${cell.replaceAll('"', '""')}"`;
  }

  function invoiceFileName(extension) {
    const reference = state.profile.invoiceNumber || `invoice-${state.period.start}`;
    return `${slug(reference)}.${extension}`;
  }

  function budgetFileName(extension) {
    return `${slug(state.budget.name || "client-budget")}.${extension}`;
  }


  function printArtifact(content, title) {
    const popup = window.open("", "_blank", "width=800,height=900");
    if (!popup) {
      announce("Pop-up blocked. Use Copy invoice instead.");
      return;
    }
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{max-width:720px;margin:48px auto;padding:0 32px;color:#1c1917;font:14px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap} @media print{body{margin:0}}</style></head><body>${escapeHtml(content)}</body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  }


}
