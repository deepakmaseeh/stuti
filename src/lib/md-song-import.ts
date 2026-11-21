/**
 * Parse CCF / Sunday-school markdown song books into stanza sections.
 * Used by scripts/import-md-books.ts and unit tests.
 */

export type SectionOut = {
  type: 'verse' | 'chorus' | 'bridge' | 'refrain' | 'other';
  label: string;
  lines: { n: string; r: string; e: string }[];
};

export type ParsedMdSong = {
  heading: string;
  number: string;
  category?: string;
  title: string;
  body: string;
  sections: SectionOut[];
};

const DEV_MAP: Record<string, string> = {
  '\u0905': 'a',
  '\u0906': 'aa',
  '\u0907': 'i',
  '\u0908': 'ee',
  '\u0909': 'u',
  '\u090A': 'oo',
  '\u090F': 'e',
  '\u0910': 'ai',
  '\u0913': 'o',
  '\u0914': 'au',
  '\u0915': 'k',
  '\u0916': 'kh',
  '\u0917': 'g',
  '\u0918': 'gh',
  '\u091A': 'ch',
  '\u091B': 'chh',
  '\u091C': 'j',
  '\u091D': 'jh',
  '\u091F': 't',
  '\u0920': 'th',
  '\u0921': 'd',
  '\u0922': 'dh',
  '\u0923': 'n',
  '\u0924': 't',
  '\u0925': 'th',
  '\u0926': 'd',
  '\u0927': 'dh',
  '\u0928': 'n',
  '\u092A': 'p',
  '\u092B': 'ph',
  '\u092C': 'b',
  '\u092D': 'bh',
  '\u092E': 'm',
  '\u092F': 'y',
  '\u0930': 'r',
  '\u0932': 'l',
  '\u0935': 'v',
  '\u0936': 'sh',
  '\u0937': 'sh',
  '\u0938': 's',
  '\u0939': 'h',
  '\u093E': 'a',
  '\u093F': 'i',
  '\u0940': 'ee',
  '\u0941': 'u',
  '\u0942': 'oo',
  '\u0947': 'e',
  '\u0948': 'ai',
  '\u094B': 'o',
  '\u094C': 'au',
  '\u0902': 'n',
  '\u0903': 'h',
  '\u0901': 'n',
  '\u094D': '',
  '\u090B': 'ri',
};

/** Rough Devanagari → roman slug helper (good enough for URLs). */
export function romanizeDevanagari(text: string): string {
  let out = '';
  for (const ch of text) {
    if (DEV_MAP[ch] !== undefined) out += DEV_MAP[ch];
    else if (/[A-Za-z0-9]/.test(ch)) out += ch.toLowerCase();
    else if (/\s/.test(ch) || /[·.|…,;:!?'"“”‘’॥\|-]/.test(ch)) out += '-';
  }
  return out;
}

export function slugifyTitle(title: string): string {
  const base = /[\u0900-\u097F]/.test(title) ? romanizeDevanagari(title) : title;
  return base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\u0964\u0965]/g, '')
    .replace(/[^\u0900-\u097Fa-z0-9]+/g, '')
    .slice(0, 48);
}

function cleanLine(raw: string): string {
  return raw
    .replace(/^\s*\d+[\.\)]\s*/, '')
    .replace(/^(कोरस|chorus)\s*[:-]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isChorusLabel(line: string): boolean {
  return /^(कोरस|chorus)\b/i.test(line.trim()) || /कोरस\s*[:-]/.test(line);
}

/** Split lyric body into verse/chorus sections using blank-line gaps and markers. */
export function blocksToSections(body: string): SectionOut[] {
  const rawBlocks = body
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const sections: SectionOut[] = [];
  let verseN = 0;
  let chorusN = 0;

  for (const block of rawBlocks) {
    const lines = block
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) continue;

    const joined = lines.join('\n');
    const numbered = lines.every((l) => /^\d+[\.\)]\s*\S/.test(l)) || /^\d+[\.\)]\s*\S/.test(lines[0]!);

    if (numbered) {
      // One block may contain multiple numbered verses
      let current: string[] = [];
      let currentIsChorus = false;
      const flush = () => {
        const cleaned = current.map(cleanLine).filter(Boolean);
        if (!cleaned.length) return;
        if (currentIsChorus) {
          chorusN += 1;
          sections.push({
            type: 'chorus',
            label: chorusN === 1 ? 'Chorus' : `Chorus ${chorusN}`,
            lines: cleaned.map((n) => ({ n, r: '', e: '' })),
          });
        } else {
          verseN += 1;
          sections.push({
            type: 'verse',
            label: `Verse ${verseN}`,
            lines: cleaned.map((n) => ({ n, r: '', e: '' })),
          });
        }
        current = [];
        currentIsChorus = false;
      };
      for (const line of lines) {
        if (/^\d+[\.\)]\s*/.test(line) && current.length) flush();
        if (isChorusLabel(line)) currentIsChorus = true;
        current.push(line);
      }
      flush();
      continue;
    }

    const chorusish =
      lines.some(isChorusLabel) ||
      (lines.length <= 4 && /हालेलुयाह|hallelujah|कोरस/i.test(joined) && rawBlocks.length > 1);

    const cleaned = lines.map(cleanLine).filter(Boolean);
    if (!cleaned.length) continue;

    if (chorusish) {
      chorusN += 1;
      sections.push({
        type: 'chorus',
        label: chorusN === 1 ? 'Chorus' : `Chorus ${chorusN}`,
        lines: cleaned.map((n) => ({ n, r: '', e: '' })),
      });
    } else {
      verseN += 1;
      sections.push({
        type: 'verse',
        label: `Verse ${verseN}`,
        lines: cleaned.map((n) => ({ n, r: '', e: '' })),
      });
    }
  }

  if (!sections.length) {
    const lines = body
      .split(/\n/)
      .map((l) => cleanLine(l))
      .filter(Boolean);
    if (lines.length) {
      sections.push({
        type: 'verse',
        label: 'Verse 1',
        lines: lines.map((n) => ({ n, r: '', e: '' })),
      });
    }
  }
  return sections;
}

export function firstLyricLine(body: string): string {
  for (const line of body.split(/\n/)) {
    const t = line.trim();
    if (!t) continue;
    if (/^---+$/.test(t)) continue;
    return cleanLine(t).replace(/[…|]+$/g, '').trim();
  }
  return '';
}

export function parseCcfMarkdown(md: string): ParsedMdSong[] {
  const parts = md.split(/^##\s+/m).slice(1);
  const out: ParsedMdSong[] = [];
  for (const part of parts) {
    const m = part.match(/^(स्तुति|आराधना|समर्पण)\s+गायन\s+नं\s+(\d+)\s*\n([\s\S]*)$/);
    if (!m) continue;
    const category = m[1]!;
    const number = m[2]!;
    let body = m[3]!.replace(/\n---\s*$/m, '').trim();
    // Skip known weak bilingual/garbled entries unless they have solid Hindi
    const hiChars = [...body].filter((c) => c >= '\u0900' && c <= '\u097F').length;
    if (hiChars < 40 && /power|jesus|victory/i.test(body)) continue;
    const title = firstLyricLine(body);
    if (!title || title.length < 2) continue;
    const sections = blocksToSections(body);
    if (!sections.length) continue;
    out.push({
      heading: `${category} गायन नं ${number}`,
      number,
      category,
      title: title.slice(0, 120),
      body,
      sections,
    });
  }
  return out;
}

export function parseSundaySchoolMarkdown(md: string): ParsedMdSong[] {
  const parts = md.split(/^##\s+Song\s+/m).slice(1);
  const out: ParsedMdSong[] = [];
  for (const part of parts) {
    const head = part.split(/\n/)[0] ?? '';
    const m = head.match(/^(\d+):\s*(.+)\s*$/);
    if (!m) continue;
    const number = m[1]!;
    const title = m[2]!.trim();
    if (/regional|telugu/i.test(title)) continue;
    let body = part
      .split(/\n/)
      .slice(1)
      .join('\n')
      .replace(/\n---\s*$/m, '')
      .trim();
    const latin = [...body].filter((c) => /[A-Za-z]/.test(c)).length;
    if (latin < 40) continue;
    const sections = blocksToSections(body);
    if (!sections.length) continue;
    out.push({
      heading: `Song ${number}`,
      number,
      title: title.replace(/,$/, '').slice(0, 120),
      body,
      sections,
    });
  }
  return out;
}

export const CHRISTMAS_RE =
  /christmas|bethlehem|bethelaham|baitalaham|bethalham|janma|sitara|dhany.?raat|charani|taaranhara|farisht|gausale|बैतलहम|धन्य रात|चरनी|जन्मा|सितारा|फ़रिश्त|फरिश्त|ताराण|तारणहारा|मसीह दुनिया/i;

export function isChristmasTitle(title: string, slug = ''): boolean {
  return CHRISTMAS_RE.test(`${title} ${slug}`);
}

export function lineCount(sections: SectionOut[]): number {
  return sections.reduce((n, s) => n + s.lines.length, 0);
}
