/** Split a lyric layer into text + optional trailing repeat marker like (2) → ×2. */
export function splitRepeatMarker(text: string): { text: string; times?: number } {
  const m = text.match(/^(.*?)\s*\((\d+)\)\s*$/u);
  if (!m) return { text };
  const times = Number(m[2]);
  if (!Number.isInteger(times) || times < 2 || times > 99) return { text };
  return { text: (m[1] ?? '').trimEnd(), times };
}
