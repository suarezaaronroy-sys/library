import {
  escapeHtml,
  getRegistry,
  openResource
} from "./workbench/registry.mjs?v=3";
import {
  groupResults,
  highlight,
  makeSnippet,
  searchWithMeta,
  tokenize
} from "./workbench/search-core.mjs?v=2";

const config = readJson("#workbench-config", { baseUrl: "" });
const sitePages = [
  page("site-home", "Home", "/", "The front page of Aaron Suarez's working library.", ["home"], "Site › Home"),
  page("site-about", "About", "/about/", "Practice, operating philosophy, and working background.", ["about", "practice"], "Site › About"),
  page("site-library", "Library", "/projects/", "Grimoires, systems documentation, manuals, and project evidence.", ["library", "projects", "grimoires"], "Library › Catalogue"),
  page("site-notes", "Notes", "/notes/", "Short field notes from systems and operational work.", ["notes", "writing"], "Library › Notes"),
  page("site-contact", "Contacts", "/contact/", "Direct and studio routes for working together.", ["contact", "email"], "Site › Contacts")
];

// Registry note entries are shallow (title + lede); the fetched index carries
// full-text versions of the same notes, so registry notes are filtered out.
const registry = getRegistry().filter((item) => !item.id.startsWith("note-"));
let searchable = [...sitePages, ...registry];
let indexLoaded = false;
let indexFailed = false;

const dialog = document.querySelector("#site-search");
const query = document.querySelector("#site-search-query");
const results = document.querySelector("#site-search-results");
let flat = [];
let activeIndex = 0;

if (dialog && query && results) {
  document.querySelectorAll("[data-open-site-search]").forEach((button) => button.addEventListener("click", openSearch));
  document.addEventListener("keydown", (event) => {
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    const canvasPage = document.querySelector(".workbench-frame")?.dataset.workspace === "canvas";
    if (event.key === "/" && !typing) {
      event.preventDefault();
      openSearch();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !typing && !canvasPage) {
      event.preventDefault();
      openSearch();
    }
  });
  query.addEventListener("input", render);
  query.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeIndex = Math.min(activeIndex + 1, flat.length - 1);
      render();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      render();
    } else if (event.key === "Enter" && flat[activeIndex]) {
      event.preventDefault();
      choose(flat[activeIndex]);
    }
  });
  results.addEventListener("click", (event) => {
    const id = event.target.closest("[data-search-result]")?.dataset.searchResult;
    choose(searchable.find((item) => item.id === id));
  });
}

function page(id, name, url, description, tags, breadcrumb) {
  return { id, name, url, description, tags, breadcrumb, kind: "internal", category: "Site", pricing: "Included" };
}

function openSearch() {
  if (!dialog.open) dialog.showModal();
  query.value = "";
  activeIndex = 0;
  loadIndex();
  render();
  query.focus();
}

// The full-text index (notes content, grimoire sections, changelog) is
// fetched once, on first open — pages stay light until search is used.
async function loadIndex() {
  if (indexLoaded || indexFailed) return;
  try {
    const response = await fetch(`${config.baseUrl}/search-index.json`.replace(/\/{2,}/g, "/"), { cache: "no-cache" });
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    searchable = [...searchable, ...(data.entries || [])];
    indexLoaded = true;
    if (dialog.open) render();
  } catch (err) {
    indexFailed = true; // registry-only search still works
    console.error("Search index unavailable:", err);
  }
}

function render() {
  const value = query.value;
  const tokens = tokenize(value);
  flat = [];
  if (!tokens.length) {
    const defaults = [...sitePages, ...registry.slice(0, 9)];
    flat = defaults;
    results.innerHTML = defaults.map((item, index) => renderResult(item, index, [])).join("")
      + `<p class="site-search-hint">Type to search tools, Grimoire chapters, Notes${indexLoaded ? "" : "…"} — ↑↓ to move, Enter to open.</p>`;
    return;
  }
  const { results: matched, partial } = searchWithMeta(searchable, value, 40);
  const groups = groupResults(matched, 6);
  if (activeIndex >= matched.length) activeIndex = 0;
  if (!groups.length) {
    results.innerHTML = `<p class="site-search-empty">No matching path found${indexFailed ? " (deep index unavailable)" : ""}.</p>`;
    return;
  }
  let cursor = 0;
  const notice = partial
    ? `<p class="site-search-hint">Nothing matches every word — showing the closest matches.</p>`
    : "";
  results.innerHTML = notice + groups.map((group) => {
    const rows = group.items.map((item) => renderResult(item, cursor++, tokens)).join("");
    flat.push(...group.items);
    return `<div class="site-search-group">${escapeHtml(group.label)}</div>${rows}`;
  }).join("");
}

function renderResult(item, index, tokens) {
  const snippet = item.content ? makeSnippet(item.content, tokens) : "";
  const detail = snippet || item.description || "";
  return `
    <button type="button" class="site-search-result${index === activeIndex ? " is-active" : ""}" data-search-result="${escapeHtml(item.id)}">
      <span class="site-search-crumb">${escapeHtml(breadcrumb(item))}</span>
      <strong>${highlight(escapeHtml(item.name), tokens)}</strong>
      <small>${highlight(escapeHtml(detail), tokens)}</small>
    </button>`;
}

function breadcrumb(item) {
  if (item.breadcrumb) return item.breadcrumb;
  if (item.id.startsWith("grimoire-")) return `Library › Grimoires › G${item.id.replace("grimoire-", "")}`;
  if (item.kind === "external") return `Resource Hub › ${item.category} › External`;
  if (item.url.startsWith("/workbench/")) return `Workbench › ${item.category}`;
  return item.category;
}

function choose(item) {
  if (!item) return;
  dialog.close();
  if (item.kind === "changelog") {
    const chip = document.getElementById("cl-chip");
    if (chip) { chip.click(); return; }
  }
  if (item.id.startsWith("site-") || ["note", "grimoire-section", "changelog"].includes(item.kind)) {
    window.location.href = `${config.baseUrl}${item.url}`.replace(/\/{2,}/g, "/");
  } else {
    openResource(item);
  }
}

function readJson(selector, fallback) {
  try {
    return JSON.parse(document.querySelector(selector)?.textContent || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}
