/**
 * Multi-token song add parser (C18).
 * "12, 46, 103" → defaultBook + numbers; "TLBC 12, SS 5" → book+no; newlines OK.
 */
export type ParseAddHit = { book: string; no: number; raw: string };
export type ParseAddMiss = { raw: string; error: 'format' };
export type ParseAddToken = ParseAddHit | ParseAddMiss;

export function isParseAddHit(t: ParseAddToken): t is ParseAddHit {
  return !('error' in t);
}

/**
 * Normalise book+space+number ("TLBC 12" → "TLBC12"), then split on whitespace/commas/semicolons.
 */
export function parseAdd(input: string, defaultBook: string): ParseAddToken[] {
  const book = (defaultBook || 'TLBC').toUpperCase();
  return input
    .replace(/([A-Za-z]{1,5})\s+(?=\d)/g, '$1')
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((tok) => {
      const m = tok.match(/^([A-Za-z]{1,5})?(\d{1,4})$/);
      if (!m) return { raw: tok, error: 'format' as const };
      return {
        book: (m[1] ?? book).toUpperCase(),
        no: Number(m[2]),
        raw: tok,
      };
    });
}
