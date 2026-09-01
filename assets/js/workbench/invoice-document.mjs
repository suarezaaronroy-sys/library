import { formatCurrencyMinor, number } from "./billing-core.mjs";
import { formatDocumentDate, renderBusinessDocument } from "./document-engine.mjs?v=1";

export function renderInvoiceDocument(invoice) {
  const showHours = invoice.lines.some((line) => line.rateUnit === "hour");
  const periodLabel = [invoice.period.from, invoice.period.to]
    .filter(Boolean)
    .map(formatDocumentDate)
    .join(" to ");
  const details = [
    invoice.to.poRef ? { label: "PO reference", value: invoice.to.poRef } : null,
    invoice.to.taxId ? { label: "Client tax ID", value: invoice.to.taxId } : null,
    invoice.from.taxId ? { label: "Provider tax ID", value: invoice.from.taxId } : null,
    invoice.terms ? { label: "Terms", value: invoice.terms } : null
  ].filter(Boolean);
  const indicativeValue = invoice.fx
    ? Math.round(invoice.totals.grandTotal * invoice.fx.rate)
    : 0;

  return renderBusinessDocument({
    kind: "Invoice",
    variant: "invoice",
    ref: invoice.ref,
    metadata: [
      invoice.issued ? { label: "Issued", value: formatDocumentDate(invoice.issued) } : null,
      invoice.due ? { label: "Due", value: formatDocumentDate(invoice.due) } : null
    ].filter(Boolean),
    parties: [partyModel("From", invoice.from), partyModel("Bill to", invoice.to)],
    banner: {
      label: "Service period",
      value: periodLabel,
      summary: `${number(invoice.totals.billableDays)} billable days`
    },
    details,
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
    totals: [
      { label: "Subtotal", value: formatCurrencyMinor(invoice.totals.subtotal, invoice.currency) },
      ...invoice.adjustments.map((item) => ({ label: item.label, value: formatCurrencyMinor(item.amount, invoice.currency) })),
      { label: "Total due", value: formatCurrencyMinor(invoice.totals.grandTotal, invoice.currency), emphasis: true }
    ],
    footnote: invoice.fx
      ? `Indicative only: ${formatCurrencyMinor(indicativeValue, invoice.fx.to)} at 1 ${invoice.currency} = ${number(invoice.fx.rate)} ${invoice.fx.to}. Payment remains due in ${invoice.currency}.`
      : "",
    settlement: {
      label: "Payment method",
      method: invoice.payment.method,
      accountName: invoice.payment.accountName,
      fields: invoice.payment.fields,
      reference: invoice.payment.reference,
      due: invoice.due ? { label: "Payment due", value: formatDocumentDate(invoice.due) } : null
    },
    footer: {
      left: invoice.footerTerms,
      right: invoice.website
    }
  });
}

function partyModel(label, party) {
  const heading = party.org || party.name;
  const secondary = party.org && party.name !== party.org ? party.name : "";
  return {
    label,
    heading,
    lines: [party.attn, secondary, ...party.addressLines, party.email].filter(Boolean)
  };
}
