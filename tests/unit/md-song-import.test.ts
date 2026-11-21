import { describe, expect, it } from 'vitest';
import {
  blocksToSections,
  normalizeForMatch,
  parseCcfMarkdown,
  parseSundaySchoolMarkdown,
  slugifyTitle,
} from '../../src/lib/md-song-import';

describe('blocksToSections', () => {
  it('splits blank-line gaps into verses', () => {
    const sections = blocksToSections('line a\nline b\n\nline c\nline d');
    expect(sections).toHaveLength(2);
    expect(sections[0]?.type).toBe('verse');
    expect(sections[1]?.lines[0]?.n).toBe('line c');
  });

  it('marks chorus blocks', () => {
    const sections = blocksToSections('कोरस:- आओ सब\nगाओ\n\n1. पद एक\nऔर');
    expect(sections.some((s) => s.type === 'chorus')).toBe(true);
  });
});

describe('parse markdown books', () => {
  it('parses a CCF song heading', () => {
    const md = `## स्तुति गायन नं 1\n\nकरते है तेरी हम स्तुति\n\nपद दो यहाँ\n`;
    const songs = parseCcfMarkdown(md);
    expect(songs).toHaveLength(1);
    expect(songs[0]?.title).toContain('करते');
    expect(songs[0]?.sections.length).toBeGreaterThanOrEqual(1);
  });

  it('skips regional sunday-school songs', () => {
    const md = `## Song 19: Regional / Telugu Song\n\nsome text here that is long enough abcdefghijklmnopqrstuvwxyz\n\n## Song 1: Hosanna in the highest\n\n1. Hosanna Hosanna Hosanna in the highest Lord we lift\n`;
    const songs = parseSundaySchoolMarkdown(md);
    expect(songs.every((s) => !/Regional/i.test(s.title))).toBe(true);
    expect(songs.some((s) => /Hosanna/i.test(s.title))).toBe(true);
  });
});

describe('slug helpers', () => {
  it('slugifies english titles', () => {
    expect(slugifyTitle('Father Abraham has many sons')).toBe('father-abraham-has-many-sons');
  });

  it('normalizes for match', () => {
    expect(normalizeForMatch('जय!! येशु')).toBe(normalizeForMatch('जय येशु'));
  });
});
