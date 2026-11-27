export type SplitLine = { n: string; x?: number };
export type SplitStanza = {
  type: 'verse' | 'chorus' | 'refrain' | 'bridge' | 'other';
  label: string;
  lines: SplitLine[];
};

const HEADING_CHORUS_RE = /^(कोरस|chorus|refrain|टेक)$/i;
const VERSE_PREFIX_RE = /^\d+[.)]\s*/;
const REPEAT_SUFFIX_RE = /\s*(?:\((?:x|×)?\s*2\)|×\s*2|x2)$/i;
const BULLET_PREFIX_RE = /^[-–•]\s*/;

/**
 * Split pasted song text into stanzas and lines (STUTI_SONGS_COMPLETE_SPEC.md §27.3).
 * Blank lines separate stanzas; "कोरस/Chorus/Refrain/टेक" becomes Chorus;
 * "(2)" / "×2" / "x2" becomes { x: 2 }; leading "- " and space before comma are cleaned.
 */
export function splitPastedSong(text: string): SplitStanza[] {
  const blocks = text
    .trim()
    .split(/\n\s*\n/)
    .map((b) =>
      b
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    )
    .filter((b) => b.length > 0);

  const out: SplitStanza[] = [];
  let verseNo = 0;

  for (const block of blocks) {
    let lines = [...block];
    // Skip leading single-line number + title header (e.g. "46 चमका सितारा देखो")
    if (out.length === 0 && lines.length === 1 && /^\d+\s+\S/.test(lines[0]!)) {
      continue;
    }

    let type: SplitStanza['type'] = 'verse';
    let label = '';
    const first = lines[0]!;

    if (HEADING_CHORUS_RE.test(first)) {
      type = 'chorus';
      label = 'Chorus';
      lines = lines.slice(1);
    } else if (VERSE_PREFIX_RE.test(first)) {
      verseNo += 1;
      type = 'verse';
      label = `Verse ${verseNo}`;
      lines[0] = first.replace(VERSE_PREFIX_RE, '');
    } else {
      verseNo += 1;
      type = 'verse';
      label = `Verse ${verseNo}`;
    }

    const parsedLines: SplitLine[] = lines
      .map((raw) => {
        const hasRepeat = REPEAT_SUFFIX_RE.test(raw);
        const cleaned = raw
          .replace(BULLET_PREFIX_RE, '')
          .replace(REPEAT_SUFFIX_RE, '')
          .replace(/\s+,/g, ',')
          .trim();
        return hasRepeat ? { n: cleaned, x: 2 } : { n: cleaned };
      })
      .filter((l) => l.n.length > 0);

    if (parsedLines.length > 0) {
      out.push({ type, label, lines: parsedLines });
    }
  }

  return out;
}
