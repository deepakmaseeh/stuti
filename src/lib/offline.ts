import { storage } from './storage';

export const PAGES = 'stuti-pages';
export const DATA = 'stuti-data';
export const FONTS = 'stuti-fonts';

export type BookManifest = {
  book: string;
  version: string;
  updated: string;
  bytes: number;
  urls: string[];
  searchIndex: string;
};

/** Thrown when the phone has no room left; the UI shows a clear message instead of a generic error. */
export class StorageFullError extends Error {
  constructor() {
    super('storage full');
    this.name = 'StorageFullError';
  }
}

const isQuota = (e: unknown) =>
  e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');

export async function fetchManifest(bookId: string): Promise<BookManifest> {
  const r = await fetch(`/dl/${bookId}.json`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`manifest ${r.status}`);
  return r.json() as Promise<BookManifest>;
}

export async function downloadBook(
  bookId: string,
  lang: string,
  onProgress: (p: number) => void,
): Promise<void> {
  try {
    const m = await fetchManifest(bookId);
    const pages = await caches.open(PAGES);
    const data = await caches.open(DATA);
    await data.add(m.searchIndex);
    const fontUrls: string[] = await fetch('/dl/fonts.json')
      .then((r) => r.json() as Promise<Record<string, string[]>>)
      .then((f) => f[lang] ?? [])
      .catch(() => []);
    if (fontUrls.length) await (await caches.open(FONTS)).addAll(fontUrls);
    let done = 0;
    for (let i = 0; i < m.urls.length; i += 6) {
      const chunk = m.urls.slice(i, i + 6);
      await Promise.all(
        chunk.map(async (u) => {
          const res = await fetch(u, { credentials: 'same-origin' });
          if (res.ok) await pages.put(u, res);
        }),
      );
      done += chunk.length;
      onProgress(done / m.urls.length);
    }
    storage.downloads.set({
      ...storage.downloads.get(),
      [bookId]: {
        version: m.version,
        updated: m.updated,
        bytes: m.bytes,
        at: new Date().toISOString(),
        urls: m.urls,
      },
    });
    await navigator.storage?.persist?.();
  } catch (e) {
    throw isQuota(e) ? new StorageFullError() : e;
  }
}

// Only delete pages no other downloaded book still needs. Uses the stored URL list so it works offline.
export async function removeBook(bookId: string): Promise<void> {
  const d = { ...storage.downloads.get() };
  const mine = d[bookId]?.urls ?? (await fetchManifest(bookId).catch(() => null))?.urls ?? [];
  delete d[bookId];
  const keep = new Set(Object.values(d).flatMap((x) => x.urls ?? []));
  const pages = await caches.open(PAGES);
  await Promise.all(mine.filter((u) => !keep.has(u)).map((u) => pages.delete(u)));
  storage.downloads.set(d);
}

/** Books whose published version differs from the downloaded one. Silent when offline. */
export async function checkUpdates(): Promise<string[]> {
  const d = storage.downloads.get();
  const out: string[] = [];
  for (const id of Object.keys(d)) {
    try {
      const m = await fetchManifest(id);
      if (m.version !== d[id]?.version) out.push(id);
    } catch {
      /* offline */
    }
  }
  return out;
}

export async function storageEstimate(): Promise<{
  usage: number;
  quota: number;
  persisted: boolean;
} | null> {
  if (!navigator.storage?.estimate) return null;
  const [{ usage = 0, quota = 0 }, persisted] = await Promise.all([
    navigator.storage.estimate(),
    navigator.storage.persisted?.() ?? Promise.resolve(false),
  ]);
  return { usage, quota, persisted };
}

export const formatBytes = (n: number): string =>
  n < 1024
    ? `${n} B`
    : n < 1024 ** 2
      ? `${Math.round(n / 1024)} KB`
      : n < 1024 ** 3
        ? `${(n / 1024 ** 2).toFixed(1)} MB`
        : `${Math.round(n / 1024 ** 3)} GB`;
