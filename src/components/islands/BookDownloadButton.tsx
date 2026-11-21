import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { StorageFullError, downloadBook } from '../../lib/offline';
import type { Lang } from '../../lib/langs';
import { storage } from '../../lib/storage';
import { showToast } from '../../lib/toast';

/** Download every song page in this book for offline use. */
export default function BookDownloadButton({
  bookId,
  lang,
}: {
  bookId: string;
  lang: Lang;
}) {
  const [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSaved(Boolean(storage.downloads.get()[bookId]));
  }, [bookId]);

  const onDownload = async () => {
    setError(null);
    setProgress(0);
    try {
      await downloadBook(bookId, lang, setProgress);
      setSaved(true);
      setProgress(null);
      showToast(t('dl.saved'));
    } catch (e) {
      setProgress(null);
      setError(e instanceof StorageFullError ? t('dl.full') : t('dl.failed'));
    }
  };

  return (
    <div class="book-download">
      <p class="search-help">{t('dl.bookHint')}</p>
      {saved ? (
        <p class="muted">{t('dl.saved')}</p>
      ) : (
        <button
          type="button"
          class="btn btn--secondary"
          disabled={progress !== null}
          onClick={() => void onDownload()}
        >
          {progress !== null
            ? t('dl.saving', { p: Math.round(progress * 100) })
            : t('dl.download')}
        </button>
      )}
      {error ? <p class="notice">{error}</p> : null}
    </div>
  );
}
