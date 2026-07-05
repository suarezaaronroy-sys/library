import { loadState, saveState } from "./store.js?v=5";
import { FLOW_LIBRARY, PIPELINE_PATTERNS } from "./whiteboard-modes.js?v=3";
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
  link: "#475569",
  trigger: "#15803d",
  action: "#0d9488",
  condition: "#c2410c",
  delay: "#b45309",
  approval: "#7c3aed",
  failure: "#be123c"
};
const PIPELINE_LABELS = {
  sales: "Sales",
  delivery: "Client delivery",
  hiring: "Hiring",
  content: "Content production",
  support: "Support queue"
};
const GENERAL_STARTERS = {
  bpmn: {
    "bpmn-basic": "Basic business process",
    "bpmn-approval": "Approval workflow",
    "bpmn-incident": "Incident response"
  },
  org: {
    "org-small-team": "Small remote team",
    "org-client-delivery": "Client delivery team"
  },
  journey: {
    "journey-customer": "Customer journey",
    "journey-onboarding": "Client onboarding journey"
  },
  decision: {
    "decision-simple": "Simple decision",
    "decision-vendor": "Vendor selection"
  },
  mindmap: {
    "mindmap-project": "Project discovery",
    "mindmap-campaign": "Campaign planning"
  }
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
let dryRunToken = 0;
let undoStack = [];
let redoStack = [];

if (root && window.cytoscape) {
  normalizeState();
  populateTemplateSelect();
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

function createCanvas(id, title, seeded = false, meta = {}) {
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
    boardType: meta.boardType || "blank",
    templateId: meta.templateId || "",
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
  state.migrations = { unifiedWhiteboard: false, ...(state.migrations || {}) };
  Object.values(state.canvases).forEach((canvas) => {
    canvas.boardType ||= "blank";
    canvas.templateId ||= "";
    canvas.elements?.nodes?.forEach((node) => {
      if (node.data?.title === "Systems Canvas") node.data.title = "Whiteboard";
    });
  });
  migrateLegacyPipeline();
}

function activeCanvas() {
  return state.canvases[state.activeId];
}

function migrateLegacyPipeline() {
  if (state.migrations.unifiedWhiteboard) return;
  const legacy = loadState("aaron-workbench:v1:pipeline", { cards: [], stages: [], template: "sales" });
  if (legacy.cards?.length && legacy.stages?.length) {
    const id = `canvas-pipeline-migrated-${Date.now()}`;
    const canvas = createPipelineCanvas(id, legacy.template || "sales");
    const stageById = Object.fromEntries(legacy.stages.map((stage, index) => [stage.id, index]));
    legacy.cards.forEach((card, index) => {
      const stageIndex = stageById[card.stageId] ?? 0;
      const node = nodeJson(
        `legacy-${card.id}`,
        "note",
        card.title,
        150 + stageIndex * 220,
        380 + index * 84,
        NODE_COLORS.note
      );
      node.data.description = `Owner: ${card.owner || "Unassigned"}\nValue: ${card.value || 0}`;
      node.data.category = "Migrated pipeline item";
      canvas.elements.nodes.push(node);
    });
    canvas.title = `${PIPELINE_LABELS[legacy.template] || "Pipeline"} (migrated)`;
    state.canvases[id] = canvas;
  }
  state.migrations.unifiedWhiteboard = true;
  saveState(STORAGE_KEY, state);
}

function populateTemplateSelect() {
  const kind = document.querySelector("#canvas-template-kind").value;
  const select = document.querySelector("#canvas-template");
  const note = document.querySelector("#canvas-template-note");
  if (kind === "pipeline") {
    select.disabled = false;
    select.innerHTML = Object.entries(PIPELINE_LABELS).map(([value, label]) =>
      `<option value="${value}">${label}</option>`
    ).join("");
    note.textContent = "Creates an editable stage flow with a follow-up branch.";
  } else if (kind === "automation") {
    select.disabled = false;
    select.innerHTML = FLOW_LIBRARY.map((flow) =>
      `<option value="${flow.id}">${escapeHtml(flow.stage)} - ${escapeHtml(flow.title)}</option>`
    ).join("");
    note.textContent = "Creates an editable trigger, action path, and failure gate.";
  } else if (GENERAL_STARTERS[kind]) {
    select.disabled = false;
    select.innerHTML = Object.entries(GENERAL_STARTERS[kind]).map(([value, label]) =>
      `<option value="${value}">${label}</option>`
    ).join("");
    note.textContent = {
      bpmn: "Creates events, tasks, gateways, approvals, and exception paths.",
      org: "Creates an editable reporting structure for roles and teams.",
      journey: "Creates stages, touchpoints, decisions, and a visible pain point.",
      decision: "Creates labelled branches and editable outcomes.",
      mindmap: "Creates a central idea with movable thought branches."
    }[kind];
  } else {
    select.disabled = true;
    select.innerHTML = `<option value="blank">Blank canvas</option>`;
    note.textContent = "Start empty, or choose a guided flow for a quick meeting.";
  }
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
      { selector: 'node[type = "trigger"]', style: { "shape": "round-hexagon", "border-width": 2.5 }},
      { selector: 'node[type = "action"]', style: { "border-width": 2 }},
      { selector: 'node[type = "condition"]', style: { "shape": "diamond", "width": 112, "height": 112, "text-max-width": 78 }},
      { selector: 'node[type = "delay"]', style: { "shape": "ellipse", "width": 120, "height": 72 }},
      { selector: 'node[type = "approval"]', style: { "shape": "round-tag", "border-width": 2 }},
      { selector: 'node[type = "failure"]', style: { "shape": "diamond", "width": 112, "height": 112, "text-max-width": 78, "border-style": "dashed" }},
      { selector: "edge", style: {
        "width": 1.5, "line-color": "#a8a29e", "target-arrow-color": "#78716c",
        "target-arrow-shape": "triangle", "arrow-scale": 0.8, "curve-style": "straight",
        "label": "data(label)", "font-size": 9, "color": "#57534e"
      }},
      { selector: ":selected", style: { "border-width": 4, "border-color": "#c2410c", "line-color": "#c2410c", "target-arrow-color": "#c2410c" }},
      { selector: ".search-match", style: { "border-width": 5, "border-color": "#15803d", "background-opacity": 0.24 }},
      { selector: ".connection-target", style: { "border-width": 5, "border-color": "#c2410c", "background-opacity": 0.24 }},
      { selector: ".run-passed", style: { "background-opacity": 0.28, "border-width": 3, "border-color": "#15803d", "line-color": "#15803d", "target-arrow-color": "#15803d" }},
      { selector: ".run-current", style: { "background-opacity": 0.42, "border-width": 5, "border-color": "#c2410c" }}
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
  document.querySelector("#canvas-template-kind").addEventListener("change", populateTemplateSelect);
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
      exitPresentation();
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
  if (action === "create-template") createCanvasFromStarter();
  if (action === "dry-run") dryRunGraph();
  if (action === "present") enterPresentation();
  if (action === "exit-present") exitPresentation();
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

function createCanvasFromStarter() {
  captureActive();
  const kind = document.querySelector("#canvas-template-kind").value;
  const templateId = document.querySelector("#canvas-template").value;
  const id = `canvas-${Date.now()}`;
  let canvas;
  if (kind === "pipeline") canvas = createPipelineCanvas(id, templateId);
  else if (kind === "automation") canvas = createAutomationCanvas(id, templateId);
  else if (GENERAL_STARTERS[kind]) canvas = createGeneralStarterCanvas(id, kind, templateId);
  else canvas = createCanvas(id, `Canvas ${Object.keys(state.canvases).length + 1}`);
  state.canvases[id] = canvas;
  state.activeId = id;
  renderCanvasSelect();
  loadActiveIntoGraph();
  resetHistory();
  scheduleSave();
  setStatus(`${canvas.title} created - click Save`);
  window.requestAnimationFrame(() => cy.fit(cy.elements(), 70));
}

function createPipelineCanvas(id, templateId) {
  const stages = PIPELINE_PATTERNS[templateId] || PIPELINE_PATTERNS.sales;
  const title = `${PIPELINE_LABELS[templateId] || "Sales"} pipeline`;
  const canvas = createCanvas(id, title, false, { boardType: "pipeline", templateId });
  const nodes = stages.map((stage, index) => {
    const type = index === 0 ? "trigger" : index === stages.length - 1 ? "action" :
      /(decision|review|approval|qualified|triaged|screened)/i.test(stage) ? "condition" : "process";
    const node = nodeJson(`pipeline-${index + 1}`, type, stage, 140 + index * 220, 190, NODE_COLORS[type]);
    node.data.category = "Pipeline stage";
    node.data.description = `Editable ${stage.toLowerCase()} stage in the ${title.toLowerCase()}.`;
    return node;
  });
  const followUp = nodeJson("pipeline-follow-up", "failure", "Follow up / revise", 140 + Math.min(3, stages.length - 2) * 220, 390, NODE_COLORS.failure);
  followUp.data.description = "Use this branch for records that are not ready to move forward.";
  const edges = stages.slice(1).map((_, index) =>
    edgeJson(`pipeline-edge-${index + 1}`, `pipeline-${index + 1}`, `pipeline-${index + 2}`, "")
  );
  edges.push(edgeJson("pipeline-edge-follow-up", `pipeline-${Math.min(4, stages.length - 1)}`, followUp.data.id, "Not yet"));
  canvas.elements = { nodes: [...nodes, followUp], edges };
  return canvas;
}

function createAutomationCanvas(id, templateId) {
  const flow = FLOW_LIBRARY.find((item) => item.id === templateId) || FLOW_LIBRARY[0];
  const canvas = createCanvas(id, flow.title, false, { boardType: "automation", templateId: flow.id });
  const trigger = nodeJson("automation-trigger", "trigger", "Trigger", 120, 190, NODE_COLORS.trigger);
  trigger.data.description = flow.trigger;
  trigger.data.category = flow.stage;
  const actions = flow.steps.map((step, index) => {
    const type = automationNodeType(step);
    const node = nodeJson(`automation-step-${index + 1}`, type, step, 350 + index * 230, 190, NODE_COLORS[type]);
    node.data.category = `${flow.stage} - step ${index + 1}`;
    return node;
  });
  const failure = nodeJson("automation-failure", "failure", "Failure gate", 810, 410, NODE_COLORS.failure);
  failure.data.description = flow.failure;
  failure.data.category = "Failure to test";
  const bestPractice = nodeJson("automation-best-practice", "note", "Best practice", 350, 410, NODE_COLORS.note);
  bestPractice.data.description = flow.best;
  const edges = [
    edgeJson("automation-edge-trigger", trigger.data.id, actions[0].data.id, ""),
    ...actions.slice(1).map((_, index) =>
      edgeJson(`automation-edge-${index + 1}`, actions[index].data.id, actions[index + 1].data.id, "")
    ),
    edgeJson("automation-edge-failure", actions[Math.min(2, actions.length - 1)].data.id, failure.data.id, "Failure"),
    edgeJson("automation-edge-guidance", trigger.data.id, bestPractice.data.id, "Guidance")
  ];
  canvas.elements = { nodes: [trigger, ...actions, failure, bestPractice], edges };
  return canvas;
}

function createGeneralStarterCanvas(id, kind, templateId) {
  if (kind === "bpmn") return createBpmnCanvas(id, templateId);
  if (kind === "org") return createOrgCanvas(id, templateId);
  if (kind === "journey") return createJourneyCanvas(id, templateId);
  if (kind === "decision") return createDecisionCanvas(id, templateId);
  return createMindMapCanvas(id, templateId);
}

function createBpmnCanvas(id, templateId) {
  const variants = {
    "bpmn-basic": ["Request received", "Validate information", "Complete?", "Perform work", "Review output", "Process complete"],
    "bpmn-approval": ["Request submitted", "Check policy", "Within authority?", "Manager approval", "Record decision", "Notify requester"],
    "bpmn-incident": ["Incident reported", "Triage impact", "Critical?", "Contain incident", "Verify recovery", "Close incident"]
  };
  const labels = variants[templateId] || variants["bpmn-basic"];
  const title = GENERAL_STARTERS.bpmn[templateId] || "Basic business process";
  const canvas = createCanvas(id, title, false, { boardType: "bpmn", templateId });
  const types = ["trigger", "action", "condition", "action", "approval", "action"];
  const nodes = labels.map((label, index) => {
    const node = nodeJson(`bpmn-${index + 1}`, types[index], label, 120 + index * 220, 190, NODE_COLORS[types[index]]);
    node.data.category = "BPMN starter";
    return node;
  });
  const exception = nodeJson("bpmn-exception", "failure", "Exception / rework", 560, 410, NODE_COLORS.failure);
  exception.data.description = "Edit this path for missing information, rejection, or recovery work.";
  const edges = nodes.slice(1).map((_, index) => edgeJson(`bpmn-edge-${index + 1}`, nodes[index].data.id, nodes[index + 1].data.id, index === 2 ? "Yes" : ""));
  edges.push(edgeJson("bpmn-edge-exception", nodes[2].data.id, exception.data.id, "No"));
  edges.push(edgeJson("bpmn-edge-return", exception.data.id, nodes[1].data.id, "Revise"));
  canvas.elements = { nodes: [...nodes, exception], edges };
  return canvas;
}

function createOrgCanvas(id, templateId) {
  const clientDelivery = templateId === "org-client-delivery";
  const title = GENERAL_STARTERS.org[templateId] || "Small remote team";
  const canvas = createCanvas(id, title, false, { boardType: "org", templateId });
  const rootLabel = clientDelivery ? "Account lead" : "Team lead";
  const branchLabels = clientDelivery ? ["Strategy", "Delivery", "Client success"] : ["Operations", "Delivery", "Support"];
  const leafLabels = clientDelivery ? ["Research", "Build", "QA", "Reporting"] : ["Admin", "Specialist", "Coordinator", "Assistant"];
  const rootNode = nodeJson("org-root", "tool", rootLabel, 600, 100, NODE_COLORS.tool);
  const branches = branchLabels.map((label, index) => nodeJson(`org-branch-${index + 1}`, "process", label, 300 + index * 300, 280, NODE_COLORS.process));
  const leaves = leafLabels.map((label, index) => nodeJson(`org-leaf-${index + 1}`, "note", label, 180 + index * 280, 470, NODE_COLORS.note));
  const edges = [
    ...branches.map((node, index) => edgeJson(`org-edge-branch-${index}`, rootNode.data.id, node.data.id, "")),
    ...leaves.map((node, index) => edgeJson(`org-edge-leaf-${index}`, branches[Math.min(branches.length - 1, Math.floor(index * branches.length / leaves.length))].data.id, node.data.id, ""))
  ];
  canvas.elements = { nodes: [rootNode, ...branches, ...leaves], edges };
  return canvas;
}

function createJourneyCanvas(id, templateId) {
  const onboarding = templateId === "journey-onboarding";
  const title = GENERAL_STARTERS.journey[templateId] || "Customer journey";
  const labels = onboarding
    ? ["Agreement signed", "Access collected", "Kickoff", "First delivery", "Review", "Steady state"]
    : ["Awareness", "Consideration", "Decision", "Onboarding", "Value", "Renewal"];
  const canvas = createCanvas(id, title, false, { boardType: "journey", templateId });
  const nodes = labels.map((label, index) => {
    const type = index === 0 ? "trigger" : index === 2 ? "condition" : index === labels.length - 1 ? "approval" : "action";
    const node = nodeJson(`journey-${index + 1}`, type, label, 120 + index * 220, 190, NODE_COLORS[type]);
    node.data.category = "Journey stage";
    return node;
  });
  const pain = nodeJson("journey-pain", "failure", onboarding ? "Access blocker" : "Drop-off / friction", 780, 410, NODE_COLORS.failure);
  pain.data.description = "Name the moment where confidence, access, or momentum is lost.";
  const edges = nodes.slice(1).map((_, index) => edgeJson(`journey-edge-${index + 1}`, nodes[index].data.id, nodes[index + 1].data.id, ""));
  edges.push(edgeJson("journey-edge-pain", nodes[2].data.id, pain.data.id, "Friction"));
  canvas.elements = { nodes: [...nodes, pain], edges };
  return canvas;
}

function createDecisionCanvas(id, templateId) {
  const vendor = templateId === "decision-vendor";
  const title = GENERAL_STARTERS.decision[templateId] || "Simple decision";
  const canvas = createCanvas(id, title, false, { boardType: "decision", templateId });
  const question = nodeJson("decision-root", "condition", vendor ? "Does the vendor meet must-haves?" : "What decision are we making?", 600, 100, NODE_COLORS.condition);
  const optionA = nodeJson("decision-a", "condition", vendor ? "Budget acceptable?" : "Option A viable?", 330, 300, NODE_COLORS.condition);
  const optionB = nodeJson("decision-b", "condition", vendor ? "Risk acceptable?" : "Option B viable?", 870, 300, NODE_COLORS.condition);
  const outcomes = [
    nodeJson("decision-a-yes", "action", vendor ? "Shortlist vendor" : "Choose option A", 200, 520, NODE_COLORS.action),
    nodeJson("decision-a-no", "failure", vendor ? "Negotiate / reject" : "Reject option A", 450, 520, NODE_COLORS.failure),
    nodeJson("decision-b-yes", "action", vendor ? "Run final review" : "Choose option B", 750, 520, NODE_COLORS.action),
    nodeJson("decision-b-no", "failure", vendor ? "Find another vendor" : "Reframe decision", 1000, 520, NODE_COLORS.failure)
  ];
  const edges = [
    edgeJson("decision-edge-a", question.data.id, optionA.data.id, "Yes / A"),
    edgeJson("decision-edge-b", question.data.id, optionB.data.id, "No / B"),
    edgeJson("decision-edge-a-yes", optionA.data.id, outcomes[0].data.id, "Yes"),
    edgeJson("decision-edge-a-no", optionA.data.id, outcomes[1].data.id, "No"),
    edgeJson("decision-edge-b-yes", optionB.data.id, outcomes[2].data.id, "Yes"),
    edgeJson("decision-edge-b-no", optionB.data.id, outcomes[3].data.id, "No")
  ];
  canvas.elements = { nodes: [question, optionA, optionB, ...outcomes], edges };
  return canvas;
}

function createMindMapCanvas(id, templateId) {
  const campaign = templateId === "mindmap-campaign";
  const title = GENERAL_STARTERS.mindmap[templateId] || "Project discovery";
  const canvas = createCanvas(id, title, false, { boardType: "mindmap", templateId });
  const center = nodeJson("mindmap-center", "process", campaign ? "Campaign" : "Project", 600, 300, NODE_COLORS.process);
  const labels = campaign
    ? ["Audience", "Offer", "Message", "Channels", "Evidence", "Measurement"]
    : ["Outcome", "People", "Constraints", "Inputs", "Risks", "Next actions"];
  const positions = [[600, 80], [900, 150], [930, 430], [600, 540], [300, 430], [270, 150]];
  const branches = labels.map((label, index) => {
    const node = nodeJson(`mindmap-${index + 1}`, "note", label, positions[index][0], positions[index][1], NODE_COLORS.note);
    node.data.category = "Mind-map branch";
    return node;
  });
  canvas.elements = {
    nodes: [center, ...branches],
    edges: branches.map((node, index) => edgeJson(`mindmap-edge-${index + 1}`, center.data.id, node.data.id, ""))
  };
  return canvas;
}

function automationNodeType(step) {
  if (/(wait|schedule|timer|delay)/i.test(step)) return "delay";
  if (/(approval|approve|human review)/i.test(step)) return "approval";
  if (/(check|verify|confirm|classify|validate|compare|branch|choose|review|identify)/i.test(step)) return "condition";
  return "action";
}

function edgeJson(id, source, target, label) {
  return { data: { id, source, target, label } };
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
  ++dryRunToken;
  setRunStatus("");
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

async function dryRunGraph() {
  const token = ++dryRunToken;
  cy.elements().removeClass("run-passed run-current");
  const start = selectedNode && !selectedNode.removed()
    ? selectedNode
    : cy.nodes().filter((node) => node.indegree() === 0 && node.data("type") !== "note")[0] || cy.nodes()[0];
  if (!start) {
    setRunStatus("Add a node before starting a dry run.");
    return;
  }
  const queue = [start];
  const visited = new Set();
  let step = 0;
  setRunStatus(`Dry run starting from ${start.data("title")}.`);
  while (queue.length && token === dryRunToken) {
    const node = queue.shift();
    if (!node || visited.has(node.id()) || node.data("type") === "note") continue;
    visited.add(node.id());
    step += 1;
    cy.elements().removeClass("run-current");
    node.addClass("run-current");
    const incoming = node.incomers("edge");
    incoming.addClass("run-passed");
    setRunStatus(`Step ${step}: ${node.data("title")}`);
    await wait(430);
    node.removeClass("run-current").addClass("run-passed");
    node.outgoers("edge").forEach((edge) => {
      const target = edge.target();
      if (target.data("type") !== "note" && !visited.has(target.id())) queue.push(target);
    });
  }
  if (token === dryRunToken) setRunStatus(`Dry run complete - ${visited.size} nodes reviewed.`);
}

function enterPresentation() {
  root.classList.add("is-presenting");
  document.body.classList.add("whiteboard-presenting");
  window.requestAnimationFrame(() => {
    cy.resize();
    cy.fit(cy.elements(), 80);
    setRunStatus("Presentation mode - select a starting node or run the whole flow.");
  });
}

function exitPresentation() {
  if (!root.classList.contains("is-presenting")) return;
  root.classList.remove("is-presenting");
  document.body.classList.remove("whiteboard-presenting");
  ++dryRunToken;
  cy.elements().removeClass("run-passed run-current");
  window.requestAnimationFrame(() => {
    cy.resize();
    updateNodePorts();
  });
  setRunStatus("");
}

function setRunStatus(message) {
  document.querySelector("#canvas-run-status").textContent = message;
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
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
