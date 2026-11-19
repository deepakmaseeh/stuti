import { describe, expect, it } from 'vitest';
import { normalizeText, normalizeToken } from '../../src/lib/normalize';

describe('normalizeToken', () => {
  it('yeshu / yesu / yisu → yesu', () => {
    expect(normalizeToken('yeshu')).toBe('yesu');
    expect(normalizeToken('yesu')).toBe('yesu');
    expect(normalizeToken('yisu')).toBe('yesu');
  });

  it('Thunai / tunai → tunai', () => {
    expect(normalizeToken('Thunai')).toBe('tunai');
    expect(normalizeToken('tunai')).toBe('tunai');
  });

  it('aadhaaram / adharam → adaram', () => {
    expect(normalizeToken('aadhaaram')).toBe('adaram');
    expect(normalizeToken('adharam')).toBe('adaram');
  });

  it('neere → nire; ā → a', () => {
    expect(normalizeToken('neere')).toBe('nire');
    expect(normalizeToken('ā')).toBe('a');
  });

  it('collapses doubles', () => {
    expect(normalizeToken('labbhe')).toBe('labe');
    expect(normalizeToken('pattaavu')).toBe('patavu');
  });

  it('leaves Tamil/Telugu tokens unchanged except NFC and zero-width removal', () => {
    expect(normalizeToken('துணை')).toBe('துணை');
    expect(normalizeToken('వెలుగు')).toBe('వెలుగు');
    expect(normalizeToken('ந\u200Cல்ல')).toBe('நல்ல');
    // Decomposed Tamil "ொ" (U+0BC6 U+0BBE) composes to U+0BCA under NFC.
    expect(normalizeToken('கொ'.normalize('NFD'))).toBe('கொ'.normalize('NFC'));
  });

  it('returns empty for empty or punctuation-only input', () => {
    expect(normalizeToken('')).toBe('');
    expect(normalizeToken('—')).toBe('');
  });
});

describe('normalizeText', () => {
  it('splits on spaces and punctuation and drops empties', () => {
    expect(normalizeText('Yeshu, mera  sahara!')).toEqual(['yesu', 'mera', 'sahara']);
  });
});
