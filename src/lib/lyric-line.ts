/** Strip leading bullet artefacts used in some imports (C36). */
export function stripLeadingBullet(text: string): string {
  return text.replace(/^[-–—•]\s+/, '').trim();
}

/**
 * Split a lyric layer into text + optional repeat marker like (2) / ×2 → badge (C43).
 * Mid-line "(2)" is treated as end of the first phrase (caller may split joined lines).
 */
export function splitRepeatMarker(text: string): { text: string; times?: number } {
  let t = stripLeadingBullet(text);
  const trailing = t.match(/^(.*?)\s*(?:\((\d+)\)|[×x]\s*(\d+))\s*$/u);
  if (trailing) {
    const times = Number(trailing[2] || trailing[3]);
    if (Number.isInteger(times) && times >= 2 && times <= 99) {
      return { text: (trailing[1] ?? '').trimEnd(), times };
    }
  }
  return { text: t };
}

/** Detect joined lines that embed "(2)" before more sentence text (C36/C42). */
export function hasEmbeddedRepeat(text: string): boolean {
  return /\(\d+\)\s+\S/u.test(text);
}
