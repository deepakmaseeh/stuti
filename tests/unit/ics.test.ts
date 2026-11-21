import { describe, expect, it } from 'vitest';
import { buildIcs } from '../../src/lib/ics';
import type { WorshipSet } from '../../src/lib/sets';

const sample: WorshipSet = {
  v: 2,
  id: 'abc',
  title: 'Sunday Morning · 22 Nov',
  date: '2026-11-22',
  service: 'sunday_morning',
  items: [
    { kind: 'heading', uid: 'h1', text: 'Opening' },
    { kind: 'song', uid: 's1', songId: 'hi-aadi-aur-ant-tu-hi-hai', book: 'TLBC', key: 'G' },
  ],
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

describe('buildIcs', () => {
  it('emits CRLF VCALENDAR with DATE value for all-day', () => {
    const ics = buildIcs(sample, 'https://example.com/sets/view/#s=x');
    expect(ics.includes('\r\n')).toBe(true);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261122');
    expect(ics).toContain('SUMMARY:Sunday Morning');
    expect(ics).toContain('END:VCALENDAR');
  });
});
