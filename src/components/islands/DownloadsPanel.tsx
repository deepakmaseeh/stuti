import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import {
  StorageFullError,
  downloadBook,
  fetchManifest,
  formatBytes,
  removeBook,
  storageEstimate,
  type BookManifest,
} from '../../lib/offline';
import { LANG_LABEL, LANG_TAG } from '../../lib/scripts';
import type { Lang } from '../../lib/langs';
import { storage, type DownloadRecord } from '../../lib/storage';
import { showToast } from '../../lib/toast';

export type DlBook = { id: string; native: string; en: string; lang: Lang };
type Row = { progress: number | null; error: string | null };

export default function DownloadsPanel({ books }: { books: DlBook[] }) {
  const [saved, setSaved] = useState<Record<string, DownloadRecord>>({});
  const [manifests, setManifests] = useState<Record<string, BookManifest>>({});
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [online, setOnline] = useState(true);
  const [est, setEst] = useState<Awaited<ReturnType<typeof storageEstimate>>>(null);

  const refreshEstimate = () =>
    storageEstimate()
      .then(setEst)
      .catch(() => {});

  useEffect(() => {
    setSaved(storage.downloads.get());
    const update = () => setOnline(navigator.onLine);
    update();
    addEventListener('online', update);
    addEventListener('offline', update);
    // Manifests give size + version; failures (offline) just leave the saved info.
    books.forEach((b) =>
      fetchManifest(b.id)
        .then((m) => setManifests((cur) => ({ ...cur, [b.id]: m })))
        .catch(() => {}),
    );
    void refreshEstimate();
    return () => {
      removeEventListener('online', update);
      removeEventListener('offline', update);
    };
  }, []);

  const setRow = (id: string, row: Partial<Row>) =>
    setRows((cur) => ({ ...cur, [id]: { progress: null, error: null, ...cur[id], ...row } }));

  const download = async (b: DlBook) => {
    setRow(b.id, { progress: 0, error: null });
    try {
      await downloadBook(b.id, b.lang, (p) => setRow(b.id, { progress: p }));
      setSaved(storage.downloads.get());
      setRow(b.id, { progress: null });
    } catch (e) {
      setRow(b.id, { progress: null, error: e instanceof StorageFullError ? t('dl.full') : t('dl.failed') });
    }
    void refreshEstimate();
  };

  const remove = async (b: DlBook) => {
    await removeBook(b.id);
    setSaved(storage.downloads.get());
    showToast(t('dl.removed', { book: b.id }));
    void refreshEstimate();
  };

  const persist = async () => {
    await navigator.storage?.persist?.();
    void refreshEstimate();
  };

  const savedCount = Object.keys(saved).length;

  return (
    <div class="downloads">
      {!online && <p class="notice">{t('dl.offlineNote')}</p>}
      <div class="downloads__status">
        <span class="okt" aria-hidden="true">
          {savedCount ? '✓' : '○'}
        </span>
        <div style="font-size:14px">
          <b>{savedCount ? 'Ready for church without signal' : 'Download books for offline use'}</b>
          <br />
          {savedCount} of {books.length} books saved
          {est ? ` · ${formatBytes(est.usage)}` : ''}
        </div>
      </div>
      <ul class="dl-list">
        {books.map((b) => {
          const rec = saved[b.id];
          const m = manifests[b.id];
          const row = rows[b.id];
          const busy = row?.progress != null;
          const hasUpdate = !!rec && !!m && m.version !== rec.version;
          const bytes = m?.bytes ?? rec?.bytes;
          const label = LANG_LABEL[b.lang] ?? b.lang;
          return (
            <li class="dl-row" key={b.id} data-book={b.id}>
              <span class="badge badge--book" role="img" aria-label={b.id}>
                <span class="badge__book">{label.slice(0, 8).toUpperCase()}</span>
                <span class="badge__num">{b.id}</span>
              </span>
              <div class="dl-row__info">
                <span class="dl-row__title" lang={LANG_TAG.n[b.lang]}>
                  {b.native}
                </span>
                <span class="muted">
                  {bytes ? `${formatBytes(bytes)}` : b.en}
                  {busy ? ` · Downloading ${Math.round((row.progress ?? 0) * 100)}%` : ''}
                </span>
                {rec && !busy && !hasUpdate && (
                  <span class="dl-row__status okt" data-testid="dl-status">
                    ✓ Saved
                  </span>
                )}
                {busy && (
                  <span
                    class="dl-progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(row.progress! * 100)}
                    aria-label={b.native}
                  >
                    <span class="dl-progress__bar" style={{ width: `${Math.round(row.progress! * 100)}%` }} />
                  </span>
                )}
                {row?.error && (
                  <span class="dl-row__error" role="alert">
                    {row.error}
                  </span>
                )}
              </div>
              <div class="dl-row__actions">
                {!rec && !busy && (
                  <button
                    type="button"
                    class="btn btn--primary btn--compact"
                    disabled={!online}
                    onClick={() => download(b)}
                  >
                    {t('dl.download')}
                  </button>
                )}
                {busy && (
                  <span class="muted" style="font-size:14px">
                    …
                  </span>
                )}
                {hasUpdate && (
                  <button
                    type="button"
                    class="btn btn--secondary btn--compact"
                    disabled={busy || !online}
                    onClick={() => download(b)}
                  >
                    {t('dl.update')}
                  </button>
                )}
                {rec && !busy && (
                  <button
                    type="button"
                    class="btn btn--small"
                    onClick={() => remove(b)}
                    aria-label={`${t('dl.remove')}: ${b.native}`}
                  >
                    {t('dl.remove')}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {est && (
        <div class="dl-storage">
          <p class="muted">
            {t('dl.storage', { used: formatBytes(est.usage), quota: formatBytes(est.quota) })}
          </p>
          {est.persisted ? (
            <p class="muted">{t('dl.persisted')}</p>
          ) : (
            <button type="button" class="btn btn--small" onClick={persist}>
              {t('dl.persist')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
