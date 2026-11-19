import { describe, expect, it } from 'vitest';
import { SongSchema } from '../../src/lib/schema';

// Guards against the Zod 4 change where `.default({})` stops filling nested defaults (docs/adr/0002).
describe('song schema defaults', () => {
  it('fills nested defaults when display/layers/author/source/media are missing', () => {
    const song = SongSchema.parse({
      numbers: [{ book: 'EH', number: '1' }],
      title: { native: 'Hymn' },
      sections: [{ type: 'verse', label: 'Verse 1', lines: [{ n: 'Line' }] }],
      rights: { status: 'public_domain' },
      updated: '2026-11-19',
    });
    expect(song.display.chorusAfterEachVerse).toBe(false);
    expect(song.layers.roman).toBe('missing');
    expect(song.layers.en).toBe('missing');
    expect(song.author.name).toBe('Unknown');
    expect(song.author.died).toBeNull();
    expect(song.source.page).toBeNull();
    expect(song.media.youtube).toBeNull();
    expect(song.publish).toBe(false);
    expect(song.sections[0]!.lines[0]).toEqual({ n: 'Line', r: '', e: '' });
  });
});
