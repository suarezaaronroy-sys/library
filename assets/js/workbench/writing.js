import { loadState, saveState } from "./store.js";

const KEY = "aaron-workbench:v1:writing";
const state = loadState(KEY, { scratchpad: "", markdown: "", snippets: [], clipboard: [] });
const root = document.querySelector("#writing-workspace");

if (root) {
  const scratchpad = document.querySelector("#scratchpad");
  const markdown = document.querySelector("#markdown-input");
  const status = document.querySelector("#writing-status");
  scratchpad.value = state.scratchpad;
  markdown.value = state.markdown;
  updateWriting();
  renderMarkdown();
  renderSnippets();

  scratchpad.addEventListener("input", () => {
    state.scratchpad = scratchpad.value;
    saveState(KEY, state);
    updateWriting();
  });
  markdown.addEventListener("input", () => {
    state.markdown = markdown.value;
    saveState(KEY, state);
    renderMarkdown();
  });
  root.addEventListener("click", async (event) => {
    const transform = event.target.closest("[data-transform]")?.dataset.transform;
    const action = event.target.closest("[data-action]")?.dataset.action;
    const snippetId = Number(event.target.closest("[data-use-snippet]")?.dataset.useSnippet);
    const deleteId = Number(event.target.closest("[data-delete-snippet]")?.dataset.deleteSnippet);
    if (transform) {
      scratchpad.value = transformText(scratchpad.value, transform);
      scratchpad.dispatchEvent(new Event("input"));
    } else if (action === "copy-writing") {
      await copyText(scratchpad.value, status);
    } else if (action === "capture-clipboard") {
      try {
        const text = await navigator.clipboard.readText();
        if (text && !state.clipboard.includes(text)) state.clipboard.unshift(text);
        state.clipboard = state.clipboard.slice(0, 10);
        saveState(KEY, state);
        scratchpad.value += `${scratchpad.value ? "\n\n" : ""}${text}`;
        scratchpad.dispatchEvent(new Event("input"));
        status.textContent = "Clipboard added to scratchpad.";
      } catch {
        status.textContent = "Clipboard permission was not granted.";
      }
    } else if (snippetId) {
      const snippet = state.snippets.find((item) => item.id === snippetId);
      if (snippet) {
        scratchpad.value += `${scratchpad.value ? "\n\n" : ""}${snippet.text}`;
        scratchpad.dispatchEvent(new Event("input"));
      }
    } else if (deleteId) {
      state.snippets = state.snippets.filter((item) => item.id !== deleteId);
      saveState(KEY, state);
      renderSnippets();
    }
  });
  document.querySelector("#snippet-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    state.snippets.unshift({ id: Date.now(), name: data.name.trim(), text: data.text.trim() });
    saveState(KEY, state);
    event.currentTarget.reset();
    renderSnippets();
  });

  function updateWriting() {
    const words = scratchpad.value.trim() ? scratchpad.value.trim().split(/\s+/).length : 0;
    document.querySelector("#writing-count").textContent = `${words} words · ${scratchpad.value.length} characters`;
  }
  function renderSnippets() {
    document.querySelector("#snippet-list").innerHTML = state.snippets.length ? state.snippets.map((item) =>
      `<article class="record"><div><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.text.slice(0, 120))}</p><div class="tool-actions"><button class="workbench-button" type="button" data-use-snippet="${item.id}">Insert</button><button class="workbench-button" type="button" data-delete-snippet="${item.id}">Delete</button></div></div></article>`
    ).join("") : `<p class="tool-intro">Save language you use more than once.</p>`;
  }
  function renderMarkdown() {
    document.querySelector("#markdown-preview").innerHTML = markdownToHtml(markdown.value);
  }
}

function transformText(text, transform) {
  if (transform === "lower") return text.toLowerCase();
  if (transform === "upper") return text.toUpperCase();
  if (transform === "title") return text.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  return text.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}

function markdownToHtml(value) {
  return escapeHtml(value).split("\n").map((line) => {
    if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
    if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
    if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
    if (line.startsWith("- ")) return `<p>• ${line.slice(2)}</p>`;
    return line ? `<p>${line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}</p>` : "";
  }).join("");
}

async function copyText(text, output) {
  try {
    await navigator.clipboard.writeText(text);
    output.textContent = "Copied.";
  } catch {
    output.textContent = "Copy permission was not available.";
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
