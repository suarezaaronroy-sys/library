import { loadState, saveState } from "./store.js?v=4";
import {
  escapeHtml,
  getRegistry,
  openResource
} from "./registry.mjs?v=1";

const STORAGE_KEY = "aaron-workbench:v1:canvas";
const registry = getRegistry();
const root = document.querySelector("#systems-canvas");
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
let connectMode = false;
let connectSource;
let saveTimer;
let dirty = false;

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
  cy = window.cytoscape({
    container: document.querySelector("#canvas-graph"),
    elements: activeCanvas().elements,
    layout: { name: "preset" },
    minZoom: 0.15,
    maxZoom: 3,
    wheelSensitivity: 0.18,
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
      { selector: ".connect-source", style: { "border-width": 5, "border-color": "#2563eb" }}
    ]
  });
  const viewport = activeCanvas().viewport;
  if (viewport?.zoom) cy.zoom(viewport.zoom);
  if (viewport?.pan) cy.pan(viewport.pan);
  cy.on("select", "node", (event) => selectNode(event.target));
  cy.on("unselect", "node", () => {
    if (!cy.$("node:selected").length) clearInspector();
  });
  cy.on("tap", "node", handleConnectTap);
  cy.on("add remove dragfree position", scheduleSave);
  cy.on("zoom pan", scheduleSave);
  updateEmptyState();
  window.setTimeout(() => {
    window.clearTimeout(saveTimer);
    dirty = false;
    setStatus("Loaded locally");
  }, 0);
}

function bindControls() {
  root.addEventListener("click", (event) => {
    const nodeType = event.target.closest("[data-add-node]")?.dataset.addNode;
    const action = event.target.closest("[data-canvas-action]")?.dataset.canvasAction;
    if (nodeType) addNode(nodeType);
    if (action) handleAction(action);
  });
  document.querySelector("#canvas-select").addEventListener("change", (event) => switchCanvas(event.target.value));
  document.querySelector("#canvas-title").addEventListener("input", (event) => {
    activeCanvas().title = event.target.value.trim() || "Untitled Canvas";
    scheduleSave();
  });
  document.querySelector("#canvas-properties").addEventListener("input", updateSelectedNode);
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
  document.addEventListener("keydown", (event) => {
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openCanvasSearch();
    } else if ((event.key === "Delete" || event.key === "Backspace") && !typing && cy.$(":selected").length) {
      event.preventDefault();
      deleteSelection();
    } else if (event.key === "Escape") {
      closeCanvasSearch();
      cancelConnect();
    }
  });
}

function addNode(type) {
  const center = { x: document.querySelector("#canvas-graph").clientWidth / 2, y: document.querySelector("#canvas-graph").clientHeight / 2 };
  const zoom = cy.zoom();
  const pan = cy.pan();
  const position = { x: (center.x - pan.x) / zoom, y: (center.y - pan.y) / zoom };
  const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const node = cy.add(nodeJson(id, type, `New ${type.replace("-", " ")}`, position.x, position.y, NODE_COLORS[type]));
  node.select();
  updateEmptyState();
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
}

function clearInspector() {
  selectedNode = null;
  document.querySelector("#canvas-properties").disabled = true;
  document.querySelector("#canvas-inspector-title").textContent = "Nothing selected";
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

function handleConnectTap(event) {
  if (!connectMode) return;
  const node = event.target;
  if (!connectSource) {
    connectSource = node;
    node.addClass("connect-source");
    setStatus("Choose the destination node");
    return;
  }
  if (connectSource.id() !== node.id()) {
    cy.add({ data: { id: `edge-${Date.now()}`, source: connectSource.id(), target: node.id(), label: "" } });
  }
  cancelConnect();
  scheduleSave();
}

function handleAction(action) {
  if (action === "save") saveActive("Saved locally");
  if (action === "new") newCanvas();
  if (action === "delete") deleteCanvas();
  if (action === "connect") toggleConnect();
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
  scheduleSave();
}

function switchCanvas(id) {
  captureActive();
  state.activeId = id;
  renderCanvasSelect();
  loadActiveIntoGraph();
  scheduleSave();
}

function loadActiveIntoGraph() {
  cancelConnect();
  clearInspector();
  cy.elements().remove();
  cy.add(activeCanvas().elements);
  cy.layout({ name: "preset" }).run();
  cy.zoom(activeCanvas().viewport?.zoom || 1);
  cy.pan(activeCanvas().viewport?.pan || { x: 0, y: 0 });
  updateEmptyState();
}

function toggleConnect() {
  connectMode = !connectMode;
  document.querySelector("#canvas-connect").classList.toggle("primary", connectMode);
  setStatus(connectMode ? "Choose the source node" : dirty ? "Unsaved · click Save" : "Loaded locally");
  if (!connectMode) cancelConnect();
}

function cancelConnect() {
  connectMode = false;
  connectSource?.removeClass("connect-source");
  connectSource = null;
  document.querySelector("#canvas-connect").classList.remove("primary");
}

function deleteSelection() {
  const selection = cy.$(":selected");
  if (!selection.length) {
    setStatus("Select a node or connector first");
    return;
  }
  selection.remove();
  clearInspector();
  updateEmptyState();
  scheduleSave();
}

function scheduleSave() {
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
