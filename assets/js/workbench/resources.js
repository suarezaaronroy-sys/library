import {
  RESOURCE_STATE_DEFAULTS,
  escapeHtml,
  getRegistry,
  getResourceState,
  openResource,
  saveResourceState,
  searchResources
} from "./registry.mjs?v=1";
import "./quick-tools.js?v=2";

const registry = getRegistry();
const COLLECTIONS = [
  { id: "all", name: "Everything", description: "The complete registry", terms: [] },
  { id: "media", name: "Media", description: "Edit, capture, source", terms: ["video", "image", "photo", "stock", "audio", "screen capture"] },
  { id: "design", name: "Design", description: "Principles and production", terms: ["design", "ui", "ux", "color", "icon", "svg", "creative"] },
  { id: "campaigns", name: "Campaigns", description: "Research, launch, measure", terms: ["marketing", "campaign", "ads", "social", "seo", "email", "utm"] },
  { id: "funnels", name: "Funnels", description: "Journey and conversion", terms: ["funnel", "pipeline", "conversion", "prospecting", "remarketing", "sales", "crm"] },
  { id: "management", name: "Management", description: "Plan and coordinate", terms: ["management", "operations", "projects", "tasks", "team", "meetings", "decisions", "planning"] },
  { id: "automation", name: "Automation", description: "Connect and orchestrate", terms: ["automation", "workflow", "webhook", "integrations", "orchestration"] },
  { id: "writing", name: "Writing", description: "Draft, edit, publish", terms: ["writing", "editing", "publishing", "translation", "grammar", "markdown", "note"] },
  { id: "finance", name: "Finance", description: "Bill, budget, collect", terms: ["accounting", "invoice", "payment", "billing", "currency", "budget", "bookkeeping"] },
  { id: "build", name: "Build + AI", description: "Code, test, research", terms: ["development", "code", "ai", "json", "regex", "hosting", "research"] }
];
let state = getResourceState();
let selectedId = state.recents[0] || registry[0]?.id;
let filteredResources = registry;
let selectedCollection = "all";
let saveTimer;
const root = document.querySelector("#resource-hub");

if (root) {
  const searchInput = document.querySelector("#resource-search");
  const categorySelect = document.querySelector("#resource-category");
  const collectionList = document.querySelector("#resource-collection-list");
  const list = document.querySelector("#resource-list");
  const note = document.querySelector("#resource-note");
  const categories = [...new Set(registry.map((resource) => resource.category))].sort();
  categorySelect.innerHTML = `<option value="all">All categories</option>${categories.map((category) =>
    `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
  ).join("")}`;

  searchInput.addEventListener("input", render);
  categorySelect.addEventListener("change", render);
  collectionList.addEventListener("click", (event) => {
    const collection = event.target.closest("[data-resource-collection]")?.dataset.resourceCollection;
    if (!collection) return;
    selectedCollection = collection;
    categorySelect.value = "all";
    render();
  });
  root.addEventListener("change", (event) => {
    if (event.target.name === "resourceView") render();
    if (event.target.id === "resource-import") importMemory(event.target.files[0]);
  });
  list.addEventListener("click", (event) => {
    const favoriteId = event.target.closest("[data-favorite-resource]")?.dataset.favoriteResource;
    const openId = event.target.closest("[data-open-resource]")?.dataset.openResource;
    const selectId = event.target.closest("[data-select-resource]")?.dataset.selectResource;
    if (favoriteId) toggleFavorite(favoriteId);
    else if (openId) openResource(registry.find((resource) => resource.id === openId));
    else if (selectId) {
      selectedId = selectId;
      render();
    }
  });
  document.querySelector("#resource-favorite").addEventListener("click", () => toggleFavorite(selectedId));
  document.querySelector("#resource-open").addEventListener("click", () => {
    openResource(registry.find((resource) => resource.id === selectedId));
  });
  note.addEventListener("input", () => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      state.notes[selectedId] = note.value;
      saveResourceState(state);
      document.querySelector("#resource-save-status").textContent = "Note saved locally";
    }, 300);
  });
  root.addEventListener("click", (event) => {
    const action = event.target.closest("[data-resource-action]")?.dataset.resourceAction;
    if (action === "export") exportMemory();
    if (action === "import") document.querySelector("#resource-import").click();
  });
  render();

  function render() {
    const queryMatches = searchResources(registry, searchInput.value);
    const category = categorySelect.value;
    const view = root.querySelector('input[name="resourceView"]:checked')?.value || "all";
    filteredResources = queryMatches
      .filter((resource) => belongsToCollection(resource, selectedCollection))
      .filter((resource) => category === "all" || resource.category === category);
    if (view === "favorites") filteredResources = filteredResources.filter((resource) => state.favorites.includes(resource.id));
    if (view === "recent") {
      filteredResources = state.recents.map((id) => filteredResources.find((resource) => resource.id === id)).filter(Boolean);
    }
    if (!filteredResources.some((resource) => resource.id === selectedId)) selectedId = filteredResources[0]?.id || registry[0]?.id;
    renderCollections();
    renderList();
    renderInspector();
  }

  function renderCollections() {
    collectionList.innerHTML = COLLECTIONS.map((collection) => {
      const count = registry.filter((resource) => belongsToCollection(resource, collection.id)).length;
      return `<button type="button" data-resource-collection="${collection.id}"${selectedCollection === collection.id ? ' aria-current="true"' : ""}>
        <span>${String(count).padStart(2, "0")}</span>
        <strong>${escapeHtml(collection.name)}</strong>
        <small>${escapeHtml(collection.description)}</small>
      </button>`;
    }).join("");
  }

  function renderList() {
    document.querySelector("#resource-count").textContent = `${filteredResources.length} of ${registry.length}`;
    list.innerHTML = filteredResources.length ? filteredResources.map((resource) => `
      <article class="resource-row${resource.id === selectedId ? " is-selected" : ""}">
        <button type="button" class="resource-row-main" data-select-resource="${escapeHtml(resource.id)}">
          <span class="resource-row-kind">${resource.kind === "internal" ? "Workbench" : escapeHtml(resource.category)}</span>
          <strong>${escapeHtml(resource.name)}</strong>
          <small>${escapeHtml(resource.description)}</small>
        </button>
        <span class="resource-row-meta">${escapeHtml(resource.pricing)}</span>
        <button type="button" class="resource-row-icon" data-favorite-resource="${escapeHtml(resource.id)}" aria-label="${state.favorites.includes(resource.id) ? "Unpin" : "Pin"} ${escapeHtml(resource.name)}" title="${state.favorites.includes(resource.id) ? "Unpin" : "Pin"}">${state.favorites.includes(resource.id) ? "★" : "☆"}</button>
        <button type="button" class="resource-row-icon" data-open-resource="${escapeHtml(resource.id)}" aria-label="Open ${escapeHtml(resource.name)}" title="Open">↗</button>
      </article>`).join("") : `<p class="resource-empty">No resources match this view.</p>`;
  }

  function renderInspector() {
    const resource = registry.find((item) => item.id === selectedId);
    if (!resource) return;
    document.querySelector("#resource-kind").textContent = resource.kind === "internal" ? "Internal workspace" : resource.category;
    document.querySelector("#resource-inspector-title").textContent = resource.name;
    document.querySelector("#resource-description").textContent = resource.description;
    document.querySelector("#resource-favorite").textContent = state.favorites.includes(resource.id) ? "★" : "☆";
    document.querySelector("#resource-favorite").setAttribute("aria-label", `${state.favorites.includes(resource.id) ? "Unpin" : "Pin"} ${resource.name}`);
    document.querySelector("#resource-metadata").innerHTML = `
      <div><dt>Category</dt><dd>${escapeHtml(resource.category)}</dd></div>
      <div><dt>Access</dt><dd>${escapeHtml(resource.pricing)}</dd></div>
      <div><dt>Used</dt><dd>${Number(state.usage[resource.id]) || 0} times</dd></div>`;
    document.querySelector("#resource-tags").innerHTML = resource.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
    note.value = state.notes[resource.id] || "";
    document.querySelector("#resource-save-status").textContent = note.value ? "Private note stored locally" : "No private note yet";
    document.querySelector("#resource-open").textContent = resource.kind === "external" ? "Open external resource" : "Open workspace";
  }

  function toggleFavorite(id) {
    state.favorites = state.favorites.includes(id)
      ? state.favorites.filter((favorite) => favorite !== id)
      : [id, ...state.favorites];
    saveResourceState(state);
    render();
  }

  function exportMemory() {
    downloadJson({
      exportedAt: new Date().toISOString(),
      type: "workbench-resource-memory",
      version: 1,
      state
    }, "workbench-resource-memory.json");
  }

  async function importMemory(file) {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const imported = payload.state || payload;
      state = {
        ...RESOURCE_STATE_DEFAULTS,
        ...imported,
        favorites: Array.isArray(imported.favorites) ? imported.favorites.filter((id) => registry.some((resource) => resource.id === id)) : [],
        recents: Array.isArray(imported.recents) ? imported.recents.filter((id) => registry.some((resource) => resource.id === id)).slice(0, 12) : [],
        notes: imported.notes && typeof imported.notes === "object" ? imported.notes : {},
        usage: imported.usage && typeof imported.usage === "object" ? imported.usage : {}
      };
      saveResourceState(state);
      render();
      document.querySelector("#resource-save-status").textContent = "Resource memory imported";
    } catch {
      document.querySelector("#resource-save-status").textContent = "Import failed: choose a valid Workbench JSON file";
    } finally {
      document.querySelector("#resource-import").value = "";
    }
  }
}

function belongsToCollection(resource, collectionId) {
  if (collectionId === "all") return true;
  const collection = COLLECTIONS.find((item) => item.id === collectionId);
  if (!collection) return true;
  const haystack = [
    resource.name,
    resource.category,
    resource.description,
    ...(resource.tags || [])
  ].join(" ").toLowerCase();
  return collection.terms.some((term) => haystack.includes(term));
}

function downloadJson(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
