import { describe, expect, it } from 'vitest';
import { buildBrowseIndex, firstGrapheme, titleCaseTopic } from '../../src/lib/browse';
import { SongSchema, type Song } from '../../src/lib/schema';

function makeSong(id: string, lang: 'ta' | 'hi', native: string, tags: string[]): Song {
  const data = SongSchema.parse({
    title: { native, roman: 'X', en: 'X' },
    numbers: [{ book: 'TLBC', number: '1' }],
    sections: [{ type: 'verse', label: '1', lines: [{ n: native, r: 'x', e: 'x' }] }],
    tags,
    rights: { status: 'licensed' },
    updated: '2026-01-01',
    publish: true,
  });
  return { ...data, id, lang };
}

describe('firstGrapheme', () => {
  it('returns the base letter only (no matras) for Indic and Latin titles', () => {
    expect(firstGrapheme('இயேசுவே')).toBe('இ');
    expect(firstGrapheme('यीशु')).toBe('य');
    expect(firstGrapheme('प्रेम')).toBe('प');
    expect(firstGrapheme('आराधना')).toBe('आ');
    expect(firstGrapheme('Amazing')).toBe('A');
  });
});

describe('titleCaseTopic', () => {
  it('title-cases tags', () => {
    expect(titleCaseTopic('comfort')).toBe('Comfort');
    expect(titleCaseTopic('  GUIDANCE ')).toBe('Guidance');
  });
});

describe('buildBrowseIndex', () => {
  it('groups by letter and topic', () => {
    const songs = [
      makeSong('ta-a', 'ta', 'அன்பே', ['comfort']),
      makeSong('ta-i', 'ta', 'இயேசு', ['comfort', 'guidance']),
    ];
    const idx = buildBrowseIndex(songs, 'ta');
    expect(idx.topics).toEqual(['Comfort', 'Guidance']);
    expect(idx.byTopic.Comfort).toEqual(['ta-a', 'ta-i']);
    expect(idx.letters).toEqual(['அ', 'இ']);
    expect(Object.values(idx.byLetter).flat().sort()).toEqual(['ta-a', 'ta-i']);
  });

  it('buckets Hindi titles that share a base letter despite different matras', () => {
    const songs = [
      makeSong('hi-yi', 'hi', 'यीशु मेरा', ['praise']),
      makeSong('hi-ye', 'hi', 'येसु नाम', ['praise']),
      makeSong('hi-pr', 'hi', 'प्रेम से', ['love']),
    ];
    const idx = buildBrowseIndex(songs, 'hi');
    expect(idx.letters).toEqual(['प', 'य']);
    expect(idx.byLetter['य']!.sort()).toEqual(['hi-ye', 'hi-yi']);
    expect(idx.byLetter['प']).toEqual(['hi-pr']);
  });
});
