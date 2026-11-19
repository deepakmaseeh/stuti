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

  return (
    <div class="downloads">
      {!online && <p class="notice">{t('dl.offlineNote')}</p>}
      <ul class="dl-list">
        {books.map((b) => {
          const rec = saved[b.id];
          const m = manifests[b.id];
          const row = rows[b.id];
          const busy = row?.progress != null;
          const hasUpdate = !!rec && !!m && m.version !== rec.version;
          const bytes = m?.bytes ?? rec?.bytes;
          return (
            <li class="dl-row" key={b.id} data-book={b.id}>
              <div class="dl-row__info">
                <span class="dl-row__title" lang={LANG_TAG.n[b.lang]}>
                  {b.native}
                </span>
                <span class="muted">
                  {b.id} · {LANG_LABEL[b.lang]}
                  {bytes ? ` · ${formatBytes(bytes)}` : ''}
                </span>
                {rec && !busy && (
                  <span class="dl-row__status" data-testid="dl-status">
                    <span class="nowrap">✓ {t('dl.savedOn', { date: rec.at.slice(0, 10) })}</span> ·{' '}
                    <span class="nowrap">{t('dl.updatedOn', { date: rec.updated })}</span>
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
                    <span class="dl-progress__text">
                      {t('dl.saving', { p: Math.round(row.progress! * 100) })}
                    </span>
                  </span>
                )}
                {row?.error && (
                  <span class="dl-row__error" role="alert">
                    {row.error}
                  </span>
                )}
              </div>
              <div class="dl-row__actions">
                {!rec && (
                  <button
                    type="button"
                    class="btn btn--primary btn--compact"
                    disabled={busy || !online}
                    onClick={() => download(b)}
                  >
                    {t('dl.download')}
                  </button>
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
                {rec && (
                  <button
                    type="button"
                    class="btn btn--small"
                    disabled={busy}
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
