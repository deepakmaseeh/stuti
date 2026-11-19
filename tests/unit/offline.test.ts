import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookManifest } from '../../src/lib/offline';

/** Minimal in-memory Cache Storage + localStorage, enough for offline.ts. */
function setup() {
  const stores = new Map<string, Map<string, Response>>();
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    return {
      put: async (u: string, r: Response) => void m.set(u, r),
      add: async (u: string) => void m.set(u, new Response('idx')),
      addAll: async (us: string[]) => us.forEach((u) => m.set(u, new Response('font'))),
      delete: async (u: string) => m.delete(u),
      keys: async () => [...m.keys()],
    };
  };
  const ls = new Map<string, string>();
  vi.stubGlobal('caches', { open });
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => ls.get(k) ?? null,
    setItem: (k: string, v: string) => void ls.set(k, v),
    removeItem: (k: string) => void ls.delete(k),
  });
  vi.stubGlobal('navigator', { storage: { persist: vi.fn(async () => true) } });
  return { stores };
}

const manifests: Record<string, BookManifest> = {
  AA: {
    book: 'AA',
    version: 'v1',
    updated: '2026-11-19',
    bytes: 10,
    urls: ['/song/x/', '/song/shared/'],
    searchIndex: '/search/idx-ta.json',
  },
  BB: {
    book: 'BB',
    version: 'v1',
    updated: '2026-11-19',
    bytes: 10,
    urls: ['/song/y/', '/song/shared/'],
    searchIndex: '/search/idx-ta.json',
  },
};

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('offline downloads', () => {
  it('downloads pages, search index and fonts, and records the URL list', async () => {
    const { stores } = setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string) => {
        if (u.startsWith('/dl/fonts.json'))
          return new Response(JSON.stringify({ ta: ['/_astro/noto-sans-tamil-tamil-400-normal.x.woff2'] }));
        if (u.startsWith('/dl/')) return new Response(JSON.stringify(manifests.AA));
        return new Response('<html>');
      }),
    );
    const { downloadBook } = await import('../../src/lib/offline');
    const progress: number[] = [];
    await downloadBook('AA', 'ta', (p) => progress.push(p));
    expect([...stores.get('stuti-pages')!.keys()]).toEqual(['/song/x/', '/song/shared/']);
    expect([...stores.get('stuti-data')!.keys()]).toEqual(['/search/idx-ta.json']);
    expect([...stores.get('stuti-fonts')!.keys()]).toEqual([
      '/_astro/noto-sans-tamil-tamil-400-normal.x.woff2',
    ]);
    expect(progress.at(-1)).toBe(1);
    expect(JSON.parse(localStorage.getItem('stuti:downloads')!).AA.urls).toEqual(manifests.AA!.urls);
  });

  it('removing one book keeps pages another downloaded book still needs (works offline)', async () => {
    const { stores } = setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string) => {
        if (u === '/dl/fonts.json') return new Response('{}');
        const m = /\/dl\/(\w+)\.json/.exec(u);
        if (m) return new Response(JSON.stringify(manifests[m[1]!]));
        return new Response('<html>');
      }),
    );
    const { downloadBook, removeBook } = await import('../../src/lib/offline');
    await downloadBook('AA', 'ta', () => {});
    await downloadBook('BB', 'ta', () => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    await removeBook('AA');
    expect([...stores.get('stuti-pages')!.keys()].sort()).toEqual(['/song/shared/', '/song/y/']);
    expect(Object.keys(JSON.parse(localStorage.getItem('stuti:downloads')!))).toEqual(['BB']);
  });

  it('turns a quota error into StorageFullError', async () => {
    setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string) =>
        u.startsWith('/dl/') && u !== '/dl/fonts.json'
          ? new Response(JSON.stringify(manifests.AA))
          : new Response('{}'),
      ),
    );
    vi.stubGlobal('caches', {
      open: async () => ({
        add: async () => {
          throw new DOMException('full', 'QuotaExceededError');
        },
      }),
    });
    const { downloadBook, StorageFullError } = await import('../../src/lib/offline');
    await expect(downloadBook('AA', 'ta', () => {})).rejects.toBeInstanceOf(StorageFullError);
  });

  it('checkUpdates reports books whose version changed and stays quiet offline', async () => {
    setup();
    localStorage.setItem(
      'stuti:downloads',
      JSON.stringify({ AA: { version: 'old', urls: [] }, BB: { version: 'v1', urls: [] } }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string) => {
        if (u.includes('BB')) throw new TypeError('offline');
        return new Response(JSON.stringify(manifests.AA));
      }),
    );
    const { checkUpdates } = await import('../../src/lib/offline');
    expect(await checkUpdates()).toEqual(['AA']);
  });

  it('formatBytes picks a readable unit', async () => {
    const { formatBytes } = await import('../../src/lib/offline');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(4393)).toBe('4 KB');
    expect(formatBytes(741 * 1024)).toBe('741 KB');
    expect(formatBytes(2.5 * 1024 ** 2)).toBe('2.5 MB');
    expect(formatBytes(10240.7 * 1024 ** 2)).toBe('10 GB');
  });
});
