# Sari2POS Developer Handoff

Sari2POS is currently a Lab prototype that still runs as a local-first browser app, but it is no longer a single-file blob. The refactor boundary is intentionally conservative: easier daily development now, cleaner APK extraction later.

## Current File Map

- `lab/sari2pos.html` is the app shell and markup.
- `assets/sari2pos/styles.css` owns the Sari2POS visual system.
- `assets/sari2pos/app.js` owns the runtime, state, storage, and public handlers.
- `html2canvas` is still loaded from CDN for receipt/image export. For APK or offline use, vendor this file locally.

## Runtime Contract

The app exposes a small global contract at `window.Sari2POS`:

- `Sari2POS.meta` describes the app version, schema, runtime, and extraction readiness.
- `Sari2POS.storageKeys` lists every `localStorage` key owned by Sari2POS.
- `Sari2POS.factories` exposes default product/user/permission factories.
- `Sari2POS.permissions` exposes permission defaults and labels.
- `Sari2POS.getStateSnapshot()` returns the current in-memory state for debugging or export tooling.

Keep this contract stable unless the app schema changes.

## Development Rules

- Edit markup in `lab/sari2pos.html`.
- Edit visual styling in `assets/sari2pos/styles.css`.
- Edit behavior in `assets/sari2pos/app.js`.
- Do not add new inline `<style>` or `<script>` blocks to the HTML shell.
- Avoid adding more inline event handlers. Existing handlers are tolerated until a later migration removes them.
- Keep `app.js` as a classic script for now. Do not convert it to `type="module"` while the HTML still calls global functions directly.
- Keep data local-first. The current owner storage keys are listed in `Sari2POS.storageKeys`.

## APK Extraction Path

When this graduates from Lab prototype to APK candidate:

1. Copy `lab/sari2pos.html` and `assets/sari2pos/*` into the mobile app web root.
2. Replace `../assets/sari2pos/...` paths with bundled app paths.
3. Vendor `html2canvas` locally instead of loading it from CDN.
4. Add a PWA manifest and service worker so the browser build can be tested offline first.
5. Wrap the web root with Capacitor or a similar Android shell.
6. Replace direct `localStorage` access with a storage adapter only if device storage, backup, or sync requirements demand it.

## Suggested Next Refactor Phases

- Phase 1: Asset extraction from the single HTML file. Done.
- Phase 2: Split `app.js` into classic-script files by concern: defaults, storage, i18n, state, screens, reports, exports.
- Phase 3: Replace inline HTML handlers with delegated event listeners.
- Phase 4: Add offline assets and a service worker.
- Phase 5: Add an APK wrapper with a small platform bridge for export/share/backup.

## QA Checklist

- Load `/library/lab/sari2pos.html` locally.
- Confirm the splash screen resolves into the user selection screen.
- Confirm `window.Sari2POS.meta.extractionReady === true`.
- Confirm CSS loads from `assets/sari2pos/styles.css`.
- Confirm no console errors appear on first load.
- Confirm core flows still work: user select, POS cart, inventory, reports, settings, export/import.

