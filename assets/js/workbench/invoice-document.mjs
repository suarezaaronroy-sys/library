import { formatCurrencyMinor, number } from "./billing-core.mjs";
import { formatDocumentDate, renderBusinessDocument } from "./document-engine.mjs";
import { fxFootnote, partyModel } from "./document-money.mjs";

/** Template A — time-based invoice (hourly / daily). */
export function renderInvoiceDocument(invoice) {
  const showHours = invoice.lines.some((line) => Number(line.hours) > 0);
  const period = invoice.period || {};
  const periodLabel = [period.from, period.to].filter(Boolean).map((d) => formatDocumentDate(d)).join(" to ");

  return renderBusinessDocument({
    kind: "Invoice",
    variant: "invoice",
    ref: invoice.ref,
    metadata: [
      invoice.issued ? { label: "Issued", value: formatDocumentDate(invoice.issued) } : null,
      invoice.due ? { label: "Due", value: formatDocumentDate(invoice.due) } : null
    ].filter(Boolean),
    parties: [partyModel("From", invoice.from), partyModel("Bill to", invoice.to)],
    banner: periodLabel
      ? { label: "Service period", value: periodLabel, summary: `${number(invoice.totals.billableDays)} billable days` }
      : null,
    details: detailStrip(invoice),
    table: {
      columns: [
        { key: "service", label: "Service" },
        { key: "days", label: "Days", align: "right" },
        ...(showHours ? [{ key: "hours", label: "Hours", align: "right" }] : []),
        { key: "rate", label: "Rate", align: "right" },
        { key: "amount", label: "Amount", align: "right" }
      ],
      rows: invoice.lines.map((line) => ({
        service: { value: line.desc, subtext: line.note, strong: true },
        days: number(line.days),
        ...(showHours ? { hours: number(line.hours) } : {}),
        rate: `${formatCurrencyMinor(line.rate, invoice.currency)} / ${line.rateUnit}`,
        amount: { value: formatCurrencyMinor(line.amount, invoice.currency), strong: true }
      }))
    },
    notes: invoice.notes ? { label: "Notes", body: invoice.notes } : null,
    totals: totalsRows(invoice),
    footnote: fxFootnote(invoice.fx, invoice.totals.grandTotal, invoice.currency, formatCurrencyMinor),
    settlement: settlementModel(invoice),
    footer: { left: invoice.footerTerms, right: invoice.website }
  });
}
/** Template B — retainer invoice. */
export function renderRetainerDocument(invoice) {
  const r = invoice.retainer || {};
  const cycle = r.cycleIndex && r.cycleTotal ? `Cycle ${r.cycleIndex} of ${r.cycleTotal}` : "";

  return renderBusinessDocument({
    kind: "Invoice",
    variant: "retainer",
    ref: invoice.ref,
    ariaLabel: `Retainer invoice ${invoice.ref || ""}`,
    metadata: [
      invoice.issued ? { label: "Issued", value: formatDocumentDate(invoice.issued) } : null,
      invoice.due ? { label: "Due", value: formatDocumentDate(invoice.due) } : null,
      cycle ? { value: cycle } : null
    ].filter(Boolean),
    parties: [partyModel("From", invoice.from), partyModel("Bill to", invoice.to)],
    banner: {
      label: "Retainer period",
      value: [r.periodFrom, r.periodTo].filter(Boolean).map((d) => formatDocumentDate(d)).join(" to "),
      summary: `${number(r.includedHours)} hours included`
    },
    details: [
      Number(r.carriedOver) ? { label: "Carried over", value: `${number(r.carriedOver)} hrs` } : null,
      ...detailStrip(invoice)
    ].filter(Boolean),
    table: {
      columns: [
        { key: "service", label: "Charge" },
        { key: "qty", label: "Qty", align: "right" },
        { key: "rate", label: "Rate", align: "right" },
        { key: "amount", label: "Amount", align: "right" }
      ],
      rows: invoice.lines.map((line) => ({
        service: { value: line.desc, subtext: line.note, strong: true },
        qty: number(line.days ?? line.hours ?? 1),
        rate: `${formatCurrencyMinor(line.rate, invoice.currency)}${line.rateUnit ? ` / ${line.rateUnit}` : ""}`,
        amount: { value: formatCurrencyMinor(line.amount, invoice.currency), strong: true }
      }))
    },
    // scope prints as an unordered two-column list — it is a list of inclusions,
    // not a numbered sequence
    sections: (r.scope || []).length
      ? [{ heading: "Scope included this cycle", items: r.scope, ordered: false, columnar: true }]
      : [],
    notes: invoice.notes ? { label: "Notes", body: invoice.notes } : null,
    totals: totalsRows(invoice),
    footnote: fxFootnote(invoice.fx, invoice.totals.grandTotal, invoice.currency, formatCurrencyMinor),
    settlement: settlementModel(invoice),
    footer: { left: invoice.footerTerms, right: invoice.website }
  });
}

/** Template C — milestone invoice. */
export function renderMilestoneDocument(invoice) {
  const m = invoice.milestone || {};
  const stages = m.stages || [];
  const billed = stages.find((s) => Number(s.billedThisInvoice) > 0);

  return renderBusinessDocument({
    kind: "Invoice",
    variant: "milestone",
    ref: invoice.ref,
    ariaLabel: `Milestone invoice ${invoice.ref || ""}`,
    metadata: [
      invoice.issued ? { label: "Issued", value: formatDocumentDate(invoice.issued) } : null,
      invoice.due ? { label: "Due", value: formatDocumentDate(invoice.due) } : null
    ].filter(Boolean),
    parties: [partyModel("From", invoice.from), partyModel("Bill to", invoice.to)],
    banner: {
      label: "Project",
      value: m.projectRef || "",
      summary: m.contractValue ? `Contract ${formatCurrencyMinor(m.contractValue, invoice.currency)}` : ""
    },
    details: [
      billed ? { label: "Billing", value: billed.name } : null,
      ...detailStrip(invoice)
    ].filter(Boolean),
    table: {
      columns: [
        { key: "stage", label: "Milestone" },
        { key: "state", label: "State", align: "right" },
        { key: "pct", label: "%", align: "right" },
        { key: "value", label: "Value", align: "right" },
        { key: "billed", label: "This invoice", align: "right" }
      ],
      rows: stages.map((stage) => {
        const isBilled = Number(stage.billedThisInvoice) > 0;
        return {
          stage: { value: stage.name, subtext: stage.note, strong: true },
          state: { value: stage.state, state: true, muted: !isBilled && stage.state !== "Complete" },
          pct: stage.pct == null ? "" : `${number(stage.pct)}%`,
          value: formatCurrencyMinor(stage.value, invoice.currency),
          billed: isBilled
            ? { value: formatCurrencyMinor(stage.billedThisInvoice, invoice.currency), strong: true }
            : "—"
        };
      })
    },
    notes: invoice.notes ? { label: "Notes", body: invoice.notes } : null,
    totals: totalsRows(invoice),
    footnote: [
      m.invoicedToDate && m.contractValue
        ? `Invoiced to date: ${formatCurrencyMinor(m.invoicedToDate, invoice.currency)} of ${formatCurrencyMinor(m.contractValue, invoice.currency)}.`
        : "",
      fxFootnote(invoice.fx, invoice.totals.grandTotal, invoice.currency, formatCurrencyMinor)
    ].filter(Boolean).join(" "),
    settlement: settlementModel(invoice),
    footer: { left: invoice.footerTerms, right: invoice.website }
  });
}

/** Pick the renderer from the model. Single entry point for the billing page. */
export function renderDocument(invoice) {
  switch (invoice.template) {
    case "retainer": return renderRetainerDocument(invoice);
    case "milestone": return renderMilestoneDocument(invoice);
    default: return renderInvoiceDocument(invoice);
  }
}

// ---- shared pieces -------------------------------------------------------

function detailStrip(invoice) {
  return [
    invoice.to?.poRef ? { label: "PO reference", value: invoice.to.poRef } : null,
    invoice.to?.taxId ? { label: "Client tax ID", value: invoice.to.taxId } : null,
    invoice.from?.taxId ? { label: "Provider tax ID", value: invoice.from.taxId } : null,
    invoice.terms ? { label: "Terms", value: invoice.terms } : null
  ].filter(Boolean);
}

function totalsRows(invoice) {
  return [
    { label: "Subtotal", value: formatCurrencyMinor(invoice.totals.subtotal, invoice.currency) },
    ...(invoice.adjustments || []).map((item) => ({
      label: item.label,
      value: formatCurrencyMinor(item.amount, invoice.currency)
    })),
    { label: "Total due", value: formatCurrencyMinor(invoice.totals.grandTotal, invoice.currency), emphasis: true }
  ];
}

function settlementModel(invoice) {
  const p = invoice.payment || {};
  return {
    label: "Payment method",
    method: p.method,
    accountName: p.accountName,
    fields: p.fields,
    reference: p.reference,
    due: invoice.due ? { label: "Payment due", value: formatDocumentDate(invoice.due) } : null
  };
}
