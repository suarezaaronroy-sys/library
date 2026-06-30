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
