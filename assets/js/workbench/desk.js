import { loadState, saveState } from "./store.js?v=4";

const STORAGE_KEY = "aaron-workbench:v1:desk-reports";
const today = new Date().toISOString().slice(0, 10);
const DEFINITIONS = {
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
      field("inProgress", "In progress", "Task — current state — expected next step"),
      field("blocked", "Blocked", "Task — blocker — person or decision needed"),
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
      field("decisions", "Decisions already made", "Decision — reason — consequence"),
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
      field("decisions", "Decisions", "Decision — reason"),
      field("actions", "Actions and owners", "Action — owner — due date"),
      field("questions", "Open questions", "Question — person responsible for answering"),
      field("followUp", "Follow-up message", "What must be communicated after the meeting?")
    ]
  }
};

const root = document.querySelector(".desk-reporting");
if (root) {
  let activeTemplate = "eod";
  const state = normalizeState(loadState(STORAGE_KEY, {}));
  const form = document.querySelector("#report-form");
  const output = document.querySelector("#report-output");
  const status = document.querySelector("#report-status");

  document.querySelectorAll("[data-desk-view]").forEach((button) => {
    button.addEventListener("click", () => switchDeskView(button.dataset.deskView));
  });
  document.querySelectorAll("[data-report-template]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTemplate = button.dataset.reportTemplate;
      renderTemplate();
    });
  });
  form.addEventListener("input", () => {
    state[activeTemplate] = Object.fromEntries(new FormData(form));
    saveState(STORAGE_KEY, state);
    renderOutput();
    status.textContent = "Saved locally";
  });
  root.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-report-action]")?.dataset.reportAction;
    if (!action) return;
    if (action === "copy") {
      try {
        await navigator.clipboard.writeText(output.value);
        status.textContent = "Report copied";
      } catch {
        output.select();
        status.textContent = "Report selected - copy it from the text field";
      }
    }
    if (action === "download") {
      download(output.value, reportFilename("txt"), "text/plain");
      status.textContent = "Text report prepared";
    }
    if (action === "json") {
      download(JSON.stringify(reportPacket(), null, 2), reportFilename("json"), "application/json");
      status.textContent = "Structured report prepared";
    }
    if (action === "clear") {
      state[activeTemplate] = blankReport();
      saveState(STORAGE_KEY, state);
      renderTemplate();
      status.textContent = "Template cleared";
    }
  });

  renderTemplate();

  function switchDeskView(view) {
    document.querySelectorAll("[data-desk-view]").forEach((button) => {
      button.setAttribute("aria-selected", String(button.dataset.deskView === view));
    });
    document.querySelectorAll("[data-desk-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.deskPanel !== view;
    });
  }

  function renderTemplate() {
    const definition = DEFINITIONS[activeTemplate];
    document.querySelectorAll("[data-report-template]").forEach((button) => {
      button.setAttribute("aria-selected", String(button.dataset.reportTemplate === activeTemplate));
    });
    document.querySelector("#report-form-title").textContent = definition.title;
    document.querySelector("#report-form-intro").textContent = definition.intro;
    document.querySelector("#report-fields").innerHTML = definition.fields.map((item) =>
      `<label class="workbench-field"><span>${item.label}</span><textarea name="${item.name}" placeholder="${item.placeholder}"></textarea></label>`
    ).join("");
    Object.entries(state[activeTemplate]).forEach(([name, value]) => {
      const control = form.elements.namedItem(name);
      if (control) control.value = value;
    });
    renderOutput();
  }

  function renderOutput() {
    const definition = DEFINITIONS[activeTemplate];
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

  function reportPacket() {
    return {
      schemaVersion: 1,
      artifactType: "workbench-report",
      reportType: activeTemplate,
      generatedAt: new Date().toISOString(),
      fields: { ...state[activeTemplate] }
    };
  }

  function reportFilename(extension) {
    const project = state[activeTemplate].project || activeTemplate;
    return `${slug(project)}-${activeTemplate}-${state[activeTemplate].date || today}.${extension}`;
  }
}

function normalizeState(loaded) {
  return Object.fromEntries(Object.keys(DEFINITIONS).map((key) => [
    key,
    { ...blankReport(), ...(loaded[key] || {}) }
  ]));
}

function blankReport() {
  return { project: "", date: today, author: "" };
}

function field(name, label, placeholder) {
  return { name, label, placeholder };
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report";
}

function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
