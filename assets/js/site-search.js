import {
  escapeHtml,
  getRegistry,
  openResource,
  searchResources
} from "./workbench/registry.mjs?v=2";

const registry = getRegistry();
const config = readJson("#workbench-config", { baseUrl: "" });
const sitePages = [
  page("site-home", "Home", "/", "The front page of Aaron Suarez's working library.", ["home"], "Site › Home"),
  page("site-about", "About", "/about/", "Practice, operating philosophy, and working background.", ["about", "practice"], "Site › About"),
  page("site-library", "Library", "/projects/", "Grimoires, systems documentation, manuals, and project evidence.", ["library", "projects", "grimoires"], "Library › Catalogue"),
  page("site-notes", "Notes", "/notes/", "Short field notes from systems and operational work.", ["notes", "writing"], "Library › Notes"),
  page("site-contact", "Contacts", "/contact/", "Direct and studio routes for working together.", ["contact", "email"], "Site › Contacts")
];
const searchable = [...sitePages, ...registry];
const dialog = document.querySelector("#site-search");
const query = document.querySelector("#site-search-query");
const results = document.querySelector("#site-search-results");
let matches = [];
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
      activeIndex = Math.min(activeIndex + 1, matches.length - 1);
      render();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      render();
    } else if (event.key === "Enter" && matches[activeIndex]) {
      event.preventDefault();
      choose(matches[activeIndex]);
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
  render();
  query.focus();
}

function render() {
  matches = searchResources(searchable, query.value).slice(0, 14);
  if (activeIndex >= matches.length) activeIndex = 0;
  results.innerHTML = matches.length ? matches.map((item, index) => `
    <button type="button" class="site-search-result${index === activeIndex ? " is-active" : ""}" data-search-result="${escapeHtml(item.id)}">
      <span class="site-search-crumb">${escapeHtml(breadcrumb(item))}</span>
      <strong>${escapeHtml(item.name)}</strong>
      <small>${escapeHtml(item.description)}</small>
    </button>`).join("") : `<p class="site-search-empty">No matching path found.</p>`;
}

function breadcrumb(item) {
  if (item.breadcrumb) return item.breadcrumb;
  if (item.id.startsWith("grimoire-")) return `Library › Grimoires › G${item.id.replace("grimoire-", "")}`;
  if (item.id.startsWith("note-")) return "Library › Notes";
  if (item.kind === "external") return `Resource Hub › ${item.category} › External`;
  if (item.url.startsWith("/workbench/")) return `Workbench › ${item.category}`;
  return item.category;
}

function choose(item) {
  if (!item) return;
  dialog.close();
  if (item.id.startsWith("site-")) {
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
