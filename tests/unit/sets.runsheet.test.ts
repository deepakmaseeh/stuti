import { describe, expect, it } from 'vitest';
import {
  autoSequence,
  buildRunSheet,
  buildSequenceLabel,
  buildSlides,
  normaliseLyricText,
  parseRepeatMarker,
} from '../../src/lib/sets/runsheet';
import type { RunSheetSong } from '../../src/lib/sets/runsheet';

const songA: RunSheetSong = {
  id: 'hi-a',
  title: { native: 'आराधना', roman: 'Aaradhna' },
  numbers: [{ book: 'TLBC', number: '12' }],
  lang: 'hi',
  sections: [
    {
      type: 'chorus',
      label: 'Chorus',
      lines: [{ n: 'कोरस लाइन' }],
    },
    {
      type: 'verse',
      label: 'Verse 1',
      lines: [{ n: 'पद एक' }, { n: 'पंक्ति दो (2)' }],
    },
    {
      type: 'verse',
      label: 'Verse 2',
      lines: [{ n: '- बुलेट लाइन' }],
    },
  ],
};

describe('autoSequence', () => {
  it('keeps leading chorus and repeats after each verse', () => {
    expect(autoSequence(songA)).toEqual(['c', 'v1', 'c', 'v2', 'c']);
  });

  it('returns only verses when there is no chorus', () => {
    expect(
      autoSequence({
        ...songA,
        sections: songA.sections.filter((s) => s.type === 'verse'),
      }),
    ).toEqual(['v1', 'v2']);
  });
});

describe('buildRunSheet', () => {
  it('nests songs under sections and skips empty ones', () => {
    const sheet = buildRunSheet(
      {
        title: 'Sunday Morning',
        date: '2026-11-22',
        time: '10:00',
        service: 'sunday_morning',
        rows: [
          { k: 'h', id: 'h1', label: 'Praise' },
          { k: 's', id: 's1', song: 'hi-a', book: 'TLBC', no: 12 },
          { k: 'h', id: 'h2', label: 'Empty' },
          { k: 'h', id: 'h3', label: 'Word' },
          {
            k: 'i',
            id: 'i1',
            type: 'sermon',
            title: 'Sermon',
            ref: 'Luke 2:8–14',
            minutes: 20,
          },
        ],
      },
      { 'hi-a': songA },
    );
    expect(sheet.map((s) => s.label)).toEqual(['Praise', 'Word']);
    expect(sheet[0]!.rows[0]!.n).toBe(1);
    expect(sheet[0]!.rows[0]!.seq).toEqual(['c', 'v1', 'c', 'v2', 'c']);
    expect(sheet[1]!.rows[0]!.n).toBe(2);
    expect(formatSeq(sheet[0]!.rows[0]!.seq!)).toContain('C');
  });
});

function formatSeq(seq: string[]) {
  return buildSequenceLabel(seq);
}

describe('buildSlides + normalise', () => {
  it('starts with welcome, includes section/item, repeats chorus, strips artefacts', () => {
    const sheet = buildRunSheet(
      {
        title: 'Sunday Morning',
        date: '2026-11-22',
        time: '10:00',
        service: 'sunday_morning',
        rows: [
          { k: 'h', id: 'h1', label: 'Praise' },
          { k: 's', id: 's1', song: 'hi-a', book: 'TLBC', no: 12 },
          {
            k: 'i',
            id: 'i1',
            type: 'sermon',
            title: 'Sermon',
            ref: 'Luke 2:8–14',
          },
        ],
      },
      { 'hi-a': songA },
    );
    const slides = buildSlides(sheet, {
      set: { title: 'Sunday Morning', date: '2026-11-22', service: 'sunday_morning', rows: [] },
      church: 'Grace Church',
    });
    expect(slides[0]).toMatchObject({ kind: 'title', title: 'Sunday Morning' });
    expect(slides.some((s) => s.kind === 'section' && s.label === 'Praise')).toBe(true);
    expect(slides.some((s) => s.kind === 'item' && s.title === 'Sermon')).toBe(true);
    const lyrics = slides.filter((s) => s.kind === 'lyrics');
    const chorusCount = lyrics.filter((s) => s.kind === 'lyrics' && s.tag.includes('CHORUS')).length;
    const verseCount = lyrics.filter((s) => s.kind === 'lyrics' && s.tag.includes('VERSE')).length;
    expect(chorusCount).toBe(verseCount + 1);
    const joined = lyrics.flatMap((s) => (s.kind === 'lyrics' ? s.lines.map((l) => l.t) : []));
    expect(joined.some((t) => t.includes('(2)'))).toBe(false);
    expect(joined.some((t) => t.startsWith('-'))).toBe(false);
    expect(joined).toContain('पंक्ति दो');
    expect(joined).toContain('बुलेट लाइन');
  });

  it('parseRepeatMarker and normaliseLyricText', () => {
    expect(parseRepeatMarker('hello (2)')).toEqual({ t: 'hello', x: 2 });
    expect(normaliseLyricText('- foo')).toBe('foo');
  });
});
