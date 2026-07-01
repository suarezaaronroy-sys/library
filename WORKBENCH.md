# Operator Workbench Continuation Guide

This is the canonical README and handoff document for humans and LLMs extending the Workbench. Read it before editing Workbench routes, navigation, storage, or shared search.

Keep completed work crossed out instead of deleting it. The ledger is part roadmap, part operating memory.

## Product Intent

The Library captures knowledge. The Workbench reduces working memory.

The Workbench is a collection of small, local-first instruments. It is not a replacement for Notion, ClickUp, Miro, or a full accounting system. It removes recurring calculation, formatting, recall, and context-recovery work.

## Locked Design Decisions

These decisions come directly from the site owner and must not be changed casually:

1. Keep the original numbered Workbench ledger.
2. Keep every workspace visible as a direct horizontal tab.
3. Do not replace the tab strip with a dashboard shell, hidden menu, or grouped Tools menu.
4. The final tab order is:

   `Desk · Billing · Scheduling · Writing · Marketing · CRM · Library tools · Decisions · Whiteboard · Resources`

5. Resources is always the last Workbench tab and last ledger row.
6. Whiteboard is immediately before Resources.
7. Universal search belongs in the global site header, not inside a redesigned Workbench shell.
8. Search results must display breadcrumbs so similarly named tools, Notes, and Grimoires remain understandable.
9. New functionality should extend the established typography-led layout rather than replacing it.

## Architecture

- Static Jekyll site hosted below `/library/`.
- No backend, account, database, required API key, or cloud sync.
- Shared Workbench layout: `_layouts/workbench.html`.
- Shared Workbench styling: `assets/css/workbench.css`.
- Global site search include: `_includes/site-search.html`.
- Global search controller: `assets/js/site-search.js`.
- Resource registry helpers: `assets/js/workbench/registry.mjs`.
- Defensive local storage helper: `assets/js/workbench/store.js`.
- Curated resource seed: `_data/workbench_resources.json`.
- Published Grimoires: `_data/grimoires.yml`.
- Notes: `_notes/`.

## Routes

| Tab | Route | Script |
|---|---|---|
| Desk | `/workbench/` | none |
| Billing | `/workbench/billing/` | `billing.js` |
| Scheduling | `/workbench/scheduling/` | `scheduling.js` |
| Writing | `/workbench/writing/` | `writing.js` |
| Marketing | `/workbench/marketing/` | `marketing.js` |
| CRM | `/workbench/crm/` | `crm.js` |
| Library tools | `/workbench/library-tools/` | `library-tools.js` |
| Decisions | `/workbench/decisions/` | `decisions.js` |
| Whiteboard | `/workbench/whiteboard/` | `canvas.js` |
| Resources | `/workbench/resources/` | `resources.js` |

The Whiteboard source folder remains `workbench/canvas/`; its public permalink is `/workbench/whiteboard/`.

## Universal Search

Global search is available from the main site navigation and `/`.

It indexes:

- Core site pages
- Internal Workbench tools
- External Resource Hub entries
- Published Grimoires
- Notes

Every result has a breadcrumb:

```text
Workbench › Operations
Library › Grimoires › G017
Library › Notes
Resource Hub › Automation › External
```

`Ctrl/Cmd + K` opens universal search except on the Whiteboard, where it searches the current canvas. `/` remains the universal shortcut.

## Resource Registry

Repository metadata lives in `_data/workbench_resources.json`.

```json
{
  "id": "wise",
  "name": "Wise",
  "url": "https://wise.com/",
  "kind": "external",
  "category": "Accounting",
  "description": "International transfers and multi-currency accounts.",
  "tags": ["payments", "currency", "invoice"],
  "pricing": "Usage based"
}
```

Rules:

1. IDs are stable and unique.
2. Internal URLs omit the `/library` base path.
3. Personal notes, favorites, recents, and usage counts never enter this file.
4. External URLs must use `https://`.
5. Resource descriptions explain when the tool is useful, not marketing claims.

Private Resource Hub state uses `aaron-workbench:v1:resources`:

```js
{
  schemaVersion: 1,
  favorites: ["billing", "wise"],
  notes: { wise: "Confirm the payout rate before invoicing." },
  recents: ["wise", "billing"],
  usage: { wise: 4, billing: 12 }
}
```

## Whiteboard

The Whiteboard uses vendored Cytoscape.js 3.34.0:

`assets/vendor/cytoscape/cytoscape-3.34.0.min.js`

Do not replace it with React or a new build pipeline without a strong reason.

MVP features:

- Pan and zoom
- Nine node types
- Four direct-drag connection ports on the selected node
- Three-step undo and redo
- 24px grid snapping after a node is moved
- Straight arrow connectors
- Node property inspector
- Named canvases
- Explicit local Save, with optional Autosave disabled by default
- `Ctrl/Cmd + K` canvas search and highlighting
- Linked Resource Hub entries
- JSON import/export
- PNG export
- SVG export

Storage key: `aaron-workbench:v1:canvas`.

```js
{
  schemaVersion: 1,
  activeId: "canvas-...",
  canvases: {
    "canvas-...": {
      id,
      title,
      createdAt,
      updatedAt,
      viewport: { zoom, pan },
      elements: { nodes: [], edges: [] }
    }
  }
}
```

Deferred:

- Collapsible groups
- Live Grimoire previews
- AI generation
- Cloud synchronization
- Multiplayer
- Fancy connector routing

## Workspace Storage

| Workspace | Key | Version |
|---|---|---|
| Billing | `aaron-workbench:v1:billing` | schema 2 inside stable key |
| Scheduling | `aaron-workbench:v2:scheduling` | 2 |
| Writing | `aaron-workbench:v2:writing` | 2 |
| Decisions | `aaron-workbench:v1:decisions` | 1 |
| Resources | `aaron-workbench:v1:resources` | 1 |
| Whiteboard | `aaron-workbench:v1:canvas` | 1 |

Scheduling and Writing read their earlier v1 keys once to migrate existing countdowns, scratchpad text, snippets, and Markdown.

When changing a stored structure:

1. Increment its schema or key version.
2. Read and migrate the prior state.
3. Preserve user data.
4. Add JSON export before any destructive migration.

## Build Ledger

### Foundation

- [x] ~~Create the original direct-tab Workbench layout.~~
- [x] ~~Create the numbered workspace ledger.~~
- [x] ~~Apply the drafting-paper visual foundation.~~
- [x] ~~Keep every workspace local-first and static-host compatible.~~

### Billing

- [x] ~~Support billing periods spanning multiple months.~~
- [x] ~~Migrate old month-based state.~~
- [x] ~~Calculate hourly and daily rates, PHP estimates, and half-days.~~
- [x] ~~Export summary, CSV, and JSON.~~
- [ ] Add named client presets.
- [ ] Add period archives and print-ready invoice drafts.

### Scheduling

- [x] ~~Add a local 12/24-hour clock.~~
- [x] ~~Add a stopwatch with laps.~~
- [x] ~~Add a duration countdown timer.~~
- [x] ~~Add remote-work world clocks with working-hours status.~~
- [x] ~~Keep timezone overlap planning.~~
- [x] ~~Keep persistent event countdowns.~~
- [ ] Let the user customize and reorder world clocks.
- [ ] Add optional timer completion sound and browser notification.

### Writing

- [x] ~~Upgrade the scratchpad to a formatted local notepad.~~
- [x] ~~Add bold, italic, underline, heading, list, undo, and redo controls.~~
- [x] ~~Keep text cleanup, snippets, clipboard capture, and Markdown preview.~~
- [x] ~~Add text and HTML export.~~
- [ ] Add multiple named notes.
- [ ] Replace `execCommand` formatting if a lightweight native alternative becomes practical.

### Marketing, CRM, Library Tools, Decisions

- [x] ~~Build functional local-first MVPs for all four workspaces.~~
- [ ] Add saved campaign presets.
- [ ] Add CRM workflow mapping.
- [ ] Validate publishing scaffolds against every production layout.
- [ ] Add outcome updates to existing decision records.

### Resources

- [x] ~~Create a shared curated resource registry.~~
- [x] ~~Add search, categories, favorites, private notes, and recents.~~
- [x] ~~Add Resource memory import/export.~~
- [x] ~~Mix internal Workbench tools with external resources.~~
- [ ] Add user-created resources without editing repository data.
- [ ] Add optional resource ratings.

### Universal Search

- [x] ~~Search site pages, Workbench tools, external resources, Grimoires, and Notes.~~
- [x] ~~Show breadcrumbs for every result.~~
- [x] ~~Keep Whiteboard `Ctrl/Cmd + K` scoped to canvas nodes.~~
- [ ] Add typo tolerance only if the current weighted search proves insufficient.

## Next Safest Tasks

1. Finish full browser QA for Resource Hub, Whiteboard, universal search, Scheduling, and Writing.
2. Verify persistence after reload.
3. Verify Whiteboard JSON, PNG, and SVG downloads.
4. Verify mobile layout and touch interaction.
5. Update the final handoff status below.

Do not start groups, AI generation, or live previews until the Whiteboard MVP is stable.

## Verification

```powershell
node --test tests/workbench-billing.test.mjs
Get-ChildItem assets/js/workbench/*.*js | ForEach-Object { node --check $_.FullName }
node --check assets/js/site-search.js
bundle exec jekyll build
git diff --check
```

Browser QA routes:

- `/library/`
- `/library/workbench/`
- `/library/workbench/scheduling/`
- `/library/workbench/writing/`
- `/library/workbench/whiteboard/`
- `/library/workbench/resources/`

Confirm:

- One H1 per page
- No console errors
- No horizontal document overflow
- Resources remains the final tab and ledger row
- Search breadcrumbs identify result location
- Local state survives reload
- Whiteboard canvas is nonblank and interactive

## Last Handoff

- Date: 2026-07-01
- Status: Resource Hub, Whiteboard, global search, Scheduling clock suite, and formatted Writing notepad are implemented locally. Full browser QA and deployment remain.
