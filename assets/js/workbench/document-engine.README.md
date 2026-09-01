# D'Workbench document engine

`document-engine.mjs` renders escaped, print-safe A4 business documents from a declarative model. Include `assets/css/document-engine.css` on every document tool page.

Supported building blocks:

- document type, reference, and metadata
- provider/client or other party blocks
- highlight banner and detail strip
- prose or numbered sections for contracts
- configurable line-item tables for estimates and quotes
- notes, totals, settlement/due details, signatures, and footer
- automatic omission of blank blocks

```js
import { renderBusinessDocument, formatDocumentDate } from "./document-engine.mjs";

const html = renderBusinessDocument({
  kind: "Quote",
  ref: "QUO-202609020",
  metadata: [{ label: "Issued", value: formatDocumentDate("2026-09-02") }],
  parties: [
    { label: "From", heading: "Studio name", lines: ["hello@example.com"] },
    { label: "Prepared for", heading: "Client name", lines: [] }
  ],
  table: {
    columns: [
      { key: "item", label: "Item" },
      { key: "amount", label: "Amount", align: "right" }
    ],
    rows: [{ item: { value: "Discovery", strong: true }, amount: "GBP 500.00" }]
  },
  totals: [{ label: "Quote total", value: "GBP 500.00", emphasis: true }],
  footer: { left: "Valid for 30 days", right: "example.com" }
});
```

Contracts use `sections` and `signatures`; estimates and quotes normally use `table`, `totals`, and an optional validity banner. The calling tool owns form state and print-button behavior. Never pass prebuilt HTML: all model values are treated as text and escaped by the engine.
