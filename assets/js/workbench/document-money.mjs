// Currency helpers shared by every document template.
// Kept separate from billing-core so the document layer has no calculator coupling.

const digitsCache = new Map();

/** Minor-unit digits for a currency (GBP 2, JPY 0, KWD 3). */
export function minorUnitDigits(currency, locale = "en-GB") {
  if (digitsCache.has(currency)) return digitsCache.get(currency);
  let digits = 2;
  try {
    digits = new Intl.NumberFormat(locale, { style: "currency", currency })
      .resolvedOptions().maximumFractionDigits;
  } catch {
    digits = 2;
  }
  digitsCache.set(currency, digits);
  return digits;
}

/**
 * [FIX 7] Convert between currencies in minor units.
 * The previous `Math.round(grandTotal * rate)` was correct only because GBP and PHP
 * both have two decimals. It silently produced a 100x error for a 0-decimal target
 * such as JPY. Scale out of `from`'s minor units and back into `to`'s.
 */
export function convertMinor(minor, rate, from, to) {
  const major = (Number(minor) || 0) / 10 ** minorUnitDigits(from);
  return Math.round(major * (Number(rate) || 0) * 10 ** minorUnitDigits(to));
}

/** [FIX 7b] FX rates need fixed decimals — `73` should read `73.0000`. */
export function formatRate(rate, decimals = 4) {
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(Number(rate) || 0);
}

/** Indicative-conversion footnote. Never part of the payable. */
export function fxFootnote(fx, grandTotalMinor, currency, formatCurrencyMinor) {
  if (!fx || !fx.to || !fx.rate) return "";
  const converted = convertMinor(grandTotalMinor, fx.rate, currency, fx.to);
  return `Indicative only: ${formatCurrencyMinor(converted, fx.to)} at 1 ${currency} = ${formatRate(fx.rate)} ${fx.to}. Payment remains due in ${currency}.`;
}

/**
 * [FIX 3] Compose a party's address lines without repeating the contact name.
 * Previously `attn` and `name` were both emitted, printing
 * "Attn: Alan Dobbie" immediately above "Alan Dobbie".
 */
export function partyModel(label, party = {}) {
  const heading = party.org || party.name || "";
  const attn = String(party.attn ?? "").trim();
  const name = String(party.name ?? "").trim();
  const attnHasName = Boolean(attn && name) && attn.toLowerCase().includes(name.toLowerCase());
  const secondary = name && name !== heading && !attnHasName ? name : "";
  const lines = [attn, secondary, ...(party.addressLines || []), party.email]
    .map((line) => String(line ?? "").trim())
    .filter(Boolean);
  return { label, heading, lines: [...new Set(lines)] };
}

