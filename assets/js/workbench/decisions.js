import { loadState, saveState } from "./store.js?v=3";
import { escapeHtml } from "./utils.mjs?v=1";

const KEY = "aaron-workbench:v1:decisions";
const state = loadState(KEY, { records: [] });
const root = document.querySelector("#decisions-workspace");

if (root) {
  document.querySelector("#decision-form").addEventListener("submit", (event) => addRecord(event, "decision"));
  document.querySelector("#belief-form").addEventListener("submit", (event) => addRecord(event, "belief"));
  document.querySelector("#decision-list").addEventListener("click", (event) => {
    const id = Number(event.target.closest("[data-delete-record]")?.dataset.deleteRecord);
    if (!id) return;
    state.records = state.records.filter((record) => record.id !== id);
    saveState(KEY, state);
    render();
  });
  document.querySelector("#export-decisions").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "decision-memory.json";
    link.click();
    URL.revokeObjectURL(url);
  });
  render();

  function addRecord(event, type) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    state.records.unshift({ id: Date.now(), type, created: new Date().toISOString(), ...data });
    saveState(KEY, state);
    event.currentTarget.reset();
    render();
  }
  function render() {
    document.querySelector("#decision-list").innerHTML = state.records.length ? state.records.map((record) => {
      const title = record.type === "belief" ? `${record.before} → ${record.after}` : record.title;
      const detail = record.type === "belief" ? record.evidence : `${record.context}${record.reason ? ` · ${record.reason}` : ""}`;
      return `<article class="record"><div><time>${record.type} · ${new Date(record.created).toLocaleDateString()}</time><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail || "No additional context.")}</p>${record.review ? `<time>Review ${escapeHtml(record.review)}</time>` : ""}</div><button class="workbench-icon-button" type="button" data-delete-record="${record.id}" aria-label="Delete record" title="Delete">×</button></article>`;
    }).join("") : `<p class="tool-intro">No decisions recorded yet.</p>`;
  }
}

