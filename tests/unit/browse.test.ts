import { describe, expect, it } from 'vitest';
import { buildBrowseIndex, firstGrapheme, titleCaseTopic } from '../../src/lib/browse';
import { SongSchema, type Song } from '../../src/lib/schema';

function makeSong(id: string, lang: 'ta' | 'hi', native: string, tags: string[]): Song {
  const data = SongSchema.parse({
    title: { native, roman: 'X', en: 'X' },
    numbers: [{ book: 'DT', number: '1' }],
    sections: [{ type: 'verse', label: '1', lines: [{ n: native, r: 'x', e: 'x' }] }],
    tags,
    rights: { status: 'demo' },
    updated: '2026-01-01',
    publish: true,
  });
  return { ...data, id, lang };
}

describe('firstGrapheme', () => {
  it('returns a non-empty first cluster for Indic and Latin titles', () => {
    expect(firstGrapheme('இயேசுவே', 'ta').length).toBeGreaterThanOrEqual(1);
    expect(firstGrapheme('यीशु', 'hi').length).toBeGreaterThanOrEqual(1);
    expect(firstGrapheme('Amazing', 'en')).toBe('A');
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
    expect(idx.letters.length).toBe(2);
    expect(Object.values(idx.byLetter).flat().sort()).toEqual(['ta-a', 'ta-i']);
  });
});
