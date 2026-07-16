import { exportAllState, importAllState } from "./store.js?v=5";

const DESK_KEY = "aaron-workbench:v1:desk-command-center";
const SESSION_KEY = "aaron-workbench:v1:session";

const backupExport = document.querySelector("#backup-export");
const backupImportBtn = document.querySelector("#backup-import");
const backupFile = document.querySelector("#backup-file");
const backupStatus = document.querySelector("#backup-status");
const commandOpen = document.querySelector("#command-open");
const commandPalette = document.querySelector("#command-palette");
const commandInput = document.querySelector("#command-input");
const commandResults = document.querySelector("#command-results");
const captureForm = document.querySelector("#quick-capture-form");
const captureInput = document.querySelector("#quick-capture-input");
const captureList = document.querySelector("#capture-list");
const copyToday = document.querySelector("#copy-today");
const clearCaptures = document.querySelector("#clear-captures");
const scratchpad = document.querySelector("#desk-scratchpad");
const scratchpadToolbar = document.querySelector("#desk-format-toolbar");
const scratchpadBlockFormat = document.querySelector("#desk-block-format");
const scratchpadFontFamily = document.querySelector("#desk-font-family");
const scratchpadFontSize = document.querySelector("#desk-font-size");
const scratchpadCount = document.querySelector("#scratchpad-count");
const deskSaveState = document.querySelector("#desk-save-state");
const deviceState = document.querySelector("#desk-device-state");
const resumeCard = document.querySelector("#resume-card");
const recentWorkspaces = document.querySelector("#recent-workspaces");
const clipboardInput = document.querySelector("#desk-clipboard");
const clipboardCopy = document.querySelector("#clipboard-copy");
const clipboardCapture = document.querySelector("#clipboard-capture");
const clipboardClear = document.querySelector("#clipboard-clear");

const tools = [
  { title: "Billing", detail: "Invoices, rate calculator, currency, budgets", href: "/library/workbench/billing/", keys: "invoice money rate currency budget calculator" },
  { title: "Scheduling", detail: "Clock, stopwatch, countdowns, timezone overlap", href: "/library/workbench/scheduling/", keys: "time clock timer remote timezone" },
  { title: "Writing", detail: "Formatted notepad, snippets, Markdown preview", href: "/library/workbench/writing/", keys: "scratchpad note markdown clipboard snippet" },
  { title: "Reporting", detail: "Status reports, handoffs, checklist reminders", href: "/library/workbench/reporting/", keys: "eod task checklist reminder handoff report" },
  { title: "Whiteboard", detail: "Flowcharts, pipeline, automation dry runs", href: "/library/workbench/whiteboard/", keys: "diagram flow pipeline automation meeting bpmn mind map" },
  { title: "CRM", detail: "Pipeline simulation, JSON, regex, API tools", href: "/library/workbench/crm/", keys: "json regex webhook api pipeline" },
  { title: "Marketing", detail: "UTM, campaign names, funnel math, ROI", href: "/library/workbench/marketing/", keys: "utm funnel roi campaign" },
  { title: "Library tools", detail: "Grimoire and Note builders, metadata", href: "/library/workbench/library-tools/", keys: "grimoire metadata slug note builder" },
  { title: "Decisions", detail: "Decision journal and belief revision log", href: "/library/workbench/decisions/", keys: "decision belief review why changed" },
  { title: "Resources", detail: "Tool directory, private notes, favorites", href: "/library/workbench/resources/", keys: "links resources tools reference" },
  { title: "Capture thought", detail: "Focus the quick capture box", action: "capture", keys: "quick capture task thought inbox" },
  { title: "Scratchpad", detail: "Focus the sticky scratchpad", action: "scratchpad", keys: "sticky note scratchpad write" },
  { title: "Clipboard", detail: "Focus the manual paste buffer", action: "clipboard", keys: "paste copy clipboard buffer move text" },
  { title: "Export backup", detail: "Download all local Workbench data", action: "backup", keys: "backup export data restore" }
];

function loadDesk() {
  try {
    return JSON.parse(localStorage.getItem(DESK_KEY)) || { scratchpad: "", captures: [], lastSaved: null };
  } catch {
    return { scratchpad: "", captures: [], lastSaved: null };
  }
}

const state = loadDesk();
state.captures ||= [];
state.clipboard ||= "";
state.scratchpad ||= "";
state.scratchpadHtml ||= state.scratchpad ? plainTextToEditorHtml(state.scratchpad) : "";
let scratchpadRange = null;

function saveDesk() {
  state.lastSaved = new Date().toISOString();
  try {
    localStorage.setItem(DESK_KEY, JSON.stringify(state));
    updateSaveState();
  } catch {
    if (deskSaveState) deskSaveState.textContent = "Save failed";
  }
}

function formatTime(value) {
  if (!value) return "Never";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function plainTextToEditorHtml(value) {
  return value ? `<p>${escapeHtml(value).replace(/\r?\n/g, "<br>")}</p>` : "";
}

function sanitizeEditorHtml(value) {
  const template = document.createElement("template");
  template.innerHTML = String(value || "");
  const allowed = new Set(["P", "DIV", "BR", "H1", "H2", "H3", "BLOCKQUOTE", "UL", "OL", "LI", "STRONG", "B", "EM", "I", "U", "S", "STRIKE", "FONT"]);
  const allowedFonts = new Set(["DM Sans", "Fraunces", "DM Mono"]);
  Array.from(template.content.querySelectorAll("script,style,iframe,object,embed,link,meta")).forEach((node) => node.remove());
  Array.from(template.content.querySelectorAll("*")).reverse().forEach((node) => {
    if (!allowed.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }
    const indent = /^[1-6]$/.test(node.dataset.indent || "") ? node.dataset.indent : "";
    const face = node.tagName === "FONT" && allowedFonts.has(node.getAttribute("face")) ? node.getAttribute("face") : "";
    const size = node.tagName === "FONT" && /^[1-6]$/.test(node.getAttribute("size") || "") ? node.getAttribute("size") : "";
    Array.from(node.attributes).forEach((attribute) => node.removeAttribute(attribute.name));
    if (indent) node.dataset.indent = indent;
    if (face) node.setAttribute("face", face);
    if (size) node.setAttribute("size", size);
  });
  return template.innerHTML;
}

function updateSaveState() {
  if (deskSaveState) deskSaveState.textContent = `Saved ${formatTime(state.lastSaved)}`;
}

function updateDeviceState() {
  if (!deviceState) return;
  deviceState.textContent = navigator.onLine ? "Online · local" : "Offline · local";
  deviceState.classList.toggle("is-offline", !navigator.onLine);
}

function renderCaptures() {
  if (!captureList) return;
  if (!state.captures.length) {
    captureList.innerHTML = `<p class="desk-empty">Nothing captured yet today.</p>`;
    return;
  }
  captureList.innerHTML = state.captures.map((item, index) => `
    <article class="capture-item">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <div><time>${formatTime(item.created)}</time><p>${escapeHtml(item.text)}</p></div>
      <button type="button" data-delete-capture="${item.id}" aria-label="Delete capture">×</button>
    </article>
  `).join("");
}

function updateScratchpadCount() {
  if (!scratchpadCount || !scratchpad) return;
  const text = scratchpad.innerText.replace(/\u00a0/g, " ");
  scratchpadCount.textContent = `${text.length} chars`;
}

function selectionIsInScratchpad() {
  const selection = window.getSelection();
  return Boolean(selection?.rangeCount && scratchpad?.contains(selection.anchorNode));
}

function rememberScratchpadSelection() {
  if (!selectionIsInScratchpad()) return;
  scratchpadRange = window.getSelection().getRangeAt(0).cloneRange();
}

function restoreScratchpadSelection() {
  if (!scratchpad) return false;
  const selection = window.getSelection();
  if (scratchpadRange && scratchpad.contains(scratchpadRange.commonAncestorContainer)) {
    selection.removeAllRanges();
    selection.addRange(scratchpadRange);
    return true;
  }
  const range = document.createRange();
  range.selectNodeContents(scratchpad);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  scratchpadRange = range.cloneRange();
  return true;
}

function updateScratchpadToolbar() {
  if (!scratchpadToolbar || !selectionIsInScratchpad()) return;
  scratchpadToolbar.querySelectorAll("[data-editor-toggle]").forEach((button) => {
    let active = false;
    try {
      active = document.queryCommandState(button.dataset.editorCommand);
    } catch {}
    button.setAttribute("aria-pressed", String(active));
  });
  if (scratchpadBlockFormat) {
    let block = "p";
    try {
      block = String(document.queryCommandValue("formatBlock") || "p").replace(/[<>]/g, "").toLowerCase();
    } catch {}
    scratchpadBlockFormat.value = ["p", "h1", "h2", "h3", "blockquote"].includes(block) ? block : "p";
  }
  if (scratchpadFontFamily) {
    let family = "DM Sans";
    try {
      family = String(document.queryCommandValue("fontName") || family).replace(/["']/g, "");
    } catch {}
    scratchpadFontFamily.value = ["DM Sans", "Fraunces", "DM Mono"].includes(family) ? family : "DM Sans";
  }
  if (scratchpadFontSize) {
    let size = "3";
    try {
      size = String(document.queryCommandValue("fontSize") || size);
    } catch {}
    scratchpadFontSize.value = ["2", "3", "4", "5", "6"].includes(size) ? size : "3";
  }
}

function saveScratchpad() {
  if (!scratchpad) return;
  state.scratchpadHtml = scratchpad.innerHTML;
  state.scratchpad = scratchpad.innerText.replace(/\u00a0/g, " ");
  updateScratchpadCount();
  saveDesk();
}

function selectedScratchpadBlocks() {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return [];
  let range = selection.getRangeAt(0);
  let blocks = Array.from(scratchpad.children).filter((node) => {
    try {
      return range.intersectsNode(node);
    } catch {
      return false;
    }
  });
  const blockTags = new Set(["P", "DIV", "H1", "H2", "H3", "BLOCKQUOTE"]);
  if (!blocks.some((node) => blockTags.has(node.tagName)) && scratchpad.textContent.trim()) {
    document.execCommand("formatBlock", false, "p");
    rememberScratchpadSelection();
    range = window.getSelection().getRangeAt(0);
    blocks = Array.from(scratchpad.children).filter((node) => {
      try {
        return range.intersectsNode(node);
      } catch {
        return false;
      }
    });
  }
  return blocks.filter((node) => blockTags.has(node.tagName));
}

function adjustScratchpadIndent(delta) {
  let inList = false;
  try {
    inList = document.queryCommandState("insertUnorderedList") || document.queryCommandState("insertOrderedList");
  } catch {}
  if (inList) {
    document.execCommand(delta > 0 ? "indent" : "outdent");
    return;
  }
  selectedScratchpadBlocks().forEach((block) => {
    const current = Number(block.dataset.indent || 0);
    if (delta < 0 && current === 0 && block.tagName === "BLOCKQUOTE") {
      const paragraph = document.createElement("p");
      while (block.firstChild) paragraph.appendChild(block.firstChild);
      block.replaceWith(paragraph);
      return;
    }
    const next = Math.max(0, Math.min(6, current + delta));
    if (next) block.dataset.indent = String(next);
    else delete block.dataset.indent;
  });
}

function runEditorCommand(command, value = null) {
  if (!scratchpad) return;
  restoreScratchpadSelection();
  scratchpad.focus({ preventScroll: true });
  if (command === "indent" || command === "outdent") {
    adjustScratchpadIndent(command === "indent" ? 1 : -1);
  } else {
    document.execCommand(command, false, value);
  }
  rememberScratchpadSelection();
  saveScratchpad();
  updateScratchpadToolbar();
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || {};
  } catch {
    return {};
  }
}

function renderSession() {
  const session = readSession();
  const recent = (session.recent || []).filter((item) => item && item.title && item.url);
  if (resumeCard) {
    const last = recent.find((item) => !/\/workbench\/?$/.test(item.url)) || recent[0];
    resumeCard.innerHTML = last
      ? `<span>Last workspace</span><strong>${escapeHtml(last.title)}</strong><small>${formatTime(last.at)}</small><a class="workbench-button primary" href="${escapeHtml(last.url)}">Resume</a>`
      : `<span>Last workspace</span><strong>No saved session yet</strong><small>Open a workspace once and it appears here.</small>`;
  }
  if (recentWorkspaces) {
    recentWorkspaces.innerHTML = recent.slice(0, 5).map((item) => `<a href="${escapeHtml(item.url)}"><span>${escapeHtml(item.title)}</span><small>${formatTime(item.at)}</small></a>`).join("");
  }
}

function closeCommand() {
  if (commandPalette) commandPalette.hidden = true;
}

function runCommand(item) {
  if (!item) return;
  closeCommand();
  if (item.href) {
    location.href = item.href;
  } else if (item.action === "capture") {
    captureInput?.focus();
  } else if (item.action === "scratchpad") {
    scratchpad?.focus();
  } else if (item.action === "clipboard") {
    clipboardInput?.focus();
  } else if (item.action === "backup") {
    backupExport?.click();
  }
}

function renderCommands(query = "") {
  if (!commandResults) return;
  const q = query.trim().toLowerCase();
  const matches = tools.filter((item) => !q || `${item.title} ${item.detail} ${item.keys}`.toLowerCase().includes(q)).slice(0, 8);
  commandResults.innerHTML = matches.map((item, index) => `
    <button type="button" data-command-index="${index}">
      <span>${escapeHtml(item.title)}</span>
      <small>${escapeHtml(item.detail)}</small>
    </button>
  `).join("") || `<p class="desk-empty">No command found.</p>`;
  commandResults.querySelectorAll("[data-command-index]").forEach((button) => {
    button.addEventListener("click", () => runCommand(matches[Number(button.dataset.commandIndex)]));
  });
}

function openCommand() {
  if (!commandPalette || !commandInput) return;
  commandPalette.hidden = false;
  commandInput.value = "";
  renderCommands();
  requestAnimationFrame(() => commandInput.focus());
}

if (scratchpad) {
  scratchpad.innerHTML = sanitizeEditorHtml(state.scratchpadHtml);
  try {
    document.execCommand("styleWithCSS", false, false);
  } catch {}
  updateScratchpadCount();
  scratchpad.addEventListener("input", saveScratchpad);
  scratchpad.addEventListener("keyup", () => {
    rememberScratchpadSelection();
    updateScratchpadToolbar();
  });
  scratchpad.addEventListener("mouseup", () => {
    rememberScratchpadSelection();
    updateScratchpadToolbar();
  });
  scratchpad.addEventListener("paste", (event) => {
    event.preventDefault();
    document.execCommand("insertText", false, event.clipboardData?.getData("text/plain") || "");
  });
  scratchpad.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      runEditorCommand(event.shiftKey ? "outdent" : "indent");
    } else if (event.altKey && event.shiftKey && event.key === "5") {
      event.preventDefault();
      runEditorCommand("strikeThrough");
    }
  });
  document.addEventListener("selectionchange", () => {
    rememberScratchpadSelection();
    updateScratchpadToolbar();
  });
  scratchpadToolbar?.addEventListener("mousedown", (event) => {
    if (event.target.closest("button")) event.preventDefault();
  });
  scratchpadToolbar?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-editor-command]");
    if (button) runEditorCommand(button.dataset.editorCommand);
  });
  scratchpadBlockFormat?.addEventListener("change", () => {
    runEditorCommand("formatBlock", scratchpadBlockFormat.value);
  });
  scratchpadFontFamily?.addEventListener("change", () => {
    runEditorCommand("fontName", scratchpadFontFamily.value);
  });
  scratchpadFontSize?.addEventListener("change", () => {
    runEditorCommand("fontSize", scratchpadFontSize.value);
  });
}

if (clipboardInput) {
  clipboardInput.value = state.clipboard || "";
  clipboardInput.addEventListener("input", () => {
    state.clipboard = clipboardInput.value;
    saveDesk();
  });
}

captureForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = captureInput?.value.trim();
  if (!text) return;
  state.captures.unshift({ id: crypto.randomUUID?.() || String(Date.now()), text, created: new Date().toISOString() });
  state.captures = state.captures.slice(0, 30);
  captureInput.value = "";
  saveDesk();
  renderCaptures();
});

captureList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-capture]");
  if (!button) return;
  state.captures = state.captures.filter((item) => item.id !== button.dataset.deleteCapture);
  saveDesk();
  renderCaptures();
});

copyToday?.addEventListener("click", async () => {
  const lines = [
    "# Today",
    "",
    "## Captures",
    ...(state.captures.length ? state.captures.map((item) => `- ${formatTime(item.created)} - ${item.text}`) : ["- None"]),
    "",
    "## Clipboard",
    state.clipboard || "None",
    "",
    "## Scratchpad",
    state.scratchpad || "None"
  ];
  try {
    await navigator.clipboard?.writeText(lines.join("\n"));
    if (deskSaveState) deskSaveState.textContent = "Copied today";
  } catch {
    if (deskSaveState) deskSaveState.textContent = "Copy blocked by browser";
  }
});

clearCaptures?.addEventListener("click", () => {
  state.captures = [];
  saveDesk();
  renderCaptures();
});

clipboardCopy?.addEventListener("click", async () => {
  const text = clipboardInput?.value || "";
  if (!text.trim()) return;
  try {
    await navigator.clipboard?.writeText(text);
    if (deskSaveState) deskSaveState.textContent = "Copied clipboard";
  } catch {
    if (deskSaveState) deskSaveState.textContent = "Copy blocked by browser";
  }
});

clipboardCapture?.addEventListener("click", () => {
  const text = clipboardInput?.value.trim();
  if (!text) return;
  state.captures.unshift({ id: crypto.randomUUID?.() || String(Date.now()), text: `Clipboard: ${text}`, created: new Date().toISOString() });
  state.captures = state.captures.slice(0, 30);
  saveDesk();
  renderCaptures();
});

clipboardClear?.addEventListener("click", () => {
  state.clipboard = "";
  if (clipboardInput) clipboardInput.value = "";
  saveDesk();
});

commandOpen?.addEventListener("click", openCommand);
commandInput?.addEventListener("input", () => renderCommands(commandInput.value));
commandInput?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const first = commandResults?.querySelector("[data-command-index]");
  if (first) first.click();
});
commandPalette?.addEventListener("click", (event) => {
  if (event.target.closest("[data-command-close]")) closeCommand();
});
document.addEventListener("keydown", (event) => {
  if (event.altKey && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openCommand();
  }
  if (event.key === "Escape" && commandPalette && !commandPalette.hidden) closeCommand();
});
window.addEventListener("online", updateDeviceState);
window.addEventListener("offline", updateDeviceState);

updateSaveState();
updateDeviceState();
renderCaptures();
renderSession();

if (backupExport && backupImportBtn && backupFile && backupStatus) {
  backupExport.addEventListener("click", () => {
    const payload = exportAllState();
    const count = Object.keys(payload.data).length;
    const stamp = payload.exportedAt.slice(0, 10);
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `workbench-backup-${stamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
    backupStatus.textContent = `Backup prepared - ${count} saved ${count === 1 ? "key" : "keys"}.`;
  });

  backupImportBtn.addEventListener("click", () => backupFile.click());
  backupFile.addEventListener("change", () => {
    const file = backupFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let imported = -1;
      try {
        imported = importAllState(JSON.parse(String(reader.result)));
      } catch {}
      backupStatus.textContent = imported < 0
        ? "That file isn't a Workbench backup."
        : `Restored ${imported} ${imported === 1 ? "key" : "keys"} - reload any open workspace to apply.`;
      backupFile.value = "";
    };
    reader.readAsText(file);
  });
}
