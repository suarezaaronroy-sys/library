import { formatCurrencyMinor, number } from "./billing-core.mjs";

export function renderInvoiceDocument(invoice) {
  const fromBlock = partyBlock("From", invoice.from);
  const toBlock = partyBlock("Bill to", invoice.to);
  const periodLabel = [invoice.period.from, invoice.period.to].filter(Boolean).map(formatDate).join(" to ");
  const showHours = invoice.lines.some((line) => line.rateUnit === "hour");
  const lineRows = invoice.lines.map((line) => `
    <tr>
      <td class="invoice-line-description">
        <strong>${escapeHtml(line.desc)}</strong>
        ${line.note ? `<small>${escapeHtml(line.note)}</small>` : ""}
      </td>
      <td class="numeric">${number(line.days)}</td>
      ${showHours ? `<td class="numeric">${number(line.hours)}</td>` : ""}
      <td class="numeric">${formatCurrencyMinor(line.rate, invoice.currency)} / ${escapeHtml(line.rateUnit)}</td>
      <td class="numeric invoice-line-amount">${formatCurrencyMinor(line.amount, invoice.currency)}</td>
    </tr>`).join("");

  const adjustmentRows = invoice.adjustments.map((item) => `
    <div class="invoice-total-row">
      <span>${escapeHtml(item.label)}</span>
      <strong>${formatCurrencyMinor(item.amount, invoice.currency)}</strong>
    </div>`).join("");

  const detailItems = [
    invoice.to.poRef ? ["PO reference", invoice.to.poRef] : null,
    invoice.to.taxId ? ["Client tax ID", invoice.to.taxId] : null,
    invoice.from.taxId ? ["Provider tax ID", invoice.from.taxId] : null,
    invoice.terms ? ["Terms", invoice.terms] : null
  ].filter(Boolean);

  const paymentFields = invoice.payment.fields.map((field) => `
    <div class="invoice-payment-field"><span>${escapeHtml(field.label)}</span><strong>${escapeHtml(field.value)}</strong></div>`).join("");

  const indicativeValue = invoice.fx
    ? Math.round(invoice.totals.grandTotal * invoice.fx.rate)
    : 0;
  const hasPayment = Boolean(
    invoice.payment.method || invoice.payment.accountName || invoice.payment.fields.length || invoice.payment.reference
  );

  return `<article class="invoice-document" aria-label="${invoice.ref ? `Invoice ${escapeHtml(invoice.ref)}` : "Invoice"}">
    <header class="invoice-document-header">
      <div class="invoice-document-title">
        <span class="invoice-document-mark" aria-hidden="true"></span>
        <h1>INVOICE</h1>
      </div>
      <div class="invoice-document-meta">
        ${invoice.ref ? `<strong>${escapeHtml(invoice.ref)}</strong>` : ""}
        ${invoice.issued ? `<span>Issued ${formatDate(invoice.issued)}</span>` : ""}
        ${invoice.due ? `<span>Due ${formatDate(invoice.due)}</span>` : ""}
      </div>
    </header>

    ${fromBlock || toBlock ? `<section class="invoice-parties">${fromBlock}${toBlock}</section>` : ""}

    <section class="invoice-period-band">
      ${periodLabel ? `<div><span>Service period</span><strong>${periodLabel}</strong></div>` : ""}
      <strong>${number(invoice.totals.billableDays)} billable days</strong>
    </section>

    ${detailItems.length ? `<section class="invoice-detail-strip">${detailItems.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</section>` : ""}

    <table class="invoice-lines">
      <thead><tr><th>Service</th><th>Days</th>${showHours ? "<th>Hours</th>" : ""}<th>Rate</th><th>Amount</th></tr></thead>
      <tbody>${lineRows}</tbody>
    </table>

    <div class="invoice-totals-wrap">
      <section class="invoice-notes">
        ${invoice.notes ? `<span>Notes</span><p>${multiline(invoice.notes)}</p>` : ""}
      </section>
      <section class="invoice-totals">
        <div class="invoice-total-row"><span>Subtotal</span><strong>${formatCurrencyMinor(invoice.totals.subtotal, invoice.currency)}</strong></div>
        ${adjustmentRows}
        <div class="invoice-total-row invoice-grand-total"><span>Total due</span><strong>${formatCurrencyMinor(invoice.totals.grandTotal, invoice.currency)}</strong></div>
      </section>
    </div>

    ${invoice.fx ? `<p class="invoice-fx">Indicative only: ${formatCurrencyMinor(indicativeValue, invoice.fx.to)} at 1 ${escapeHtml(invoice.currency)} = ${number(invoice.fx.rate)} ${escapeHtml(invoice.fx.to)}. Payment remains due in ${escapeHtml(invoice.currency)}.</p>` : ""}

    ${hasPayment || invoice.due ? `<section class="invoice-payment">
      ${hasPayment ? `<div class="invoice-payment-method">
        <span>Payment method</span>
        ${invoice.payment.method ? `<strong>${escapeHtml(invoice.payment.method)}</strong>` : ""}
        ${invoice.payment.accountName ? `<p>${escapeHtml(invoice.payment.accountName)}</p>` : ""}
        ${paymentFields}
        ${invoice.payment.reference ? `<p>Reference: ${escapeHtml(invoice.payment.reference)}</p>` : ""}
      </div>` : ""}
      ${invoice.due ? `<div class="invoice-due-panel"><span>Payment due</span><strong>${formatDate(invoice.due)}</strong></div>` : ""}
    </section>` : ""}

    ${invoice.footerTerms || invoice.website ? `<footer class="invoice-document-footer">
      ${invoice.footerTerms ? `<span>${escapeHtml(invoice.footerTerms)}</span>` : ""}
      ${invoice.website ? `<span>${escapeHtml(invoice.website)}</span>` : ""}
    </footer>` : ""}
  </article>`;
}

function partyBlock(label, party) {
  const heading = party.org || party.name;
  const secondary = party.org && party.name !== party.org ? party.name : "";
  const lines = [party.attn, secondary, ...party.addressLines, party.email].filter(Boolean);
  if (!heading && !lines.length) return "";
  return `<div class="invoice-party"><span>${label}</span>${heading ? `<strong>${escapeHtml(heading)}</strong>` : ""}${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>`;
}

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return escapeHtml(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function multiline(value) {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
