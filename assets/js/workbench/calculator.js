import { loadState, saveState } from "./store.js?v=4";
import { evaluate, formatResult, CalcError } from "./calculator-core.mjs?v=1";

const STORAGE_KEY = "aaron-workbench:v1:calculator";
const TAPE_LIMIT = 60;
const DEFAULT_STATE = { schemaVersion: 1, expression: "", tape: [], memory: 0, ans: 0 };

const root = document.querySelector("#calculator-workspace");
if (root) {
  const stored = loadState(STORAGE_KEY, DEFAULT_STATE);
  const state = {
    schemaVersion: 1,
    expression: typeof stored.expression === "string" ? stored.expression : "",
    tape: Array.isArray(stored.tape) ? stored.tape.filter(isValidEntry).slice(0, TAPE_LIMIT) : [],
    memory: Number(stored.memory) || 0,
    ans: Number(stored.ans) || 0
  };

  const input = root.querySelector("#calc-expression");
  const preview = root.querySelector("#calc-preview");
  const tapeEl = root.querySelector("#calc-tape");
  const memEl = root.querySelector("#calc-memory");
  const status = root.querySelector("#calc-status");
  let statusTimer;

  input.value = state.expression;
  renderPreview();
  renderTape();
  renderMemory();

  input.addEventListener("input", () => { state.expression = input.value; renderPreview(); persist(); });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); commit(); }
  });

  root.querySelectorAll("[data-calc-key]").forEach((button) => {
    button.addEventListener("click", () => insert(button.dataset.calcKey));
  });
  root.querySelectorAll("[data-calc-action]").forEach((button) => {
    button.addEventListener("click", () => runAction(button.dataset.calcAction));
  });
  tapeEl.addEventListener("click", (event) => {
    const entry = event.target.closest("[data-tape-result]");
    if (entry) insert(entry.dataset.tapeResult);
  });

  function insert(text) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    const caret = start + text.length;
    input.focus();
    input.setSelectionRange(caret, caret);
    state.expression = input.value;
    renderPreview();
    persist();
  }

  function runAction(name) {
    switch (name) {
      case "clear":
        input.value = ""; state.expression = ""; input.focus(); renderPreview(); persist(); break;
      case "backspace": {
        const s = input.selectionStart ?? input.value.length;
        const e = input.selectionEnd ?? input.value.length;
        if (s === e && s > 0) {
          input.value = input.value.slice(0, s - 1) + input.value.slice(e);
          input.focus(); input.setSelectionRange(s - 1, s - 1);
        } else {
          input.value = input.value.slice(0, s) + input.value.slice(e);
          input.focus(); input.setSelectionRange(s, s);
        }
        state.expression = input.value; renderPreview(); persist(); break;
      }
      case "equals": commit(); break;
      case "copy": copyResult(); break;
      case "mem-plus": memoryAdd(1); break;
      case "mem-minus": memoryAdd(-1); break;
      case "mem-recall": if (state.memory) insert(plainSeed(state.memory)); break;
      case "mem-clear": state.memory = 0; renderMemory(); persist(); toast("Memory cleared"); break;
      case "clear-tape": state.tape = []; renderTape(); persist(); toast("Tape cleared"); break;
    }
  }

  function currentResult() {
    try { return evaluate(input.value, { ans: state.ans }); }
    catch { return undefined; }
  }

  function commit() {
    let result;
    try { result = evaluate(input.value, { ans: state.ans }); }
    catch (error) { toast(error instanceof CalcError ? error.message : "Invalid expression", true); return; }
    if (result === null) return;
    state.tape.unshift({ expr: input.value.trim(), result });
    state.tape = state.tape.slice(0, TAPE_LIMIT);
    state.ans = result;
    const seed = plainSeed(result);
    input.value = seed; state.expression = seed;
    input.focus(); input.setSelectionRange(seed.length, seed.length);
    renderPreview(); renderTape(); persist(); toast("Saved locally");
  }

  function memoryAdd(sign) {
    const value = currentResult();
    if (value === undefined || value === null) { toast("Nothing to store", true); return; }
    state.memory += sign * value;
    renderMemory(); persist();
    toast(sign > 0 ? "Added to memory" : "Subtracted from memory");
  }

  async function copyResult() {
    const value = currentResult();
    if (value === undefined || value === null) { toast("Nothing to copy", true); return; }
    try { await navigator.clipboard.writeText(formatResult(value)); toast("Result copied"); }
    catch { toast("Copy blocked by browser", true); }
  }

  function renderPreview() {
    let value;
    try { value = evaluate(input.value, { ans: state.ans }); }
    catch { value = undefined; }
    preview.classList.remove("is-error");
    if (input.value.trim() === "" || value === null) { preview.textContent = "0"; return; }
    preview.textContent = value === undefined ? "…" : formatResult(value);
  }

  function renderTape() {
    if (!state.tape.length) {
      tapeEl.innerHTML = '<p class="calc-tape-empty">No calculations yet.</p>';
      return;
    }
    tapeEl.innerHTML = state.tape.map((item) =>
      `<button type="button" class="calc-tape-entry" data-tape-result="${plainSeed(item.result)}" title="Reuse this result">` +
      `<span class="expr">${escapeHtml(item.expr)} =</span>` +
      `<span class="res">${escapeHtml(formatResult(item.result))}</span>` +
      `</button>`
    ).join("");
  }

  function renderMemory() {
    if (state.memory) { memEl.hidden = false; memEl.textContent = `M ${formatResult(state.memory)}`; }
    else { memEl.hidden = true; }
  }

  function persist() { saveState(STORAGE_KEY, state); }

  function toast(message, isError) {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", Boolean(isError));
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      status.textContent = "Saved locally";
      status.classList.remove("is-error");
    }, 2400);
  }
}

function isValidEntry(entry) {
  return entry && typeof entry.expr === "string" && Number.isFinite(entry.result);
}

function plainSeed(value) {
  const clean = Number(Number(value).toPrecision(12));
  return clean.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 12 });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
