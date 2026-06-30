import {
  buildInvoiceSummary,
  buildMonthStatuses,
  calculateBilling,
  cycleDayState,
  daysInMonth,
  formatMonthKey,
  money,
  monthLabel,
  number
} from "./billing-core.mjs";
import { loadState, saveState } from "./store.js";

const STORAGE_KEY = "aaron-workbench:v1:billing";
const DEFAULT_STATE = {
  schemaVersion: 1,
  month: formatMonthKey(),
  profile: {
    clientName: "",
    currency: "GBP",
    rateType: "hourly",
    rate: 0,
    hoursPerDay: 8,
    fxRate: 74,
    notes: ""
  },
  months: {}
};

const root = document.querySelector("#billing-workspace");
if (root) {
  const state = loadState(STORAGE_KEY, DEFAULT_STATE);
  const form = document.querySelector("#billing-form");
  const monthInput = document.querySelector("#billing-month");
  const calendar = document.querySelector("#billing-calendar");
  const saveOutput = document.querySelector("#billing-save-state");
  const toast = document.querySelector("#billing-toast");
  let toastTimer;

  ensureMonth(state.month);
  hydrateForm();
  monthInput.value = state.month;
  render();

  form.addEventListener("input", () => {
    state.profile = Object.fromEntries(new FormData(form));
    state.profile.rate = Number(state.profile.rate);
    state.profile.hoursPerDay = Number(state.profile.hoursPerDay);
    state.profile.fxRate = Number(state.profile.fxRate);
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
    persist();
    renderSummary();
  });

  monthInput.addEventListener("change", () => {
    if (!monthInput.value) return;
    state.month = monthInput.value;
    ensureMonth(state.month);
    persist();
    render();
  });

  calendar.addEventListener("click", (event) => {
    const day = event.target.closest(".billing-day[data-date]");
    if (!day) return;
    const date = day.dataset.date;
    state.months[state.month][date] = cycleDayState(state.months[state.month][date]);
    persist();
    render();
  });

  root.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;

    if (action === "previous-month" || action === "next-month") {
      moveMonth(action === "next-month" ? 1 : -1);
    } else if (action === "select-weekdays") {
      state.months[state.month] = buildMonthStatuses(state.month);
      persist();
      render();
    } else if (action === "clear-month") {
      Object.keys(state.months[state.month]).forEach((date) => {
        state.months[state.month][date] = "off";
      });
      persist();
      render();
    } else if (action === "reset-month") {
      state.months[state.month] = buildMonthStatuses(state.month);
      persist();
      render();
      announce("Month reset to weekdays.");
    } else if (action === "copy-summary") {
      try {
        await navigator.clipboard.writeText(document.querySelector("#invoice-output").value);
        announce("Summary copied.");
      } catch {
        document.querySelector("#invoice-output").select();
        announce("Summary selected. Copy it from the text field.");
      }
    } else if (action === "download-csv") {
      downloadFile(csvExport(), `billing-${state.month}.csv`, "text/csv");
      announce("CSV prepared.");
    } else if (action === "export-json") {
      downloadFile(JSON.stringify(state, null, 2), `billing-${state.month}.json`, "application/json");
      announce("JSON backup prepared.");
    }
  });

  function ensureMonth(monthKey) {
    if (!state.months[monthKey]) state.months[monthKey] = buildMonthStatuses(monthKey);
  }

  function hydrateForm() {
    Object.entries(state.profile).forEach(([name, value]) => {
      const field = form.elements.namedItem(name);
      if (!field) return;
      if (field instanceof RadioNodeList) {
        field.value = value;
      } else {
        field.value = value;
      }
    });
    document.querySelector("#fx-rate").disabled = state.profile.currency === "PHP";
  }

  function render() {
    renderCalendar();
    renderSummary();
  }

  function renderCalendar() {
    const [year, month] = state.month.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1).getDay();
    const leadingCells = (firstDay + 6) % 7;
    const cells = [];

    for (let index = 0; index < leadingCells; index += 1) {
      cells.push(`<span class="billing-day is-empty" aria-hidden="true"></span>`);
    }

    for (let day = 1; day <= daysInMonth(state.month); day += 1) {
      const date = `${state.month}-${String(day).padStart(2, "0")}`;
      const status = state.months[state.month][date] || "off";
      const weekday = new Date(year, month - 1, day).getDay();
      const weekend = weekday === 0 || weekday === 6 ? " is-weekend" : "";
      cells.push(
        `<button type="button" class="billing-day${weekend}" role="gridcell" data-date="${date}" data-state="${status}" aria-label="${date}: ${status} day">
          <span class="billing-day-number">${day}</span>
          <span class="billing-day-state">${status}</span>
        </button>`
      );
    }

    calendar.innerHTML = cells.join("");
    calendar.setAttribute("aria-label", `${monthLabel(state.month)} billing day calendar`);
  }

  function renderSummary() {
    const totals = calculateBilling(state.profile, state.months[state.month]);
    const currency = state.profile.currency;
    document.querySelector("#selected-days").textContent = number(totals.billableDays);
    document.querySelector("#billable-hours").textContent = number(totals.billableHours);
    document.querySelector("#daily-total").textContent = `${currency} ${money(totals.dailyEquivalent)}`;
    document.querySelector("#native-total").textContent = `${currency} ${money(totals.nativeTotal)}`;
    document.querySelector("#php-total").textContent = `PHP ${money(totals.phpTotal)} estimate`;
    document.querySelector("#invoice-output").value = buildInvoiceSummary(state.profile, state.month, totals);
  }

  function moveMonth(offset) {
    const [year, month] = state.month.split("-").map(Number);
    state.month = formatMonthKey(new Date(year, month - 1 + offset, 1));
    ensureMonth(state.month);
    monthInput.value = state.month;
    persist();
    render();
  }

  function persist() {
    const saved = saveState(STORAGE_KEY, state);
    saveOutput.textContent = saved ? "Saved locally" : "Local save unavailable";
  }

  function announce(message) {
    toast.textContent = message;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.textContent = "";
    }, 2400);
  }

  function csvExport() {
    const totals = calculateBilling(state.profile, state.months[state.month]);
    const rows = [
      ["date", "status"],
      ...Object.entries(state.months[state.month]),
      [],
      ["client", state.profile.clientName],
      ["month", state.month],
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
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
  }

  function downloadFile(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
