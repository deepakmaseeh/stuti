import type { Section } from './schema';

/** Show "↻ Chorus" after a verse only when the next section is not already the chorus. */
export function shouldShowChorusMarker(
  sections: Section[],
  index: number,
  chorusAfterEachVerse: boolean,
): boolean {
  if (!chorusAfterEachVerse) return false;
  const section = sections[index];
  if (!section || section.type !== 'verse') return false;
  const hasChorus = sections.some((s) => s.type === 'chorus' || s.type === 'refrain');
  if (!hasChorus) return false;
  const next = sections[index + 1];
  if (next && (next.type === 'chorus' || next.type === 'refrain')) return false;
  return true;
}
