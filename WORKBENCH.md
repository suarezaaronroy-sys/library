# Operator Workbench Continuation Guide

This file is the handoff ledger for humans and LLMs extending the Workbench. It should stay current. Cross out completed work instead of deleting it so the build history remains legible.

## Product Intent

The Library captures knowledge. The Workbench reduces working memory.

Every workspace should turn a recurring operational task into a small, dependable instrument. Keep it client-side, calm, understandable, and useful without an account.

## Current Architecture

- Jekyll static site hosted below `/library/`.
- Shared shell: `_layouts/workbench.html`.
- Shared Workbench styles: `assets/css/workbench.css`.
- Workspace index: `workbench/index.html`.
- Billing route: `workbench/billing/index.html`.
- Billing UI controller: `assets/js/workbench/billing.js`.
- Pure Billing calculations: `assets/js/workbench/billing-core.mjs`.
- Defensive local storage helper: `assets/js/workbench/store.js`.
- Billing tests: `tests/workbench-billing.test.mjs`.

## Storage Contract

Billing uses `localStorage` key `aaron-workbench:v1:billing`.

```js
{
  schemaVersion: 1,
  month: "YYYY-MM",
  profile: {
    clientName: "",
    currency: "GBP",
    rateType: "hourly",
    rate: 0,
    hoursPerDay: 8,
    fxRate: 74,
    notes: ""
  },
  months: {
    "YYYY-MM": {
      "YYYY-MM-DD": "full | half | holiday | off"
    }
  }
}
```

When changing this shape, increment the schema version and add an explicit migration. Never silently discard saved user data.

## Build Ledger

### Foundation

- [x] ~~Add Workbench to the global navigation.~~
- [x] ~~Create a reusable Workbench layout and horizontal workspace navigation.~~
- [x] ~~Create the workspace index and status ledger.~~
- [x] ~~Introduce a subtle drafting-paper texture across the Library.~~
- [x] ~~Keep future workspaces visible but disabled until they exist.~~

### Billing MVP

- [x] ~~Add client, currency, rate basis, rate, hours, FX, and notes fields.~~
- [x] ~~Build a Monday-first monthly billing calendar.~~
- [x] ~~Default weekdays to full and weekends to off.~~
- [x] ~~Cycle dates through full, half, holiday, and off states.~~
- [x] ~~Calculate billable days, hours, native total, and PHP estimate.~~
- [x] ~~Persist the workspace locally without a backend.~~
- [x] ~~Generate a copyable invoice working summary.~~
- [x] ~~Add CSV and JSON exports.~~
- [x] ~~Cover the calculation engine with focused tests.~~
- [ ] Add named client presets without exposing real client data by default.
- [ ] Add a local monthly archive and restore flow.
- [ ] Add a print-ready invoice draft after the archive model is stable.

### Scheduling Workspace

- [ ] World clock with a small saved city list.
- [ ] Timezone overlap planner with working-hour overlays.
- [ ] Reusable countdowns for meetings and deadlines.

### Writing Workspace

- [ ] Autosaving scratchpad.
- [ ] Local clipboard history with explicit opt-in.
- [ ] Text cleanup utilities and reusable snippets.
- [ ] Side-by-side Markdown preview.

### Marketing Workspace

- [ ] UTM builder with readable output.
- [ ] Campaign naming generator.
- [ ] Funnel and ROI calculators with visible formulas.

### CRM Workspace

- [ ] Pipeline simulator.
- [ ] Workflow flowchart builder.
- [ ] JSON formatter and validator.
- [ ] Webhook/API request tester with strong privacy warnings.
- [ ] Regex tester.

### Library Tools

- [ ] Grimoire front matter and scaffold builder.
- [ ] Note builder.
- [ ] Metadata and related-link helpers.

### Decision Tools

- [ ] Decision journal.
- [ ] Belief revision log.
- [ ] Outcome review: what changed, why, and whether to repeat it.

## Next Safest Task

Build the Scheduling Workspace as a separate route and script. Reuse the shell and storage helper, but do not couple its state to Billing. Begin with world clocks and a two-timezone overlap strip; leave countdown persistence for a second pass.

## Rules Future Agents Must Preserve

1. No backend, login, API key, analytics, or third-party tracker is required.
2. Do not place private client names, rates, or notes in source control.
3. Keep calculations in pure modules and browser orchestration in separate files.
4. Use buttons and labels for interactive elements; never rely on color alone.
5. Each workspace needs responsive browser QA before its ledger item is crossed out.
6. Preserve existing Library header, footer, SEO conventions, and `/library/` base path.
7. New tools must remove recurring friction, not merely display information.

## Verification

```powershell
node --test tests/workbench-billing.test.mjs
bundle exec jekyll build
git diff --check
```

Then serve locally and inspect both routes at desktop and mobile widths:

- `/library/workbench/`
- `/library/workbench/billing/`

Confirm the browser console is clean, totals update after editing a day, and saved data survives a reload.

## Last Handoff

- Date: 2026-07-01
- Status: Billing MVP implemented and locally verified; live deployment QA remains.
