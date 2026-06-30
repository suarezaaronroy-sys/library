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
- Active routes also exist for Scheduling, Writing, Marketing, CRM, Library Tools, and Decisions.
- Billing UI controller: `assets/js/workbench/billing.js`.
- Pure Billing calculations: `assets/js/workbench/billing-core.mjs`.
- Defensive local storage helper: `assets/js/workbench/store.js`.
- Billing tests: `tests/workbench-billing.test.mjs`.

## Storage Contract

Billing uses `localStorage` key `aaron-workbench:v1:billing`. The key remains stable, but the internal schema is now version 2. Version 1 month data is migrated in the browser.

```js
{
  schemaVersion: 2,
  period: {
    start: "YYYY-MM-DD",
    end: "YYYY-MM-DD"
  },
  profile: {
    clientName: "",
    currency: "GBP",
    rateType: "hourly",
    rate: 0,
    hoursPerDay: 8,
    fxRate: 74,
    notes: ""
  },
  dates: {
    "YYYY-MM-DD": "full | half | holiday | off"
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
- [x] ~~Build Monday-first calendars for billing periods that may cross months.~~
- [x] ~~Default weekdays to full and weekends to off.~~
- [x] ~~Cycle dates through full, half, holiday, and off states.~~
- [x] ~~Calculate billable days, hours, native total, and PHP estimate.~~
- [x] ~~Persist the workspace locally without a backend.~~
- [x] ~~Generate a copyable invoice working summary.~~
- [x] ~~Add CSV and JSON exports.~~
- [x] ~~Cover the calculation engine with focused tests.~~
- [x] ~~Migrate saved month-based Billing state to a date-range model.~~
- [ ] Add named client presets without exposing real client data by default.
- [ ] Add a local monthly archive and restore flow.
- [ ] Add a print-ready invoice draft after the archive model is stable.

### Scheduling Workspace

- [x] ~~World clock with a focused remote-work city list.~~
- [x] ~~Timezone overlap planner with working-hour overlays.~~
- [x] ~~Reusable local countdowns for meetings and deadlines.~~
- [ ] Let users customize and persist the visible clock list.

### Writing Workspace

- [x] ~~Autosaving scratchpad.~~
- [x] ~~Explicit clipboard capture.~~
- [x] ~~Text cleanup utilities and reusable snippets.~~
- [x] ~~Live Markdown preview.~~
- [ ] Add named scratchpad documents and export.

### Marketing Workspace

- [x] ~~UTM builder with readable output.~~
- [x] ~~Campaign naming generator.~~
- [x] ~~Funnel and ROI calculators with visible formulas.~~
- [ ] Save campaign presets locally.

### CRM Workspace

- [x] ~~Pipeline stage and value simulator.~~
- [ ] Workflow flowchart builder.
- [x] ~~JSON formatter and validator.~~
- [x] ~~Webhook/API request tester with strong privacy warnings.~~
- [x] ~~Regex tester.~~

### Library Tools

- [x] ~~Grimoire front matter and scaffold builder.~~
- [x] ~~Note builder.~~
- [x] ~~Metadata and related-link helpers.~~
- [ ] Validate generated front matter against current production layouts.

### Decision Tools

- [x] ~~Decision journal.~~
- [x] ~~Belief revision log.~~
- [x] ~~Record what changed, why, and when to review it.~~
- [ ] Add outcome updates to existing records.

## Next Safest Task

Refine Billing client presets and archives. Keep them local, support more than one billing period per client, and add explicit import/export before introducing any destructive edit flow.

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
Get-ChildItem assets/js/workbench/*.*js | ForEach-Object { node --check $_.FullName }
bundle exec jekyll build
git diff --check
```

Then serve locally and inspect both routes at desktop and mobile widths:

- `/library/workbench/`
- `/library/workbench/billing/`
- `/library/workbench/scheduling/`
- `/library/workbench/writing/`
- `/library/workbench/marketing/`
- `/library/workbench/crm/`
- `/library/workbench/library-tools/`
- `/library/workbench/decisions/`

Confirm the browser console is clean, totals update after editing a day, and saved data survives a reload.

## Last Handoff

- Date: 2026-07-01
- Status: All seven workspaces have functional MVPs. Cross-month Billing and the full suite pass local desktop/mobile QA and live deployment verification.
