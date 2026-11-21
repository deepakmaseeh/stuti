/**
 * Single source for Order of Service, Present, and PPT slide order.
 * @see STUTI_UI_CORRECTIONS_v1.4.md §4
 */
import type { BridgedWorshipSet, ItemRow, SetRow, SongRow, WorshipSetV21 } from './schema';

export type RunSheetSong = {
  id: string;
  title: { native: string; roman?: string; en?: string };
  numbers: Array<{ book: string; number: string }>;
  lang?: string;
  script?: string;
  sections: Array<{
    id?: string;
    type: string;
    label: string;
    lines: Array<{ n: string; r?: string; e?: string; x?: number }>;
  }>;
  minutes?: number;
};

export type RunSheetSet = Pick<WorshipSetV21, 'title' | 'date' | 'time' | 'service' | 'leader' | 'preacher' | 'notes' | 'rows'> & {
  id?: string;
  church?: string;
};

export type RunSheetEntry = (SongRow | ItemRow) & {
  n: number;
  at: number;
  song: RunSheetSong | null;
  seq: string[] | null;
};

export type RunSheetSection = {
  label: string;
  start: number;
  end: number;
  rows: RunSheetEntry[];
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function formatClock(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Strip leading bullet artefacts and normalise whitespace for display/export (C36). */
export function normaliseLyricText(t: string): string {
  return t
    .replace(/^[-–—•]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse trailing/embedded "(2)" / "×2" into repeat count; strip from text. */
export function parseRepeatMarker(raw: string): { t: string; x: number } {
  let x = 1;
  let t = normaliseLyricText(raw);
  const m = t.match(/^(.*?)(?:\s*[×x]\s*(\d+)\s*|\s*\((\d+)\)\s*)(.*)$/u);
  if (m) {
    const n = Number(m[2] || m[3] || 1);
    if (n > 1) x = n;
    t = `${m[1] ?? ''}${m[4] ?? ''}`.replace(/\s+/g, ' ').trim();
  }
  return { t, x };
}

function stanzaId(sec: RunSheetSong['sections'][number], index: number): string {
  if (sec.id) return sec.id;
  if (sec.type === 'chorus' || sec.type === 'refrain') return 'c';
  if (sec.type === 'verse') {
    const m = sec.label.match(/(\d+)/);
    return m ? `v${m[1]}` : `v${index + 1}`;
  }
  if (sec.type === 'bridge') return `b${index + 1}`;
  return `s${index + 1}`;
}

/** Chorus after each verse; leading chorus kept if the hymn opens with it. */
export function autoSequence(song: RunSheetSong | null | undefined): string[] {
  if (!song?.sections?.length) return [];
  const indexed = song.sections.map((s, i) => ({ ...s, _id: stanzaId(s, i), _i: i }));
  const verses = indexed.filter((s) => s.type === 'verse');
  const chorus = indexed.find((s) => s.type === 'chorus' || s.type === 'refrain');
  if (!chorus) return verses.map((v) => v._id);
  const lead = indexed[0] && (indexed[0].type === 'chorus' || indexed[0].type === 'refrain') ? [chorus._id] : [];
  return [...lead, ...verses.flatMap((v) => [v._id, chorus._id])];
}

export function buildSequenceLabel(seq: string[]): string {
  return seq
    .map((id) => {
      if (id === 'c') return 'C';
      if (/^v\d+$/i.test(id)) return `V${id.slice(1)}`;
      if (/^b\d+$/i.test(id)) return `B${id.slice(1)}`;
      return id.toUpperCase();
    })
    .join(' · ');
}

export function buildRunSheet(
  set: RunSheetSet | BridgedWorshipSet | WorshipSetV21,
  songsById: Record<string, RunSheetSong | undefined>,
): RunSheetSection[] {
  let t = toMinutes(set.time ?? '10:00');
  let n = 0;
  let section: RunSheetSection | null = null;
  const out: RunSheetSection[] = [];
  const rows: SetRow[] = 'rows' in set && Array.isArray(set.rows) ? set.rows : [];

  for (const r of rows) {
    if (r.k === 'h') {
      section = { label: r.label, start: t, end: t, rows: [] };
      out.push(section);
      continue;
    }
    if (!section) {
      section = { label: '', start: t, end: t, rows: [] };
      out.push(section);
    }
    const song = r.k === 's' ? (songsById[r.song] ?? null) : null;
    const seq = r.k === 's' ? (r.seq ?? autoSequence(song)) : null;
    section.rows.push({
      ...r,
      n: ++n,
      at: t,
      song,
      seq,
    });
    t += r.minutes ?? (r.k === 's' ? (song?.minutes ?? 5) : 3);
    section.end = t;
  }

  return out.filter((s) => s.rows.length > 0);
}

export type SlideLine = { t: string; x: number; r?: string };

export type BuiltSlide =
  | { kind: 'title'; title: string; sub: string }
  | { kind: 'section'; label: string }
  | { kind: 'item'; title: string; sub: string; type: string }
  | {
      kind: 'lyrics';
      book: string;
      no: string;
      tag: string;
      lines: SlideLine[];
      roman?: string[];
      script: string;
      next: string;
      songId: string;
    };

const MAX_LINES = 4;

function chunkLines<T>(lines: T[], size = MAX_LINES): T[][] {
  if (!lines.length) return [[]];
  const out: T[][] = [];
  for (let i = 0; i < lines.length; i += size) out.push(lines.slice(i, i + size));
  return out;
}

function findStanza(song: RunSheetSong, id: string) {
  const idx = song.sections.findIndex((s, i) => stanzaId(s, i) === id);
  if (idx >= 0) return song.sections[idx]!;
  if (id === 'c') return song.sections.find((s) => s.type === 'chorus' || s.type === 'refrain');
  const vm = id.match(/^v(\d+)$/i);
  if (vm) {
    const verses = song.sections.filter((s) => s.type === 'verse');
    return verses[Number(vm[1]) - 1];
  }
  return undefined;
}

function hymnNo(row: SongRow, song: RunSheetSong | null): { book: string; no: string } {
  const book = row.book;
  if (row.no != null) return { book, no: String(row.no) };
  const hit = song?.numbers.find((n) => n.book.toUpperCase() === book.toUpperCase()) ?? song?.numbers[0];
  return { book: hit?.book ?? book, no: hit?.number ?? '' };
}

function nextLabel(entries: Array<{ kind: string; label: string }>, i: number): string {
  const n = entries[i + 1];
  return n ? n.label : 'End';
}

/** Flatten run sheet into Present/PPT slides (welcome → sections → items/lyrics). */
export function buildSlides(
  sheet: RunSheetSection[],
  opts: {
    set: RunSheetSet;
    church?: string;
    layers?: { n?: boolean; r?: boolean; e?: boolean };
  },
): BuiltSlide[] {
  const layers = { n: true, r: false, e: false, ...opts.layers };
  const slides: BuiltSlide[] = [];
  const dateLabel = opts.set.date;
  const church = opts.church ?? opts.set.church ?? '';

  slides.push({
    kind: 'title',
    title: opts.set.title,
    sub: [church, dateLabel, opts.set.time].filter(Boolean).join(' · '),
  });

  type Flat = { kind: string; label: string; section?: RunSheetSection; entry?: RunSheetEntry; seqId?: string };
  const flat: Flat[] = [];
  for (const sec of sheet) {
    if (sec.label) flat.push({ kind: 'section', label: sec.label, section: sec });
    for (const entry of sec.rows) {
      if (entry.k === 'i') {
        flat.push({
          kind: 'item',
          label: `${entry.title}${entry.ref ? ` · ${entry.ref}` : ''}`,
          entry,
        });
      } else if (entry.k === 's') {
        const seq = entry.seq ?? [];
        for (const sid of seq) {
          flat.push({
            kind: 'lyrics',
            label: `Song ${entry.n} · ${entry.song?.title.native ?? entry.song}`,
            entry,
            seqId: sid,
          });
        }
      }
    }
  }

  let fi = 0;
  for (const sec of sheet) {
    if (sec.label) {
      slides.push({ kind: 'section', label: sec.label });
      fi++;
    }
    for (const entry of sec.rows) {
      if (entry.k === 'i') {
        slides.push({
          kind: 'item',
          title: entry.title,
          sub: [entry.ref, entry.by].filter(Boolean).join(' · '),
          type: entry.type,
        });
        fi++;
        continue;
      }
      if (entry.k !== 's' || !entry.song) {
        fi++;
        continue;
      }
      const song = entry.song;
      const { book, no } = hymnNo(entry, song);
      const seq = entry.seq ?? autoSequence(song);
      for (let si = 0; si < seq.length; si++) {
        const sid = seq[si]!;
        const stanza = findStanza(song, sid);
        const tag = (stanza?.label ?? (sid === 'c' ? 'Chorus' : sid)).toUpperCase();
        const rawLines = stanza?.lines ?? [];
        const parsed: SlideLine[] = rawLines.map((ln) => {
          const { t, x } = parseRepeatMarker(ln.n);
          return {
            t,
            x: ln.x && ln.x > 1 ? ln.x : x,
            ...(layers.r && ln.r ? { r: ln.r } : {}),
          };
        }).filter((l) => l.t);

        const chunks = chunkLines(parsed, MAX_LINES);
        for (let ci = 0; ci < chunks.length; ci++) {
          const chunk = chunks[ci]!;
          const roman =
            layers.r
              ? chunk.map((l) => l.r).filter((x): x is string => !!x)
              : undefined;
          slides.push({
            kind: 'lyrics',
            book,
            no,
            tag: chunks.length > 1 ? `${tag} (${ci + 1}/${chunks.length})` : tag,
            lines: chunk.map(({ t, x }) => ({ t, x })),
            ...(roman?.length ? { roman } : {}),
            script: song.lang ?? song.script ?? 'hi',
            next: nextLabel(flat, fi),
            songId: song.id,
          });
        }
        fi++;
      }
    }
  }

  return slides;
}

export function fitSize(lines: Array<{ t: string }>): number {
  const L = Math.max(1, ...lines.map((l) => l.t.length));
  const n = Math.max(1, lines.length);
  return Math.max(24, Math.min(44, Math.floor(Math.min(1100 / L, 260 / n))));
}

export function slugTitle(s: string): string {
  return (
    s
      .normalize('NFKD')
      .replace(/[^\w\s-]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 48) || 'Set'
  );
}
