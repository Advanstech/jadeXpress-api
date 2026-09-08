/**
 * Normalize a name to Title Case, preserving common acronyms and units.
 *
 * Examples:
 *   "ernest chemist limited" → "Ernest Chemist Limited"
 *   "PARACETAMOL 500MG TABLETS" → "Paracetamol 500mg Tablets"
 *   "amoxicillin capsule" → "Amoxicillin Capsule"
 *   "iv fluid ors" → "IV Fluid ORS"
 */
const ACRONYMS = new Set([
  'iv', 'im', 'sc', 'ors', 'iu', 'otc', 'rx', 'sis', 'tin', 'gra',
  'sms', 'ghc', 'ceo', 'cfo', 'coo', 'ltd', 'inc', 'llc', 'plc',
  'ghana', 'usa', 'uk', 'eu',
]);

const UNITS_LOWER = new Set([
  'mg', 'ml', 'kg', 'g', 'l', 'mcg', 'iu', 'meq', 'mmol',
]);

export function titleCase(input: string | undefined | null): string {
  if (!input) return '';
  const trimmed = input.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';

  return trimmed
    .split(' ')
    .map((word) => {
      const lower = word.toLowerCase();

      // Keep acronyms uppercase
      if (ACRONYMS.has(lower)) return lower.toUpperCase();

      // Keep dosage units lowercase (500MG → 500mg)
      if (UNITS_LOWER.has(lower)) return lower;

      // If word is purely numeric or starts with a number (e.g. "500mg", "10ml"), lowercase the unit part
      if (/^\d/.test(word)) {
        return word.toLowerCase().replace(/\b(\d+)([a-z]+)\b/gi, (_, num, unit) =>
          UNITS_LOWER.has(unit.toLowerCase()) ? `${num}${unit.toLowerCase()}` : `${num}${unit}`,
        );
      }

      // Standard Title Case: capitalize first letter
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/**
 * Normalize a name for deduplication comparison.
 * Lowercases, removes special characters, collapses spaces.
 */
export function normalizeForCompare(input: string | undefined | null): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}
