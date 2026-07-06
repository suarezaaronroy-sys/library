// utils.mjs — canonical shared helpers for the Workbench.
// Replaces per-module copies that had drifted (some escapeHtml variants were
// not null-safe; the calculator's escaper missed the single quote). Import
// these instead of redefining. Tested in tests/workbench-utils.test.mjs.

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

// Null-safe HTML escaping for all five sensitive characters.
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

// Trigger a client-side file download from in-memory content.
export function downloadFile(content, filename, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// URL/filename-safe slug; falls back to the given default when empty.
export function slug(value, fallback = "untitled") {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || fallback;
}

// Fixed 2-decimal money formatting (en-US grouping).
export function money(value) {
  return (Number(value) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Compact number formatting (up to 1 decimal).
export function number(value) {
  return (Number(value) || 0).toLocaleString("en-US", { maximumFractionDigits: 1 });
}
