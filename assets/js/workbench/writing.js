import { loadState, saveState } from "./store.js?v=5";
import { downloadFile, escapeHtml } from "./utils.mjs?v=1";

const KEY = "aaron-workbench:v2:writing";
const legacy = loadState("aaron-workbench:v1:writing", { scratchpad: "", markdown: "", snippets: [], clipboard: [] });
const state = loadState(KEY, {
  notepadHtml: legacy.scratchpad ? `<p>${escapeHtml(legacy.scratchpad).replace(/\n/g, "<br>")}</p>` : "",
  scratchpad: legacy.scratchpad || "",
  markdown: legacy.markdown || "",
  snippets: legacy.snippets || [],
  clipboard: legacy.clipboard || []
});
const root = document.querySelector("#writing-workspace");
let savedRange = null;

if (root) {
  const notepad = document.querySelector("#notepad");
  const markdown = document.querySelector("#markdown-input");
  const status = document.querySelector("#writing-status");
  notepad.innerHTML = state.notepadHtml;
  normalizeNotepadMarkup();
  markdown.value = state.markdown;
  updateWriting();
  renderMarkdown();
  renderSnippets();

  document.querySelector(".notepad-toolbar").addEventListener("mousedown", (event) => {
    if (event.target.closest("[data-format]")) event.preventDefault();
  });
  document.addEventListener("selectionchange", () => {
    const selection = window.getSelection();
    if (selection.rangeCount && notepad.contains(selection.anchorNode)) {
      savedRange = selection.getRangeAt(0).cloneRange();
    }
  });
  notepad.addEventListener("input", saveNotepad);
  markdown.addEventListener("input", () => {
    state.markdown = markdown.value;
    saveState(KEY, state);
    renderMarkdown();
  });
  root.addEventListener("click", async (event) => {
    const formatButton = event.target.closest("[data-format]");
    const transform = event.target.closest("[data-transform]")?.dataset.transform;
    const action = event.target.closest("[data-action]")?.dataset.action;
    const snippetId = Number(event.target.closest("[data-use-snippet]")?.dataset.useSnippet);
    const deleteId = Number(event.target.closest("[data-delete-snippet]")?.dataset.deleteSnippet);
    if (formatButton) {
      applyFormatting(formatButton.dataset.format, formatButton.dataset.formatValue);
      saveNotepad();
    } else if (transform) {
      const transformed = transformText(notepad.innerText, transform);
      notepad.textContent = transformed;
      saveNotepad();
    } else if (action === "copy-writing") {
      await copyText(notepad.innerText, status);
    } else if (action === "capture-clipboard") {
      try {
        const text = await navigator.clipboard.readText();
        if (text && !state.clipboard.includes(text)) state.clipboard.unshift(text);
        state.clipboard = state.clipboard.slice(0, 10);
        appendParagraph(text);
        status.textContent = "Clipboard added to notepad.";
      } catch {
        status.textContent = "Clipboard permission was not granted.";
      }
    } else if (action === "export-text") {
      downloadFile(notepad.innerText, "workbench-note.txt", "text/plain");
    } else if (action === "export-html") {
      downloadFile(`<!doctype html><meta charset="utf-8"><title>Workbench note</title><article>${notepad.innerHTML}</article>`, "workbench-note.html", "text/html");
    } else if (snippetId) {
      const snippet = state.snippets.find((item) => item.id === snippetId);
      if (snippet) appendParagraph(snippet.text);
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

  function saveNotepad() {
    state.notepadHtml = notepad.innerHTML;
    state.scratchpad = notepad.innerText;
    saveState(KEY, state);
    updateWriting();
    status.textContent = "Saved locally";
  }

  function appendParagraph(text) {
    if (!text) return;
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    notepad.appendChild(paragraph);
    saveNotepad();
  }

  function applyFormatting(command, value) {
    if (command === "undo" || command === "redo") {
      document.execCommand(command);
      return;
    }
    const selection = window.getSelection();
    let range = savedRange;
    if (selection.rangeCount && notepad.contains(selection.anchorNode)) range = selection.getRangeAt(0).cloneRange();
    if (!range || range.collapsed) {
      range = document.createRange();
      range.selectNodeContents(notepad);
    }
    const text = range.toString();
    if (!text) return;
    const inlineTag = { bold: "strong", italic: "em", underline: "u" }[command];
    if (inlineTag && range.commonAncestorContainer === notepad) {
      const blocks = Array.from(notepad.childNodes);
      const alreadyFormatted = blocks.length && blocks.every((block) =>
        block.nodeType === Node.ELEMENT_NODE &&
        block.children.length === 1 &&
        block.firstElementChild.tagName.toLowerCase() === inlineTag
      );
      blocks.forEach((block) => {
        if (alreadyFormatted) {
          const wrapper = block.firstElementChild;
          while (wrapper.firstChild) block.insertBefore(wrapper.firstChild, wrapper);
          wrapper.remove();
        } else {
          const wrapper = document.createElement(inlineTag);
          while (block.firstChild) wrapper.appendChild(block.firstChild);
          block.appendChild(wrapper);
        }
      });
      const all = document.createRange();
      all.selectNodeContents(notepad);
      selection.removeAllRanges();
      selection.addRange(all);
      savedRange = all.cloneRange();
      notepad.focus();
      return;
    }

    let replacement;
    if (command === "insertUnorderedList" || command === "insertOrderedList") {
      replacement = document.createElement(command === "insertOrderedList" ? "ol" : "ul");
      text.split(/\n+/).filter(Boolean).forEach((line) => {
        const item = document.createElement("li");
        item.textContent = line;
        replacement.appendChild(item);
      });
    } else if (command === "removeFormat") {
      replacement = document.createTextNode(text);
    } else {
      const tags = { bold: "strong", italic: "em", underline: "u", formatBlock: value || "h2" };
      replacement = document.createElement(tags[command] || "span");
      try {
        replacement.appendChild(range.extractContents());
      } catch {
        replacement.textContent = text;
        range.deleteContents();
      }
    }
    range.insertNode(replacement);
    selection.removeAllRanges();
    const after = document.createRange();
    after.selectNodeContents(replacement);
    selection.addRange(after);
    savedRange = after.cloneRange();
    notepad.focus();
  }

  function normalizeNotepadMarkup() {
    const inlineTags = ["STRONG", "EM", "U"];
    const blockTags = "p,h1,h2,h3,div,ul,ol,li";
    const malformed = Array.from(notepad.children).some((element) =>
      inlineTags.includes(element.tagName) && element.querySelector(blockTags)
    );
    if (malformed) notepad.innerHTML = `<p>${escapeHtml(notepad.innerText)}</p>`;
  }

  function updateWriting() {
    const text = notepad.innerText.trim();
    const words = text ? text.split(/\s+/).length : 0;
    document.querySelector("#writing-count").textContent = `${words} words · ${text.length} characters`;
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


