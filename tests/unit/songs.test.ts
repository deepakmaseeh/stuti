import { describe, expect, it } from 'vitest';
import { songIdFromPath } from '../../src/lib/schema';
import { firstLine, isPublishable, langOf, numberUrl, primaryNumber, songUrl } from '../../src/lib/songs';

const rights = (status: 'public_domain' | 'licensed' | 'permission_pending' | 'demo' | 'rejected') => ({
  status,
  basis: '',
  evidence: '',
  holder: '',
  checkedBy: '',
  checkedOn: '',
});

describe('song helpers', () => {
  it('derives id and language from the file path', () => {
    expect(songIdFromPath('hi/aadi-aur-ant-tu-hi-hai.json')).toBe('hi-aadi-aur-ant-tu-hi-hai');
    expect(songIdFromPath('hi\\aadi-aur-ant-tu-hi-hai.json')).toBe('hi-aadi-aur-ant-tu-hi-hai');
    expect(langOf('hi-aadi-aur-ant-tu-hi-hai')).toBe('hi');
    expect(langOf('en-amazing-grace')).toBe('en');
    expect(() => langOf('xx-song')).toThrow();
  });

  it('isPublishable follows the rights gate', () => {
    expect(isPublishable({ publish: true, rights: rights('public_domain') }, false)).toBe(true);
    expect(isPublishable({ publish: true, rights: rights('licensed') }, false)).toBe(true);
    expect(isPublishable({ publish: true, rights: rights('demo') }, false)).toBe(false);
    expect(isPublishable({ publish: true, rights: rights('demo') }, true)).toBe(true);
    expect(isPublishable({ publish: true, rights: rights('permission_pending') }, true)).toBe(false);
    expect(isPublishable({ publish: false, rights: rights('public_domain') }, true)).toBe(false);
  });

  it('builds URLs', () => {
    expect(songUrl('hi-aadi-aur-ant-tu-hi-hai')).toBe('/song/hi-aadi-aur-ant-tu-hi-hai/');
    expect(numberUrl('DTe', '45')).toBe('/b/dte/45/');
    expect(numberUrl('KK', '117A')).toBe('/b/kk/117a/');
  });

  it('picks the primary number and first line', () => {
    const numbers = [
      { book: 'TLBC', number: '117' },
      { book: 'KK', number: '45' },
    ];
    expect(primaryNumber({ numbers })).toEqual({ book: 'TLBC', number: '117' });
    expect(primaryNumber({ numbers }, 'kk')).toEqual({ book: 'KK', number: '45' });
    expect(primaryNumber({ numbers }, 'ZZ')).toEqual({ book: 'TLBC', number: '117' });
    const sections = [{ type: 'verse' as const, label: 'V1', lines: [{ n: 'a', r: 'b', e: 'c' }] }];
    expect(firstLine({ sections })).toEqual({ n: 'a', r: 'b', e: 'c' });
  });
});
