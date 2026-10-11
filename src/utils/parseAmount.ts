/**
 * Parses an ingredient amount that may be a number, a plain or mixed
 * fraction string ("1/2", "1 1/2"), or a unicode vulgar fraction ("½",
 * "1½"). Returns null for anything unparseable (never NaN) so callers can
 * tell "no amount" apart from "zero amount" and avoid silently writing a
 * corrupted value back to the database.
 */

const UNICODE_FRACTIONS: Record<string, number> = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅕': 0.2,
  '⅖': 0.4,
  '⅗': 0.6,
  '⅘': 0.8,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

const UNICODE_FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join('');

export function parseAmount(amount: number | string | null | undefined): number | null {
  if (amount === null || amount === undefined) return null;
  if (typeof amount === 'number') return isNaN(amount) ? null : amount;

  const str = amount.toString().trim();
  if (!str) return null;

  // Mixed unicode fraction: "1½" or "1 ½"
  const mixedUnicodeMatch = str.match(
    new RegExp(`^(\\d+)\\s*([${UNICODE_FRACTION_CHARS}])$`)
  );
  if (mixedUnicodeMatch) {
    return parseInt(mixedUnicodeMatch[1], 10) + UNICODE_FRACTIONS[mixedUnicodeMatch[2]];
  }

  // Bare unicode fraction: "½"
  if (str.length === 1 && UNICODE_FRACTIONS[str] !== undefined) {
    return UNICODE_FRACTIONS[str];
  }

  // Simple fraction: "1/2"
  const fractionMatch = str.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) {
    const denom = parseInt(fractionMatch[2], 10);
    return denom === 0 ? null : parseInt(fractionMatch[1], 10) / denom;
  }

  // Mixed number: "1 1/2"
  const mixedMatch = str.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const denom = parseInt(mixedMatch[3], 10);
    if (denom === 0) return null;
    return parseInt(mixedMatch[1], 10) + parseInt(mixedMatch[2], 10) / denom;
  }

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}
