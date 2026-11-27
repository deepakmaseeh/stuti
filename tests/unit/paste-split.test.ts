import { describe, expect, it } from 'vitest';
import { splitPastedSong } from '../../src/lib/paste-split';
import worker from '../../workers/report';

const SAMPLE = `46 चमका सितारा देखो

1. स्वर्गीय पिता का आया संदेशा, मरियम जनेगी एक ऐसा बेटा (2)
इमानुएल है जिसका नाम, हरदम रहेगा वो तेरे साथ

कोरस
- चमका सितारा देखो, चमका सितारा देखो, चमका सितारा रे (2)
देखो आया यीशु जग में, सारे जग का वो राजा है (2)

2. दूतों ने मिलकर गीत ये गाया, चरनी में आया हम सब का राजा (2)
सारे लोगों को छुटकारा देता, पापी जीवन से मुक्ति दिलाता`;

describe('splitPastedSong', () => {
  it('splits pasted sample into 3 stanzas with 1 chorus, ×2 repeats, and stripped bullets', () => {
    const res = splitPastedSong(SAMPLE);
    expect(res).toHaveLength(3);
    expect(res[0]?.type).toBe('verse');
    expect(res[0]?.label).toBe('Verse 1');
    expect(res[0]?.lines[0]).toEqual({
      n: 'स्वर्गीय पिता का आया संदेशा, मरियम जनेगी एक ऐसा बेटा',
      x: 2,
    });
    expect(res[1]?.type).toBe('chorus');
    expect(res[1]?.lines[0]?.n.startsWith('- ')).toBe(false);
    expect(res[1]?.lines[0]?.x).toBe(2);
    expect(res[2]?.type).toBe('verse');
    expect(res[2]?.label).toBe('Verse 2');
  });
});

describe('Worker /api/admin auth guard', () => {
  const fakeEnv = {
    ASSETS: { fetch: async () => new Response('ok') },
  };

  it('returns 403 when Cf-Access-Authenticated-User-Email header is missing', async () => {
    const req = new Request('https://stuti.deepakmaseeh121.workers.dev/api/admin/me');
    const res = await worker.fetch(req, fakeEnv);
    expect(res.status).toBe(403);
  });

  it('returns 200 with email when Access header is present', async () => {
    const req = new Request('https://stuti.deepakmaseeh121.workers.dev/api/admin/me', {
      headers: { 'Cf-Access-Authenticated-User-Email': 'godisourlord8874@gmail.com' },
    });
    const res = await worker.fetch(req, fakeEnv);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; email: string };
    expect(data.ok).toBe(true);
    expect(data.email).toBe('godisourlord8874@gmail.com');
  });

  it('returns reports JSON (notConfigured when CSV URL is unset) with Access header', async () => {
    const req = new Request('https://stuti.deepakmaseeh121.workers.dev/api/admin/reports', {
      headers: { 'Cf-Access-Authenticated-User-Email': 'godisourlord8874@gmail.com' },
    });
    const res = await worker.fetch(req, fakeEnv);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; notConfigured?: boolean; reports: unknown[] };
    expect(data.ok).toBe(true);
    expect(data.notConfigured).toBe(true);
    expect(data.reports).toEqual([]);
  });
});
