export function loadState(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return structuredClone(fallback);
    return mergeState(structuredClone(fallback), JSON.parse(stored));
  } catch {
    return structuredClone(fallback);
  }
}

export function saveState(key, state) {
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function mergeState(fallback, stored) {
  if (!stored || typeof stored !== "object") return fallback;
  return {
    ...fallback,
    ...stored,
    profile: { ...fallback.profile, ...(stored.profile || {}) },
    months: { ...fallback.months, ...(stored.months || {}) }
  };
}

// Raw JSON value (arrays, primitives) — no object merge. Per-key isolation.
export function loadValue(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored == null) return fallback;
    const value = JSON.parse(stored);
    return value == null ? fallback : value;
  } catch {
    return fallback;
  }
}

// ---- whole-workbench backup ----
export const BACKUP_PREFIXES = ["aaron-workbench:", "asuarez."];

export function exportAllState() {
  const backup = { artifactType: "workbench-backup", schemaVersion: 1, exportedAt: new Date().toISOString(), data: {} };
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!BACKUP_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
    try {
      backup.data[key] = JSON.parse(window.localStorage.getItem(key));
    } catch {
      backup.data[key] = window.localStorage.getItem(key);
    }
  }
  return backup;
}

export function importAllState(payload) {
  if (!payload || payload.artifactType !== "workbench-backup" || typeof payload.data !== "object") return -1;
  let imported = 0;
  for (const [key, value] of Object.entries(payload.data)) {
    if (!BACKUP_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
    try {
      window.localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
      imported += 1;
    } catch {}
  }
  return imported;
}
