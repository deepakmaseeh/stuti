import { describe, expect, it } from 'vitest';
import type { WorshipSet } from '../../src/lib/sets';
import { worshipSetWhatsAppText } from '../../src/lib/whatsapp-text';

const sample: WorshipSet = {
  v: 2,
  id: 'abc',
  title: 'Sunday Morning',
  date: '2026-11-22',
  service: 'sunday_morning',
  items: [
    { kind: 'heading', uid: 'h1', text: 'Opening' },
    {
      kind: 'song',
      uid: 's1',
      songId: 'hi-aao-pyaaron-sharan-masih-ki',
      book: 'TLBC',
      key: 'G',
    },
    {
      kind: 'song',
      uid: 's2',
      songId: 'hi-chamaka-sitara',
      book: 'TLBC',
      verses: [0, 2],
    },
  ],
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

describe('worshipSetWhatsAppText', () => {
  it('formats headings, keys and verses', () => {
    const text = worshipSetWhatsAppText(sample, {
      titles: {
        'hi-aao-pyaaron-sharan-masih-ki': 'आओ प्यारो शरण मसीह की',
        'hi-chamaka-sitara': 'चमका सितारा देखो',
      },
      url: 'https://example.com/sets/view/#s=x',
    });
    expect(text).toContain('OPENING');
    expect(text).toContain('TLBC आओ प्यारो शरण मसीह की (Key G)');
    expect(text).toContain('verses 1, 3');
    expect(text).toContain('Open: https://example.com');
  });
});
