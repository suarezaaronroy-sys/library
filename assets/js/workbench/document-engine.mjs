export function renderBusinessDocument(model = {}) {
  const kind = text(model.kind) || "Document";
  const variant = classToken(model.variant || kind);
  const metadata = (model.metadata || []).filter(hasValue);
  const parties = (model.parties || []).map(renderParty).filter(Boolean).join("");
  const details = (model.details || []).filter(hasValue);
  const sections = (model.sections || []).map(renderSection).filter(Boolean).join("");
  const table = renderTable(model.table);
  const totals = (model.totals || []).filter(hasValue);
  const financials = renderFinancials(model.notes, totals);
  const settlement = renderSettlement(model.settlement);
  const signatures = renderSignatures(model.signatures);
  const footer = renderFooter(model.footer);
  const banner = renderBanner(model.banner);

  return `<article class="document-sheet document-${variant}" aria-label="${escapeDocumentHtml(model.ariaLabel || `${kind}${model.ref ? ` ${model.ref}` : ""}`)}">
    <header class="document-header">
      <div class="document-title"><span class="document-mark" aria-hidden="true"></span><h1>${escapeDocumentHtml(kind.toUpperCase())}</h1></div>
      <div class="document-meta">
        ${model.ref ? `<strong>${escapeDocumentHtml(model.ref)}</strong>` : ""}
        ${metadata.map((item) => `<span>${item.label ? `${escapeDocumentHtml(item.label)} ` : ""}${escapeDocumentHtml(item.value)}</span>`).join("")}
      </div>
    </header>
    ${parties ? `<section class="document-parties">${parties}</section>` : ""}
    ${banner}
    ${details.length ? `<section class="document-detail-strip">${details.map((item) => `<div><span>${escapeDocumentHtml(item.label)}</span><strong>${escapeDocumentHtml(item.value)}</strong></div>`).join("")}</section>` : ""}
    ${sections}
    ${table}
    ${financials}
    ${model.footnote ? `<p class="document-footnote">${escapeDocumentHtml(model.footnote)}</p>` : ""}
    ${settlement}
    ${signatures}
    ${footer}
  </article>`;
}

export function formatDocumentDate(value, locale = "en-GB") {
  if (!value) return "";
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return text(value);
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function escapeDocumentHtml(value) {
  return text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderParty(party) {
  if (!party) return "";
  const lines = (party.lines || []).map(text).filter(Boolean);
  if (!text(party.heading) && !lines.length) return "";
  return `<div class="document-party">
    ${party.label ? `<span>${escapeDocumentHtml(party.label)}</span>` : ""}
    ${party.heading ? `<strong>${escapeDocumentHtml(party.heading)}</strong>` : ""}
    ${lines.map((line) => `<p>${escapeDocumentHtml(line)}</p>`).join("")}
  </div>`;
}

function renderBanner(banner) {
  if (!banner || (!text(banner.value) && !text(banner.summary))) return "";
  return `<section class="document-banner">
    ${banner.value ? `<div>${banner.label ? `<span>${escapeDocumentHtml(banner.label)}</span>` : ""}<strong>${escapeDocumentHtml(banner.value)}</strong></div>` : ""}
    ${banner.summary ? `<strong>${escapeDocumentHtml(banner.summary)}</strong>` : ""}
  </section>`;
}

function renderSection(section) {
  if (!section) return "";
  const body = text(section.body);
  const items = (section.items || []).map(text).filter(Boolean);
  if (!body && !items.length) return "";
  return `<section class="document-content-section">
    ${section.heading ? `<h2>${escapeDocumentHtml(section.heading)}</h2>` : ""}
    ${body ? `<p>${multiline(body)}</p>` : ""}
    ${items.length ? `<ol>${items.map((item) => `<li>${escapeDocumentHtml(item)}</li>`).join("")}</ol>` : ""}
  </section>`;
}

function renderTable(table) {
  if (!table?.columns?.length || !table?.rows?.length) return "";
  const columns = table.columns.filter((column) => column?.key && column?.label);
  if (!columns.length) return "";
  return `<table class="document-table">
    <thead><tr>${columns.map((column) => `<th${column.align === "right" ? ' class="align-right"' : ""}>${escapeDocumentHtml(column.label)}</th>`).join("")}</tr></thead>
    <tbody>${table.rows.map((row) => `<tr>${columns.map((column) => renderCell(row?.[column.key], column)).join("")}</tr>`).join("")}</tbody>
  </table>`;
}

function renderCell(cell, column) {
  const descriptor = cell && typeof cell === "object" && !Array.isArray(cell) ? cell : { value: cell };
  const value = text(descriptor.value);
  const subtext = text(descriptor.subtext);
  const classes = [column.align === "right" ? "align-right document-numeric" : "", descriptor.strong ? "is-strong" : ""].filter(Boolean).join(" ");
  return `<td${classes ? ` class="${classes}"` : ""}>${descriptor.strong ? `<strong>${escapeDocumentHtml(value)}</strong>` : escapeDocumentHtml(value)}${subtext ? `<small>${escapeDocumentHtml(subtext)}</small>` : ""}</td>`;
}

function renderFinancials(notes, totals) {
  const noteBody = text(notes?.body);
  if (!noteBody && !totals.length) return "";
  return `<div class="document-financials">
    <section class="document-notes">${noteBody ? `${notes.label ? `<span>${escapeDocumentHtml(notes.label)}</span>` : ""}<p>${multiline(noteBody)}</p>` : ""}</section>
    <section class="document-totals">${totals.map((item) => `<div class="document-total-row${item.emphasis ? " is-emphasis" : ""}"><span>${escapeDocumentHtml(item.label)}</span><strong>${escapeDocumentHtml(item.value)}</strong></div>`).join("")}</section>
  </div>`;
}

function renderSettlement(settlement) {
  if (!settlement) return "";
  const fields = (settlement.fields || []).filter(hasValue);
  const hasLeft = Boolean(text(settlement.method) || text(settlement.accountName) || fields.length || text(settlement.reference));
  const hasDue = Boolean(text(settlement.due?.value));
  if (!hasLeft && !hasDue) return "";
  return `<section class="document-settlement">
    ${hasLeft ? `<div class="document-settlement-method">
      ${settlement.label ? `<span>${escapeDocumentHtml(settlement.label)}</span>` : ""}
      ${settlement.method ? `<strong>${escapeDocumentHtml(settlement.method)}</strong>` : ""}
      ${settlement.accountName ? `<p>${escapeDocumentHtml(settlement.accountName)}</p>` : ""}
      ${fields.map((field) => `<div class="document-settlement-field"><span>${escapeDocumentHtml(field.label)}</span><strong>${escapeDocumentHtml(field.value)}</strong></div>`).join("")}
      ${settlement.reference ? `<p>Reference: ${escapeDocumentHtml(settlement.reference)}</p>` : ""}
    </div>` : ""}
    ${hasDue ? `<div class="document-due-panel"><span>${escapeDocumentHtml(settlement.due.label || "Due")}</span><strong>${escapeDocumentHtml(settlement.due.value)}</strong></div>` : ""}
  </section>`;
}

function renderSignatures(signatures) {
  const entries = (signatures || []).filter((entry) => text(entry?.label) || text(entry?.name));
  if (!entries.length) return "";
  return `<section class="document-signatures">${entries.map((entry) => `<div><span>${escapeDocumentHtml(entry.label || "Signature")}</span><i aria-hidden="true"></i>${entry.name ? `<strong>${escapeDocumentHtml(entry.name)}</strong>` : ""}${entry.meta ? `<p>${escapeDocumentHtml(entry.meta)}</p>` : ""}</div>`).join("")}</section>`;
}

function renderFooter(footer) {
  if (!footer || (!text(footer.left) && !text(footer.right))) return "";
  return `<footer class="document-footer">${footer.left ? `<span>${escapeDocumentHtml(footer.left)}</span>` : ""}${footer.right ? `<span>${escapeDocumentHtml(footer.right)}</span>` : ""}</footer>`;
}

function multiline(value) {
  return escapeDocumentHtml(value).replace(/\r?\n/g, "<br>");
}

function hasValue(item) {
  return Boolean(item && text(item.value));
}

function classToken(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "document";
}

function text(value) {
  return String(value ?? "").trim();
}
