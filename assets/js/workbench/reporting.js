import { loadState, saveState } from "./store.js?v=5";
import { downloadFile, escapeHtml, slug } from "./utils.mjs?v=1";

const REPORT_STORAGE_KEY = "aaron-workbench:v1:desk-reports";
const CHECKLIST_STORAGE_KEY = "aaron-workbench:v1:checklist-reminders";
const today = new Date().toISOString().slice(0, 10);

const REPORT_DEFINITIONS = {
  eod: {
    title: "End-of-day report",
    intro: "Close the shift without reconstructing the day from memory.",
    fields: [
      field("completed", "Completed", "What was finished or delivered?"),
      field("inProgress", "Still in progress", "What is open and what state is it in?"),
      field("blockers", "Blockers / approvals needed", "What needs another person, decision, or access?"),
      field("tomorrow", "First actions tomorrow", "What should restart the next shift?"),
      field("links", "Evidence / links", "Tasks, documents, recordings, or screenshots")
    ]
  },
  status: {
    title: "Task status report",
    intro: "Turn working notes into an update people can scan and act on.",
    fields: [
      field("done", "Done", "Completed tasks, one per line"),
      field("inProgress", "In progress", "Task - current state - expected next step"),
      field("blocked", "Blocked", "Task - blocker - person or decision needed"),
      field("next", "Next", "Planned tasks in priority order"),
      field("risks", "Risks / changes", "Scope, timing, dependency, or expectation changes")
    ]
  },
  handoff: {
    title: "Work handoff",
    intro: "Move the reasoning with the work, not only the files.",
    fields: [
      field("objective", "Objective", "What outcome is this work supposed to produce?"),
      field("currentState", "Current state", "What exists and what is working now?"),
      field("decisions", "Decisions already made", "Decision - reason - consequence"),
      field("access", "Access / dependencies", "Systems, people, files, or approvals required"),
      field("nextAction", "Exact next action", "The first action the next person should take"),
      field("warnings", "Do not lose", "Constraints, failed attempts, or fragile assumptions")
    ]
  },
  meeting: {
    title: "Meeting debrief",
    intro: "Leave the meeting with decisions and ownership, not a transcript.",
    fields: [
      field("purpose", "Purpose", "Why did this meeting happen?"),
      field("decisions", "Decisions", "Decision - reason"),
      field("actions", "Actions and owners", "Action - owner - due date"),
      field("questions", "Open questions", "Question - person responsible for answering"),
      field("followUp", "Follow-up message", "What must be communicated after the meeting?")
    ]
  }
};

const CHECKLIST_DEFAULTS = {
  schemaVersion: 1,
  meta: {
    title: "Checklist reminders",
    owner: "",
    listDate: today,
    tag: "",
    mode: "markdown",
    context: ""
  },
  selectedId: "",
  items: []
};

initReportingViews();
initReports();
initChecklist();

function initReportingViews() {
  document.querySelectorAll("[data-reporting-view]").forEach((button) => {
    button.addEventListener("click", () => switchReportingView(button.dataset.reportingView));
  });
  if (window.location.hash === "#checklist") switchReportingView("checklist");
}

function switchReportingView(view) {
  const hash = view === "reports" ? window.location.pathname + window.location.search : `#${view}`;
  window.history.replaceState(null, "", hash);
  document.querySelectorAll("[data-reporting-view]").forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.reportingView === view));
  });
  document.querySelectorAll("[data-reporting-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.reportingPanel !== view;
  });
}

function initReports() {
  const root = document.querySelector("[data-reporting-panel='reports']");
  const form = document.querySelector("#report-form");
  const output = document.querySelector("#report-output");
  const status = document.querySelector("#report-status");
  if (!root || !form || !output || !status) return;

  let activeTemplate = "eod";
  const state = normalizeReportState(loadState(REPORT_STORAGE_KEY, {}));

  document.querySelectorAll("[data-report-template]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTemplate = button.dataset.reportTemplate;
      renderTemplate();
    });
  });

  form.addEventListener("input", () => {
    state[activeTemplate] = Object.fromEntries(new FormData(form));
    saveState(REPORT_STORAGE_KEY, state);
    renderOutput();
    status.textContent = "Saved locally";
  });

  root.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-report-action]")?.dataset.reportAction;
    if (!action) return;
    if (action === "copy") {
      await copyToClipboard(output.value, output, status, "Report copied", "Report selected - copy it from the text field");
    }
    if (action === "download") {
      downloadFile(output.value, reportFilename(activeTemplate, state[activeTemplate], "txt"), "text/plain");
      status.textContent = "Text report prepared";
    }
    if (action === "json") {
      downloadFile(JSON.stringify(reportPacket(activeTemplate, state[activeTemplate]), null, 2), reportFilename(activeTemplate, state[activeTemplate], "json"), "application/json");
      status.textContent = "Structured report prepared";
    }
    if (action === "clear") {
      state[activeTemplate] = blankReport();
      saveState(REPORT_STORAGE_KEY, state);
      renderTemplate();
      status.textContent = "Template cleared";
    }
  });

  renderTemplate();

  function renderTemplate() {
    const definition = REPORT_DEFINITIONS[activeTemplate];
    document.querySelectorAll("[data-report-template]").forEach((button) => {
      button.setAttribute("aria-selected", String(button.dataset.reportTemplate === activeTemplate));
    });
    document.querySelector("#report-form-title").textContent = definition.title;
    document.querySelector("#report-form-intro").textContent = definition.intro;
    document.querySelector("#report-fields").innerHTML = definition.fields.map((item) =>
      `<label class="workbench-field"><span>${escapeHtml(item.label)}</span><textarea name="${escapeHtml(item.name)}" placeholder="${escapeHtml(item.placeholder)}"></textarea></label>`
    ).join("");
    Object.entries(state[activeTemplate]).forEach(([name, value]) => {
      const control = form.elements.namedItem(name);
      if (control) control.value = value;
    });
    renderOutput();
  }

  function renderOutput() {
    const definition = REPORT_DEFINITIONS[activeTemplate];
    const report = state[activeTemplate];
    output.value = [
      `# ${definition.title.toUpperCase()}`,
      "",
      `Report type: ${activeTemplate}`,
      `Date: ${report.date || "Not set"}`,
      `Project / client: ${report.project || "Not set"}`,
      `Prepared by: ${report.author || "Not set"}`,
      "",
      ...definition.fields.flatMap((item) => [
        `## ${item.label}`,
        report[item.name]?.trim() || "None recorded.",
        ""
      ])
    ].join("\n").trim();
  }
}

function initChecklist() {
  const metaForm = document.querySelector("#checklist-meta");
  const itemForm = document.querySelector("#checklist-item-form");
  const list = document.querySelector("#checklist-items");
  const output = document.querySelector("#checklist-output");
  const status = document.querySelector("#checklist-status");
  const root = document.querySelector("[data-reporting-panel='checklist']");
  if (!metaForm || !itemForm || !list || !output || !status || !root) return;

  const state = normalizeChecklistState(loadState(CHECKLIST_STORAGE_KEY, CHECKLIST_DEFAULTS));

  Object.entries(state.meta).forEach(([name, value]) => {
    const control = metaForm.elements.namedItem(name);
    if (control) control.value = value;
  });

  metaForm.addEventListener("input", () => {
    state.meta = { ...state.meta, ...Object.fromEntries(new FormData(metaForm)) };
    persistChecklist(state, status);
    renderChecklist();
  });

  itemForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const item = formItem(itemForm);
    if (!item.title.trim()) {
      status.textContent = "Add an item title first";
      return;
    }
    state.items.push({ ...item, id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) });
    state.selectedId = state.items.at(-1).id;
    itemForm.reset();
    persistChecklist(state, status);
    renderChecklist();
    status.textContent = "Checklist item added";
  });

  list.addEventListener("click", (event) => {
    const row = event.target.closest("[data-checklist-id]");
    if (!row) return;
    const action = event.target.closest("[data-checklist-row-action]")?.dataset.checklistRowAction;
    const item = state.items.find((entry) => entry.id === row.dataset.checklistId);
    if (!item) return;
    if (action === "done") {
      item.status = item.status === "Done" ? "Next" : "Done";
      persistChecklist(state, status);
      renderChecklist();
      return;
    }
    if (action === "delete") {
      state.items = state.items.filter((entry) => entry.id !== item.id);
      if (state.selectedId === item.id) state.selectedId = state.items[0]?.id || "";
      persistChecklist(state, status);
      renderChecklist();
      status.textContent = "Checklist item removed";
      return;
    }
    state.selectedId = item.id;
    fillItemForm(itemForm, item);
    persistChecklist(state, status);
    renderChecklist();
  });

  root.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-checklist-action]")?.dataset.checklistAction;
    if (!action) return;
    if (action === "update") {
      const item = state.items.find((entry) => entry.id === state.selectedId);
      if (!item) {
        status.textContent = "Select an item to update";
        return;
      }
      Object.assign(item, formItem(itemForm));
      persistChecklist(state, status);
      renderChecklist();
      status.textContent = "Checklist item updated";
    }
    if (action === "reset-item") {
      state.selectedId = "";
      itemForm.reset();
      persistChecklist(state, status);
      renderChecklist();
      status.textContent = "Item form reset";
    }
    if (action === "copy") {
      await copyToClipboard(output.value, output, status, "Checklist copied", "Checklist selected - copy it from the text field");
    }
    if (action === "download") {
      downloadFile(output.value, `${slug(state.meta.title)}-checklist-${state.meta.listDate || today}.txt`, "text/plain");
      status.textContent = "Checklist text prepared";
    }
    if (action === "json") {
      downloadFile(JSON.stringify({ artifactType: "workbench-checklist", exportedAt: new Date().toISOString(), ...state }, null, 2), `${slug(state.meta.title)}-checklist-${state.meta.listDate || today}.json`, "application/json");
      status.textContent = "Checklist JSON prepared";
    }
    if (action === "clear") {
      state.items = [];
      state.selectedId = "";
      itemForm.reset();
      persistChecklist(state, status);
      renderChecklist();
      status.textContent = "Checklist cleared";
    }
  });

  renderChecklist();

  function renderChecklist() {
    list.innerHTML = state.items.length
      ? state.items.map(renderChecklistRow).join("")
      : `<p class="checklist-empty">No reminders yet. Add the first item and the formatted note will appear on the right.</p>`;
    output.value = formatChecklist(state);
  }

  function renderChecklistRow(item, index) {
    const isSelected = item.id === state.selectedId;
    const due = item.due ? `Due ${item.due}` : "No due date";
    const reminder = item.reminder ? `Reminder ${item.reminder}` : "No reminder";
    return `
      <article class="checklist-row${isSelected ? " is-selected" : ""}" data-checklist-id="${escapeHtml(item.id)}">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <div>
          <strong>${escapeHtml(item.title || "Untitled item")}</strong>
          <small>${escapeHtml(item.section || "General")} / ${escapeHtml(item.priority)} / ${escapeHtml(item.status)} / ${escapeHtml(due)} / ${escapeHtml(reminder)}</small>
        </div>
        <button type="button" data-checklist-row-action="done">${item.status === "Done" ? "Undo" : "Done"}</button>
        <button type="button" data-checklist-row-action="delete">Del</button>
      </article>`;
  }
}

function formatChecklist(state) {
  const meta = state.meta;
  const grouped = groupItems(state.items);
  const lines = [
    `# ${meta.title || "Checklist reminders"}`,
    "",
    `- List date: ${meta.listDate || "Not set"}`,
    `- Owner: ${meta.owner || "Not set"}`,
    `- Default tag: ${meta.tag || "None"}`,
    `- Generated: ${new Date().toISOString()}`,
    "",
    "## Context",
    meta.context?.trim() || "No context recorded.",
    ""
  ];

  if (!state.items.length) {
    lines.push("## Checklist", "No items recorded yet.");
    return lines.join("\n").trim();
  }

  for (const [section, items] of grouped) {
    lines.push(`## ${section}`);
    items.forEach((item) => {
      const checked = item.status === "Done" ? "x" : " ";
      lines.push(
        `### [${checked}] ${item.title || "Untitled item"}`,
        `- Priority: ${item.priority || "Medium"}`,
        `- Status: ${item.status || "Next"}`,
        `- Due: ${item.due || "Not set"}`,
        `- Reminder: ${item.reminder || "Not set"}`,
        `- Tags: ${compactTags(meta.tag, item.tags) || "None"}`,
        `- Link / evidence: ${item.link || "None"}`
      );
      const notes = linesFromText(item.notes);
      if (notes.length) {
        lines.push("- Notes:");
        notes.forEach((note) => lines.push(`  - ${note}`));
      }
      lines.push("");
    });
  }

  return meta.mode === "plain"
    ? lines.join("\n").replace(/^#{1,3}\s/gm, "").replace(/^- /gm, "* ").trim()
    : lines.join("\n").trim();
}

function groupItems(items) {
  const priorityOrder = { High: 0, Medium: 1, Low: 2, Someday: 3 };
  const statusOrder = { Next: 0, "In progress": 1, Scheduled: 2, Waiting: 3, Done: 4 };
  const sorted = [...items].sort((a, b) =>
    (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9)
    || String(a.due || "9999-99-99").localeCompare(String(b.due || "9999-99-99"))
    || (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
    || String(a.title).localeCompare(String(b.title))
  );
  const map = new Map();
  sorted.forEach((item) => {
    const section = item.section?.trim() || `${item.priority || "Medium"} priority`;
    if (!map.has(section)) map.set(section, []);
    map.get(section).push(item);
  });
  return map;
}

function formItem(form) {
  const data = Object.fromEntries(new FormData(form));
  return {
    title: data.title || "",
    section: data.section || "",
    priority: data.priority || "Medium",
    status: data.status || "Next",
    due: data.due || "",
    reminder: data.reminder || "",
    tags: data.tags || "",
    link: data.link || "",
    notes: data.notes || ""
  };
}

function fillItemForm(form, item) {
  Object.entries(item).forEach(([name, value]) => {
    const control = form.elements.namedItem(name);
    if (control) control.value = value;
  });
}

function compactTags(...values) {
  return values.flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .join(", ");
}

function linesFromText(value) {
  return String(value || "").replace(/\\n/g, "\n").split(/\r?\n/).map((line) => line.trim().replace(/^[-*]\s*/, "")).filter(Boolean);
}

async function copyToClipboard(text, fallbackControl, status, success, fallback) {
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = success;
  } catch {
    fallbackControl.select();
    status.textContent = fallback;
  }
}

function normalizeReportState(loaded) {
  return Object.fromEntries(Object.keys(REPORT_DEFINITIONS).map((key) => [
    key,
    { ...blankReport(), ...(loaded[key] || {}) }
  ]));
}

function normalizeChecklistState(loaded) {
  return {
    ...CHECKLIST_DEFAULTS,
    ...loaded,
    meta: { ...CHECKLIST_DEFAULTS.meta, ...(loaded.meta || {}) },
    items: Array.isArray(loaded.items) ? loaded.items : [],
    selectedId: loaded.selectedId || ""
  };
}

function persistChecklist(state, status) {
  saveState(CHECKLIST_STORAGE_KEY, state);
  if (status) status.textContent = "Saved locally";
}

function blankReport() {
  return { project: "", date: today, author: "" };
}

function field(name, label, placeholder) {
  return { name, label, placeholder };
}

function reportPacket(activeTemplate, fields) {
  return {
    schemaVersion: 1,
    artifactType: "workbench-report",
    reportType: activeTemplate,
    generatedAt: new Date().toISOString(),
    fields: { ...fields }
  };
}

function reportFilename(activeTemplate, report, extension) {
  const project = report.project || activeTemplate;
  return `${slug(project)}-${activeTemplate}-${report.date || today}.${extension}`;
}
