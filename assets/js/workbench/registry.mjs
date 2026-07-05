import { loadState, saveState } from "./store.js?v=5";

export const RESOURCE_STORAGE_KEY = "aaron-workbench:v1:resources";
export const RESOURCE_STATE_DEFAULTS = {
  schemaVersion: 1,
  favorites: [],
  notes: {},
  recents: [],
  usage: {}
};

export function getRegistry() {
  const source = document.querySelector("#workbench-registry");
  if (!source) return [];
  try {
    const resources = JSON.parse(source.textContent);
    const grimoires = parseScriptJson("#workbench-grimoires", [])
      .filter((item) => item.status === "live")
      .map((item) => ({
        id: `grimoire-${item.num}`,
        name: `G${item.num} · ${item.title}`,
        url: item.href,
        kind: "internal",
        category: "Library",
        description: item.desc,
        tags: ["grimoire", item.tier, ...(item.stats || [])],
        pricing: "Included"
      }));
    const notes = parseScriptJson("#workbench-notes", []);
    return [...resources, ...grimoires, ...notes];
  } catch {
    return [];
  }
}

export function getWorkbenchConfig() {
  const source = document.querySelector("#workbench-config");
  try {
    return JSON.parse(source?.textContent || "{}");
  } catch {
    return { baseUrl: "" };
  }
}

export function getResourceState() {
  return loadState(RESOURCE_STORAGE_KEY, RESOURCE_STATE_DEFAULTS);
}

export function saveResourceState(state) {
  const saved = saveState(RESOURCE_STORAGE_KEY, state);
  window.dispatchEvent(new CustomEvent("workbench:resources-changed", { detail: state }));
  return saved;
}

export function resolveResourceUrl(resource) {
  if (!resource?.url) return "#";
  if (/^https?:\/\//i.test(resource.url)) return resource.url;
  const base = getWorkbenchConfig().baseUrl || "";
  return `${base}${resource.url}`.replace(/\/{2,}/g, "/");
}

export function recordResourceOpen(resourceId) {
  const state = getResourceState();
  state.recents = [resourceId, ...state.recents.filter((id) => id !== resourceId)].slice(0, 12);
  state.usage[resourceId] = (Number(state.usage[resourceId]) || 0) + 1;
  saveResourceState(state);
  return state;
}

export function openResource(resource) {
  if (!resource) return;
  recordResourceOpen(resource.id);
  const url = resolveResourceUrl(resource);
  if (resource.kind === "external") {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    window.location.href = url;
  }
}

export function searchResources(registry, query) {
  const words = String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return registry;
  return registry.map((resource) => {
    const name = resource.name.toLowerCase();
    const category = resource.category.toLowerCase();
    const tags = resource.tags.join(" ").toLowerCase();
    const description = resource.description.toLowerCase();
    const haystack = `${name} ${category} ${tags} ${description}`;
    const score = words.reduce((total, word) => {
      if (name === word) return total + 12;
      if (name.includes(word)) return total + 8;
      if (tags.includes(word)) return total + 5;
      if (category.includes(word)) return total + 3;
      return haystack.includes(word) ? total + 1 : total;
    }, 0);
    return { resource, score };
  }).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.resource.name.localeCompare(b.resource.name))
    .map((item) => item.resource);
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function parseScriptJson(selector, fallback) {
  try {
    return JSON.parse(document.querySelector(selector)?.textContent || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}
