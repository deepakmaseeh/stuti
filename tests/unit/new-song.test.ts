import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDraft, planNewSong, slugify, type DraftInput } from '../../scripts/new-song';

const BASE = join(__dirname, '..', 'fixtures', 'base');
const input: DraftInput = {
  lang: 'ta',
  book: 'TB',
  number: '99',
  native: 'புதிய பாடல்',
  roman: 'Puthiya Paadal',
  lines: ['இயேசுவே என் துணை', 'இருளில் என் ஒளி'],
  today: '2026-11-19',
};

describe('new-song scaffold', () => {
  it('slugify keeps Latin letters and digits only', () => {
    expect(slugify('Yesuve En Thunai!')).toBe('yesuve-en-thunai');
    expect(slugify('  Amazing   Grace (No. 2) ')).toBe('amazing-grace-no-2');
    expect(slugify('Prabhū Yeśu')).toBe('prabhu-yesu');
    expect(slugify('இயேசுவே')).toBe('');
    expect(slugify('a'.repeat(100)).length).toBe(80);
  });

  it('builds an unpublished draft with the lines in one verse', () => {
    const d = buildDraft(input);
    expect(d.slug).toBe('puthiya-paadal');
    expect(d.publish).toBe(false);
    expect(d.rights.status).toBe('permission_pending');
    expect(d.sections[0]!.lines).toEqual([{ n: 'இயேசுவே என் துணை' }, { n: 'இருளில் என் ஒளி' }]);
  });

  it('the draft passes validation next to existing content', () => {
    const plan = planNewSong(input, BASE, false);
    expect(plan.relPath).toBe('ta/puthiya-paadal.json');
    expect(plan.errors).toEqual([]);
  });

  it('reports a number that is already taken in that book', () => {
    const plan = planNewSong({ ...input, number: '1' }, BASE, false);
    expect(plan.errors.map((e) => e.rule)).toContain('4-numbers');
  });

  it('reports an existing file, a missing URL name, and lines in the wrong script', () => {
    expect(planNewSong({ ...input, slug: 'nalla-paadal' }, BASE, false).errors.map((e) => e.rule)).toContain(
      'exists',
    );
    expect(planNewSong({ ...input, roman: '' }, BASE, false).errors.map((e) => e.rule)).toContain('slug');
    expect(
      planNewSong({ ...input, lines: ['Yesuve en thunai'] }, BASE, false).errors.map((e) => e.rule),
    ).toContain('5-script');
  });
});
