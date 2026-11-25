/** Offline queue for mistake reports (MASTER §17). */

export type MistakeReport = {
  id: string;
  createdAt: string;
  songId: string;
  book?: string;
  no?: number;
  title: string;
  layer?: 'n' | 'r' | 'e';
  lang?: string;
  stanzaId?: string;
  stanzaLabel?: string;
  lineIndex?: number;
  kind: 'spelling' | 'words' | 'missing' | 'order' | 'number' | 'roman' | 'english' | 'other';
  current?: string;
  suggested?: string;
  note?: string;
  name?: string;
  contact?: string;
  church?: string;
  appVersion: string;
  dataVersion: string;
  url: string;
  website?: string;
};

const DB = 'stuti-reports';
const STORE = 'reportQueue';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueReport(r: MistakeReport): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(r);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listQueuedReports(): Promise<MistakeReport[]> {
  const db = await openDb();
  const rows = await new Promise<MistakeReport[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as MistakeReport[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows;
}

export async function removeQueuedReport(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** POST to Worker /api/report. Falls back to formUrl / never opens GitHub for users. */
export async function submitReport(
  r: MistakeReport,
  endpoint = '/api/report',
): Promise<'ok' | 'queued' | 'error'> {
  if (!navigator.onLine) {
    await enqueueReport(r);
    return 'queued';
  }
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(r),
    });
    if (res.ok) {
      await removeQueuedReport(r.id).catch(() => {});
      return 'ok';
    }
    // Worker not configured yet — queue and succeed locally
    if (res.status === 404 || res.status === 502) {
      await enqueueReport(r);
      return 'queued';
    }
    await enqueueReport(r);
    return 'queued';
  } catch {
    await enqueueReport(r);
    return 'queued';
  }
}

export async function flushReportQueue(endpoint = '/api/report'): Promise<number> {
  if (!navigator.onLine) return 0;
  const rows = await listQueuedReports();
  let flushed = 0;
  for (const r of rows) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(r),
      });
      if (res.ok) {
        await removeQueuedReport(r.id);
        flushed++;
      }
    } catch {
      /* keep queued */
    }
  }
  return flushed;
}
