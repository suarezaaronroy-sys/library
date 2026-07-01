import { loadState, saveState } from "./store.js?v=4";
import "./whiteboard-modes.js?v=2";
import { createWorkbenchGraph } from "./graph-engine.js?v=1";
import {
  escapeHtml,
  getRegistry,
  openResource
} from "./registry.mjs?v=1";

const STORAGE_KEY = "aaron-workbench:v1:canvas";
const registry = getRegistry();
const root = document.querySelector("#systems-canvas");
const HISTORY_LIMIT = 3;
const GRID_SIZE = 24;
const NODE_COLORS = {
  process: "#0d9488",
  decision: "#c2410c",
  note: "#b45309",
  database: "#2563eb",
  document: "#57534e",
  tool: "#15803d",
  grimoire: "#7c3aed",
  "library-note": "#be185d",
  link: "#475569"
};
let state = loadState(STORAGE_KEY, createInitialState());
let cy;
let selectedNode;
let saveTimer;
let dirty = false;
let restoringGraph = false;
let dragSnapshot;
let propertyEditSnapshot;
let titleEditSnapshot;
let connectionDrag;
let undoStack = [];
let redoStack = [];

if (root && window.cytoscape) {
  normalizeState();
  populateResourceSelect();
  renderCanvasSelect();
  initializeGraph();
  bindControls();
} else if (root) {
  document.querySelector("#canvas-save-status").textContent = "Canvas engine unavailable";
}

function createInitialState() {
  const id = `canvas-${Date.now()}`;
  return {
    schemaVersion: 1,
    activeId: id,
    canvases: {
      [id]: createCanvas(id, "Workbench Map", true)
    }
  };
}

function createCanvas(id, title, seeded = false) {
  const elements = seeded ? {
    nodes: [
      nodeJson("node-desk", "tool", "Operator's Desk", 170, 190, "#15803d", "desk"),
      nodeJson("node-resources", "database", "Resource Hub", 430, 110, "#2563eb", "resource-hub"),
      nodeJson("node-canvas", "process", "Systems Canvas", 430, 280, "#0d9488", "systems-canvas")
    ],
    edges: [
      { data: { id: "edge-desk-resources", source: "node-desk", target: "node-resources", label: "" } },
      { data: { id: "edge-desk-canvas", source: "node-desk", target: "node-canvas", label: "" } }
    ]
  } : { nodes: [], edges: [] };
  return {
    id,
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    viewport: { zoom: 1, pan: { x: 0, y: 0 } },
    elements
  };
}

function nodeJson(id, type, title, x, y, color, resourceId = "") {
  return {
    data: { id, type, title, description: "", category: "", tags: "", links: "", status: "Active", color, resourceId },
    position: { x, y }
  };
}

function normalizeState() {
  if (!state.canvases || typeof state.canvases !== "object") state = createInitialState();
  if (!state.canvases[state.activeId]) state.activeId = Object.keys(state.canvases)[0];
  if (!state.activeId) {
    const replacement = createInitialState();
    state = replacement;
  }
  state.preferences = { autosave: false, ...(state.preferences || {}) };
  Object.values(state.canvases).forEach((canvas) => {
    canvas.elements?.nodes?.forEach((node) => {
      if (node.data?.title === "Systems Canvas") node.data.title = "Whiteboard";
    });
  });
}

function activeCanvas() {
  return state.canvases[state.activeId];
}

function populateResourceSelect() {
  const select = document.querySelector('#canvas-properties [name="resourceId"]');
  select.innerHTML = `<option value="">None</option>${registry.map((resource) =>
    `<option value="${escapeHtml(resource.id)}">${escapeHtml(resource.name)}</option>`
  ).join("")}`;
}

function renderCanvasSelect() {
  const select = document.querySelector("#canvas-select");
  select.innerHTML = Object.values(state.canvases)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map((canvas) => `<option value="${escapeHtml(canvas.id)}"${canvas.id === state.activeId ? " selected" : ""}>${escapeHtml(canvas.title)}</option>`)
    .join("");
  document.querySelector("#canvas-title").value = activeCanvas().title;
  document.querySelector("#canvas-autosave").checked = Boolean(state.preferences.autosave);
}

function initializeGraph() {
  cy = createWorkbenchGraph({
    container: document.querySelector("#canvas-graph"),
    elements: activeCanvas().elements,
    layout: { name: "preset" },
    minZoom: 0.15,
    maxZoom: 3,
    style: [
      { selector: "node", style: {
        "width": 154, "height": 54, "shape": "round-rectangle",
        "background-color": "data(color)", "background-opacity": 0.12,
        "border-width": 1.5, "border-color": "data(color)",
        "label": "data(title)", "font-family": "DM Sans", "font-size": 12,
        "color": "#1c1917", "text-wrap": "wrap", "text-max-width": 130,
        "text-valign": "center", "text-halign": "center"
      }},
      { selector: 'node[type = "decision"]', style: { "shape": "diamond", "width": 96, "height": 96, "text-max-width": 72 }},
      { selector: 'node[type = "note"]', style: { "shape": "ellipse", "width": 112, "height": 72 }},
      { selector: 'node[type = "database"]', style: { "shape": "barrel" }},
      { selector: 'node[type = "document"]', style: { "shape": "round-tag" }},
      { selector: 'node[type = "link"]', style: { "shape": "ellipse" }},
      { selector: "edge", style: {
        "width": 1.5, "line-color": "#a8a29e", "target-arrow-color": "#78716c",
        "target-arrow-shape": "triangle", "arrow-scale": 0.8, "curve-style": "straight",
        "label": "data(label)", "font-size": 9, "color": "#57534e"
      }},
      { selector: ":selected", style: { "border-width": 4, "border-color": "#c2410c", "line-color": "#c2410c", "target-arrow-color": "#c2410c" }},
      { selector: ".search-match", style: { "border-width": 5, "border-color": "#15803d", "background-opacity": 0.24 }},
      { selector: ".connection-target", style: { "border-width": 5, "border-color": "#c2410c", "background-opacity": 0.24 }}
    ]
  });
  const viewport = activeCanvas().viewport;
  if (viewport?.zoom) cy.zoom(viewport.zoom);
  if (viewport?.pan) cy.pan(viewport.pan);
  cy.on("select", "node", (event) => selectNode(event.target));
  cy.on("unselect", "node", () => {
    if (!cy.$("node:selected").length) clearInspector();
  });
  cy.on("grab", "node", () => {
    dragSnapshot = snapshotCanvas();
  });
  cy.on("drag", "node", updateNodePorts);
  cy.on("dragfree", "node", (event) => finishNodeDrag(event.target));
  cy.on("add remove", scheduleSave);
  cy.on("zoom pan", () => {
    updateNodePorts();
    scheduleSave();
  });
  cy.on("resize", updateNodePorts);
  updateEmptyState();
  updateHistoryButtons();
  window.setTimeout(() => {
    window.clearTimeout(saveTimer);
    dirty = false;
    setStatus("Loaded locally");
  }, 0);
}

function bindControls() {
  const title = document.querySelector("#canvas-title");
  const properties = document.querySelector("#canvas-properties");
  root.addEventListener("click", (event) => {
    const nodeType = event.target.closest("[data-add-node]")?.dataset.addNode;
    const action = event.target.closest("[data-canvas-action]")?.dataset.canvasAction;
    if (nodeType) addNode(nodeType);
    if (action) handleAction(action);
  });
  document.querySelector("#canvas-select").addEventListener("change", (event) => switchCanvas(event.target.value));
  title.addEventListener("focus", () => {
    titleEditSnapshot = snapshotCanvas();
  });
  title.addEventListener("input", (event) => {
    activeCanvas().title = event.target.value.trim() || "Untitled Canvas";
    scheduleSave();
  });
  title.addEventListener("blur", () => {
    commitEditSnapshot("title");
  });
  properties.addEventListener("focusin", () => {
    if (!propertyEditSnapshot) propertyEditSnapshot = snapshotCanvas();
  });
  properties.addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (!properties.contains(document.activeElement)) commitEditSnapshot("property");
    }, 0);
  });
  properties.addEventListener("input", updateSelectedNode);
  document.querySelector("#canvas-autosave").addEventListener("change", (event) => {
    state.preferences.autosave = event.target.checked;
    if (state.preferences.autosave) saveActive("Autosave on");
    else {
      saveState(STORAGE_KEY, state);
      setStatus(dirty ? "Unsaved · autosave off" : "Autosave off");
    }
  });
  document.querySelector("#canvas-open-resource").addEventListener("click", () => {
    const resource = registry.find((item) => item.id === selectedNode?.data("resourceId"));
    openResource(resource);
  });
  document.querySelector("#canvas-search-trigger").addEventListener("click", openCanvasSearch);
  document.querySelector("#canvas-search").addEventListener("input", searchCanvas);
  document.querySelector("#canvas-import").addEventListener("change", (event) => importCanvas(event.target.files[0]));
  document.querySelector("#canvas-node-ports").addEventListener("pointerdown", startConnectionDrag);
  window.addEventListener("resize", updateNodePorts);
  window.addEventListener("whiteboard:board-shown", () => {
    cy.resize();
    updateNodePorts();
  });
  document.addEventListener("keydown", (event) => {
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openCanvasSearch();
    } else if (!typing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    } else if (!typing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
    } else if ((event.key === "Delete" || event.key === "Backspace") && !typing && cy.$(":selected").length) {
      event.preventDefault();
      deleteSelection();
    } else if (event.key === "Escape") {
      closeCanvasSearch();
      cancelConnectionDrag();
    }
  });
}

function addNode(type) {
  const center = { x: document.querySelector("#canvas-graph").clientWidth / 2, y: document.querySelector("#canvas-graph").clientHeight / 2 };
  const zoom = cy.zoom();
  const pan = cy.pan();
  const position = { x: (center.x - pan.x) / zoom, y: (center.y - pan.y) / zoom };
  const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  recordHistory();
  const node = cy.add(nodeJson(id, type, `New ${type.replace("-", " ")}`, snap(position.x), snap(position.y), NODE_COLORS[type]));
  node.select();
  updateEmptyState();
  updateNodePorts();
  scheduleSave();
}

function selectNode(node) {
  selectedNode = node;
  const properties = document.querySelector("#canvas-properties");
  properties.disabled = false;
  document.querySelector("#canvas-inspector-title").textContent = node.data("title") || "Untitled node";
  ["type", "title", "description", "category", "tags", "links", "status", "color", "resourceId"].forEach((name) => {
    const field = properties.elements.namedItem(name);
    if (field) field.value = node.data(name) || (name === "color" ? NODE_COLORS[node.data("type")] : "");
  });
  document.querySelector("#canvas-open-resource").disabled = !node.data("resourceId");
  updateNodePorts();
}

function clearInspector() {
  selectedNode = null;
  document.querySelector("#canvas-properties").disabled = true;
  document.querySelector("#canvas-inspector-title").textContent = "Nothing selected";
  document.querySelector("#canvas-node-ports").hidden = true;
}

function updateSelectedNode(event) {
  if (!selectedNode) return;
  const name = event.target.name;
  if (!name) return;
  selectedNode.data(name, event.target.value);
  if (name === "type" && !selectedNode.data("color")) selectedNode.data("color", NODE_COLORS[event.target.value]);
  document.querySelector("#canvas-inspector-title").textContent = selectedNode.data("title") || "Untitled node";
  document.querySelector("#canvas-open-resource").disabled = !selectedNode.data("resourceId");
  scheduleSave();
}

function handleAction(action) {
  if (action === "save") saveActive("Saved locally");
  if (action === "new") newCanvas();
  if (action === "delete") deleteCanvas();
  if (action === "undo") undo();
  if (action === "redo") redo();
  if (action === "delete-selection") deleteSelection();
  if (action === "fit") cy.fit(cy.elements(), 50);
  if (action === "export-json") exportJson();
  if (action === "export-png") exportPng();
  if (action === "export-svg") exportSvg();
  if (action === "import-json") document.querySelector("#canvas-import").click();
  if (action === "close-search") closeCanvasSearch();
}

function newCanvas() {
  captureActive();
  const id = `canvas-${Date.now()}`;
  state.canvases[id] = createCanvas(id, `Canvas ${Object.keys(state.canvases).length + 1}`);
  state.activeId = id;
  renderCanvasSelect();
  loadActiveIntoGraph();
  resetHistory();
  scheduleSave();
}

function deleteCanvas() {
  if (Object.keys(state.canvases).length === 1) {
    setStatus("Keep at least one canvas");
    return;
  }
  if (!window.confirm(`Delete “${activeCanvas().title}”? This cannot be undone unless you exported it.`)) return;
  delete state.canvases[state.activeId];
  state.activeId = Object.keys(state.canvases)[0];
  renderCanvasSelect();
  loadActiveIntoGraph();
  resetHistory();
  scheduleSave();
}

function switchCanvas(id) {
  captureActive();
  state.activeId = id;
  renderCanvasSelect();
  loadActiveIntoGraph();
  resetHistory();
  scheduleSave();
}

function loadActiveIntoGraph() {
  restoringGraph = true;
  cancelConnectionDrag();
  clearInspector();
  cy.elements().remove();
  cy.add(activeCanvas().elements);
  cy.layout({ name: "preset" }).run();
  cy.zoom(activeCanvas().viewport?.zoom || 1);
  cy.pan(activeCanvas().viewport?.pan || { x: 0, y: 0 });
  restoringGraph = false;
  updateEmptyState();
}

function deleteSelection() {
  const selection = cy.$(":selected");
  if (!selection.length) {
    setStatus("Select a node or connector first");
    return;
  }
  recordHistory();
  selection.remove();
  clearInspector();
  updateEmptyState();
  scheduleSave();
}

function finishNodeDrag(node) {
  const before = dragSnapshot;
  node.position({
    x: snap(node.position("x")),
    y: snap(node.position("y"))
  });
  dragSnapshot = null;
  updateNodePorts();
  if (before && snapshotKey(before) !== snapshotKey(snapshotCanvas())) recordHistory(before);
  scheduleSave();
}

function snap(value) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function startConnectionDrag(event) {
  const port = event.target.closest("[data-canvas-port]");
  if (!port || !selectedNode) return;
  event.preventDefault();
  event.stopPropagation();
  const start = portPoint(selectedNode, port.dataset.canvasPort);
  connectionDrag = {
    source: selectedNode,
    before: snapshotCanvas(),
    start,
    target: null
  };
  const preview = document.querySelector("#canvas-connection-preview");
  preview.classList.add("is-active");
  setPreviewLine(start, start);
  document.addEventListener("pointermove", moveConnectionDrag);
  document.addEventListener("pointerup", finishConnectionDrag, { once: true });
  setStatus("Drag to another node");
}

function moveConnectionDrag(event) {
  if (!connectionDrag) return;
  const point = stagePoint(event);
  const target = nodeAtPoint(point, connectionDrag.source);
  cy.nodes().removeClass("connection-target");
  target?.addClass("connection-target");
  connectionDrag.target = target;
  setPreviewLine(connectionDrag.start, point);
}

function finishConnectionDrag(event) {
  if (!connectionDrag) return;
  moveConnectionDrag(event);
  const { source, target, before } = connectionDrag;
  const duplicate = target && cy.edges().some((edge) =>
    edge.source().id() === source.id() && edge.target().id() === target.id()
  );
  if (target && !duplicate) {
    cy.add({ data: { id: `edge-${Date.now()}`, source: source.id(), target: target.id(), label: "" } });
    recordHistory(before);
    scheduleSave();
    setStatus("Connected · click Save");
  } else {
    setStatus(duplicate ? "Those nodes are already connected" : dirty ? "Unsaved · click Save" : "Loaded locally");
  }
  cancelConnectionDrag();
}

function cancelConnectionDrag() {
  document.removeEventListener("pointermove", moveConnectionDrag);
  document.removeEventListener("pointerup", finishConnectionDrag);
  cy?.nodes().removeClass("connection-target");
  document.querySelector("#canvas-connection-preview")?.classList.remove("is-active");
  connectionDrag = null;
}

function stagePoint(event) {
  const bounds = document.querySelector(".canvas-stage").getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

function nodeAtPoint(point, source) {
  return cy.nodes().filter((node) => {
    if (node.id() === source.id()) return false;
    const bounds = node.renderedBoundingBox();
    const tolerance = 10;
    return point.x >= bounds.x1 - tolerance && point.x <= bounds.x2 + tolerance &&
      point.y >= bounds.y1 - tolerance && point.y <= bounds.y2 + tolerance;
  })[0];
}

function portPoint(node, side) {
  const bounds = node.renderedBoundingBox();
  const centerX = (bounds.x1 + bounds.x2) / 2;
  const centerY = (bounds.y1 + bounds.y2) / 2;
  if (side === "top") return { x: centerX, y: bounds.y1 };
  if (side === "right") return { x: bounds.x2, y: centerY };
  if (side === "bottom") return { x: centerX, y: bounds.y2 };
  return { x: bounds.x1, y: centerY };
}

function updateNodePorts() {
  const ports = document.querySelector("#canvas-node-ports");
  if (!ports || !selectedNode || selectedNode.removed()) {
    if (ports) ports.hidden = true;
    return;
  }
  ports.hidden = false;
  ports.querySelectorAll("[data-canvas-port]").forEach((port) => {
    const point = portPoint(selectedNode, port.dataset.canvasPort);
    port.style.left = `${point.x}px`;
    port.style.top = `${point.y}px`;
  });
}

function setPreviewLine(start, end) {
  const line = document.querySelector("#canvas-connection-preview line");
  line.setAttribute("x1", start.x);
  line.setAttribute("y1", start.y);
  line.setAttribute("x2", end.x);
  line.setAttribute("y2", end.y);
}

function snapshotCanvas() {
  return {
    title: document.querySelector("#canvas-title").value,
    elements: JSON.parse(JSON.stringify(cy.json().elements))
  };
}

function snapshotKey(snapshot) {
  return JSON.stringify(snapshot);
}

function recordHistory(snapshot = snapshotCanvas()) {
  const currentKey = undoStack.length ? snapshotKey(undoStack[undoStack.length - 1]) : "";
  if (snapshotKey(snapshot) !== currentKey) undoStack.push(snapshot);
  undoStack = undoStack.slice(-HISTORY_LIMIT);
  redoStack = [];
  updateHistoryButtons();
}

function resetHistory() {
  undoStack = [];
  redoStack = [];
  dragSnapshot = null;
  propertyEditSnapshot = null;
  titleEditSnapshot = null;
  updateHistoryButtons();
}

function undo() {
  const previous = undoStack.pop();
  if (!previous) return;
  redoStack.push(snapshotCanvas());
  redoStack = redoStack.slice(-HISTORY_LIMIT);
  restoreSnapshot(previous);
  setStatus("Undone · click Save");
}

function redo() {
  const next = redoStack.pop();
  if (!next) return;
  undoStack.push(snapshotCanvas());
  undoStack = undoStack.slice(-HISTORY_LIMIT);
  restoreSnapshot(next);
  setStatus("Redone · click Save");
}

function restoreSnapshot(snapshot) {
  restoringGraph = true;
  cancelConnectionDrag();
  clearInspector();
  cy.elements().remove();
  cy.add(snapshot.elements);
  document.querySelector("#canvas-title").value = snapshot.title;
  activeCanvas().title = snapshot.title.trim() || "Untitled Canvas";
  restoringGraph = false;
  updateEmptyState();
  updateHistoryButtons();
  scheduleSave();
}

function updateHistoryButtons() {
  document.querySelector("#canvas-undo").disabled = undoStack.length === 0;
  document.querySelector("#canvas-redo").disabled = redoStack.length === 0;
}

function commitEditSnapshot(kind) {
  const snapshot = kind === "title" ? titleEditSnapshot : propertyEditSnapshot;
  if (snapshot && snapshotKey(snapshot) !== snapshotKey(snapshotCanvas())) recordHistory(snapshot);
  if (kind === "title") titleEditSnapshot = null;
  else propertyEditSnapshot = null;
}

function scheduleSave() {
  if (restoringGraph) return;
  captureActive();
  dirty = true;
  window.clearTimeout(saveTimer);
  setStatus(state.preferences.autosave ? "Saving…" : "Unsaved · click Save");
  if (state.preferences.autosave) saveTimer = window.setTimeout(() => saveActive("Saved automatically"), 350);
}

function captureActive() {
  if (!cy) return;
  const canvas = activeCanvas();
  canvas.title = document.querySelector("#canvas-title").value.trim() || "Untitled Canvas";
  canvas.updatedAt = new Date().toISOString();
  canvas.elements = cy.json().elements;
  canvas.viewport = { zoom: cy.zoom(), pan: cy.pan() };
}

function saveActive(message = "Saved locally") {
  captureActive();
  saveState(STORAGE_KEY, state);
  dirty = false;
  renderCanvasSelect();
  setStatus(message);
}

function setStatus(message) {
  document.querySelector("#canvas-save-status").textContent = message;
}

function updateEmptyState() {
  document.querySelector("#canvas-empty").hidden = cy.nodes().length > 0;
}

function openCanvasSearch() {
  const panel = document.querySelector("#canvas-search-panel");
  panel.hidden = false;
  const input = document.querySelector("#canvas-search");
  input.value = "";
  input.focus();
  searchCanvas();
}

function closeCanvasSearch() {
  document.querySelector("#canvas-search-panel").hidden = true;
  cy?.nodes().removeClass("search-match");
}

function searchCanvas() {
  const query = document.querySelector("#canvas-search").value.trim().toLowerCase();
  cy.nodes().removeClass("search-match");
  if (!query) {
    document.querySelector("#canvas-search-count").textContent = `${cy.nodes().length} nodes`;
    return;
  }
  const matches = cy.nodes().filter((node) =>
    ["title", "description", "category", "tags", "status"].some((field) => String(node.data(field) || "").toLowerCase().includes(query))
  );
  matches.addClass("search-match");
  document.querySelector("#canvas-search-count").textContent = `${matches.length} match${matches.length === 1 ? "" : "es"}`;
  if (matches.length) cy.fit(matches, 80);
}

function exportJson() {
  captureActive();
  downloadBlob(JSON.stringify({ type: "systems-canvas", version: 1, canvas: activeCanvas() }, null, 2), `${fileName()}.json`, "application/json");
}

function exportPng() {
  const blob = cy.png({ full: true, scale: 2, bg: "#f5f2ec", output: "blob" });
  downloadBlob(blob, `${fileName()}.png`, "image/png");
}

function exportSvg() {
  const nodes = cy.nodes();
  const edges = cy.edges();
  if (!nodes.length) return;
  const bounds = nodes.boundingBox();
  const padding = 80;
  const width = Math.max(320, bounds.w + padding * 2);
  const height = Math.max(240, bounds.h + padding * 2);
  const offsetX = padding - bounds.x1;
  const offsetY = padding - bounds.y1;
  const lines = edges.map((edge) => {
    const source = edge.source().position();
    const target = edge.target().position();
    return `<line x1="${source.x + offsetX}" y1="${source.y + offsetY}" x2="${target.x + offsetX}" y2="${target.y + offsetY}" stroke="#78716c" stroke-width="2" marker-end="url(#arrow)"/>`;
  }).join("");
  const shapes = nodes.map((node) => {
    const position = node.position();
    const x = position.x + offsetX;
    const y = position.y + offsetY;
    const color = safeColor(node.data("color"));
    const title = escapeXml(node.data("title"));
    if (node.data("type") === "decision") {
      return `<g><polygon points="${x},${y - 48} ${x + 48},${y} ${x},${y + 48} ${x - 48},${y}" fill="${color}18" stroke="${color}" stroke-width="2"/><text x="${x}" y="${y + 4}" text-anchor="middle">${title}</text></g>`;
    }
    return `<g><rect x="${x - 77}" y="${y - 27}" width="154" height="54" rx="7" fill="${color}18" stroke="${color}" stroke-width="2"/><text x="${x}" y="${y + 4}" text-anchor="middle">${title}</text></g>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#78716c"/></marker></defs><rect width="100%" height="100%" fill="#f5f2ec"/>${lines}${shapes}</svg>`;
  downloadBlob(svg, `${fileName()}.svg`, "image/svg+xml");
}

async function importCanvas(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const imported = payload.canvas || payload;
    if (!imported.elements || !Array.isArray(imported.elements.nodes) || !Array.isArray(imported.elements.edges)) throw new Error("Invalid canvas");
    const id = `canvas-${Date.now()}`;
    state.canvases[id] = {
      ...createCanvas(id, imported.title || "Imported Canvas"),
      ...imported,
      id,
      title: `${imported.title || "Imported Canvas"} (imported)`,
      updatedAt: new Date().toISOString()
    };
    state.activeId = id;
    renderCanvasSelect();
    loadActiveIntoGraph();
    resetHistory();
    scheduleSave();
    setStatus("Imported · click Save to keep");
  } catch {
    setStatus("Import failed: choose a valid Systems Canvas JSON file");
  } finally {
    document.querySelector("#canvas-import").value = "";
  }
}

function fileName() {
  return activeCanvas().title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "systems-canvas";
}

function downloadBlob(content, filename, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeXml(value) {
  return String(value || "").replace(/[<>&'"]/g, (character) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;"
  })[character]);
}

function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#0d9488";
}
