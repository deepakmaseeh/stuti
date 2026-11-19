import { describe, expect, it } from 'vitest';
import type { BookBundleSong } from '../../src/lib/book-bundle';
import { expandSections } from '../../src/lib/pptx-export';

const song: BookBundleSong = {
  t: ['Title', 'Roman', 'English'],
  nums: [['DT', '1']],
  lang: 'ta',
  chorusAfterEachVerse: true,
  sec: [
    { type: 'verse', label: 'Verse 1', lines: [['v1n', 'v1r', 'v1e']] },
    { type: 'chorus', label: 'Chorus', lines: [['cn', 'cr', 'ce']] },
    { type: 'verse', label: 'Verse 2', lines: [['v2n', 'v2r', 'v2e']] },
  ],
};

describe('expandSections', () => {
  it('repeats the chorus after every verse when chorusAfterEachVerse is true', () => {
    const labels = expandSections(song).map((s) => s.label);
    expect(labels).toEqual(['Verse 1', 'Chorus', 'Chorus', 'Verse 2', 'Chorus']);
  });

  it('does not repeat when the flag is false', () => {
    const labels = expandSections({ ...song, chorusAfterEachVerse: false }).map((s) => s.label);
    expect(labels).toEqual(['Verse 1', 'Chorus', 'Verse 2']);
  });
});
