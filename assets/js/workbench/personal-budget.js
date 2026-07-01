import { loadState, saveState } from "./store.js?v=4";
import {
  buildExpenseCalendar,
  buildPersonalBudgetSummary,
  calculatePersonalBudget
} from "./personal-budget-core.mjs?v=1";

const STORAGE_KEY = "aaron-workbench:v1:personal-budget";
const DEFAULT_STATE = {
  schemaVersion: 1,
  profile: {
    label: "Monthly baseline",
    currency: "PHP",
    monthlyIncome: 0,
    taxPercent: 10,
    savingsTarget: 0,
    notes: ""
  },
  expenses: []
};

const root = document.querySelector("#personal-budget-workspace");
if (root) {
  const state = normalizeState(loadState(STORAGE_KEY, DEFAULT_STATE));
  const profileForm = document.querySelector("#personal-budget-form");
  const expenseForm = document.querySelector("#personal-expense-form");
  const expenseList = document.querySelector("#personal-expense-list");
  const output = document.querySelector("#personal-budget-output");
  const status = document.querySelector("#personal-budget-status");

  hydrateProfile();
  render();

  profileForm.addEventListener("input", () => {
    state.profile = profileFromForm();
    persist("Budget saved locally");
  });
  expenseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(expenseForm));
    state.expenses.push({
      id: `expense-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: values.name.trim(),
      category: values.category,
      amount: Number(values.amount) || 0,
      dueDay: Math.min(28, Math.max(1, Number(values.dueDay) || 1))
    });
    expenseForm.reset();
    expenseForm.elements.namedItem("dueDay").value = 1;
    persist("Recurring expense added");
  });
  expenseList.addEventListener("click", (event) => {
    const id = event.target.closest("[data-expense-delete]")?.dataset.expenseDelete;
    if (!id) return;
    state.expenses = state.expenses.filter((item) => item.id !== id);
    persist("Recurring expense removed");
  });
  root.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-personal-budget-action]")?.dataset.personalBudgetAction;
    if (!action) return;
    if (action === "copy") {
      try {
        await navigator.clipboard.writeText(output.value);
        status.textContent = "Budget plan copied";
      } catch {
        output.select();
        status.textContent = "Budget plan selected - copy it from the text field";
      }
    }
    if (action === "txt") download(output.value, filename("txt"), "text/plain");
    if (action === "csv") download(expenseCsv(), filename("csv"), "text/csv");
    if (action === "ics") {
      download(buildExpenseCalendar(state.profile, state.expenses), filename("ics"), "text/calendar");
      status.textContent = state.expenses.length ? "Recurring calendar prepared" : "Calendar contains no expenses yet";
    }
    if (action === "json") {
      download(JSON.stringify({
        schemaVersion: 1,
        artifactType: "personal-budget",
        generatedAt: new Date().toISOString(),
        ...state
      }, null, 2), filename("json"), "application/json");
    }
  });

  function hydrateProfile() {
    Object.entries(state.profile).forEach(([name, value]) => {
      const control = profileForm.elements.namedItem(name);
      if (control) control.value = value;
    });
  }

  function profileFromForm() {
    const values = Object.fromEntries(new FormData(profileForm));
    ["monthlyIncome", "taxPercent", "savingsTarget"].forEach((name) => {
      values[name] = Number(values[name]) || 0;
    });
    return values;
  }

  function persist(message) {
    saveState(STORAGE_KEY, state);
    status.textContent = message;
    render();
  }

  function render() {
    const totals = calculatePersonalBudget(state.profile, state.expenses);
    const currency = state.profile.currency;
    document.querySelector("#personal-spendable").textContent = `${currency} ${money(totals.income - totals.taxReserve)}`;
    document.querySelector("#personal-expenses").textContent = `${currency} ${money(totals.recurringExpenses)}`;
    document.querySelector("#personal-savings").textContent = `${currency} ${money(totals.savingsTarget)}`;
    document.querySelector("#personal-free-cash").textContent = `${currency} ${money(totals.freeCash)}`;
    document.querySelector("#personal-commitment").textContent = `${number(totals.committedPercent)}% of income assigned`;
    output.value = buildPersonalBudgetSummary(state.profile, state.expenses, totals);
    expenseList.innerHTML = state.expenses.length
      ? state.expenses.slice().sort((a, b) => a.dueDay - b.dueDay).map((item) => `
        <article class="expense-row">
          <span>${String(item.dueDay).padStart(2, "0")}</span>
          <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)}</small></div>
          <b>${escapeHtml(currency)} ${money(item.amount)}</b>
          <button type="button" data-expense-delete="${item.id}" aria-label="Delete ${escapeHtml(item.name)}">×</button>
        </article>`).join("")
      : `<p class="resource-empty">No recurring expenses yet.</p>`;
  }

  function expenseCsv() {
    const rows = [
      ["name", "category", "amount", "currency", "due_day"],
      ...state.expenses.map((item) => [item.name, item.category, item.amount, state.profile.currency, item.dueDay])
    ];
    return rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  }

  function filename(extension) {
    return `${slug(state.profile.label || "personal-budget")}.${extension}`;
  }
}

function normalizeState(loaded) {
  return {
    schemaVersion: 1,
    profile: { ...DEFAULT_STATE.profile, ...(loaded.profile || {}) },
    expenses: Array.isArray(loaded.expenses) ? loaded.expenses : []
  };
}

function money(value) {
  return (Number(value) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function number(value) {
  return (Number(value) || 0).toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "personal-budget";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
