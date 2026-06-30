import {
  RESOURCE_STATE_DEFAULTS,
  escapeHtml,
  getRegistry,
  getResourceState,
  openResource,
  saveResourceState,
  searchResources
} from "./registry.mjs?v=1";

const registry = getRegistry();
let state = getResourceState();
let selectedId = state.recents[0] || registry[0]?.id;
let filteredResources = registry;
let saveTimer;
const root = document.querySelector("#resource-hub");

if (root) {
  const searchInput = document.querySelector("#resource-search");
  const categorySelect = document.querySelector("#resource-category");
  const list = document.querySelector("#resource-list");
  const note = document.querySelector("#resource-note");
  const categories = [...new Set(registry.map((resource) => resource.category))].sort();
  categorySelect.innerHTML = `<option value="all">All categories</option>${categories.map((category) =>
    `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
  ).join("")}`;

  searchInput.addEventListener("input", render);
  categorySelect.addEventListener("change", render);
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
    filteredResources = queryMatches.filter((resource) => category === "all" || resource.category === category);
    if (view === "favorites") filteredResources = filteredResources.filter((resource) => state.favorites.includes(resource.id));
    if (view === "recent") {
      filteredResources = state.recents.map((id) => filteredResources.find((resource) => resource.id === id)).filter(Boolean);
    }
    if (!filteredResources.some((resource) => resource.id === selectedId)) selectedId = filteredResources[0]?.id || registry[0]?.id;
    renderList();
    renderInspector();
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

function downloadJson(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
