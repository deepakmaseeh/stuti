import { useEffect, useMemo, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { loadMeta, loadNumbers, type Hit, type MetaRow, type NumbersMap } from '../../lib/search';
import { site } from '../../site.config';
import LetterBrowser from './LetterBrowser';
import Sheet from './Sheet';

export type SongPick = { songId: string; book: string; badge: string; title: string };

function serialList(numbers: NumbersMap, meta: Record<string, MetaRow>): SongPick[] {
  const out: SongPick[] = [];
  for (const book of Object.keys(numbers).sort((a, b) => a.localeCompare(b))) {
    const map = numbers[book] ?? {};
    const nums = Object.keys(map).sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
      return a.localeCompare(b, undefined, { numeric: true });
    });
    for (const num of nums) {
      const songId = map[num]!;
      const row = meta[songId];
      out.push({
        songId,
        book,
        badge: `${book} ${num}`,
        title: row?.[0] ?? songId,
      });
    }
  }
  return out;
}

type Mode = 'list' | 'browse';

export default function SongsPicker({
  open,
  onClose,
  onPick,
  excludeIds = [],
}: {
  open: boolean;
  onClose: () => void;
  onPick: (song: SongPick) => void;
  excludeIds?: string[];
}) {
  const [meta, setMeta] = useState<Record<string, MetaRow> | null>(null);
  const [numbers, setNumbers] = useState<NumbersMap>({});
  const [q, setQ] = useState('');
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<Mode>('list');

  useEffect(() => {
    if (!open) return;
    setFailed(false);
    setMode('list');
    setQ('');
    Promise.all([loadMeta(), loadNumbers()])
      .then(([m, n]) => {
        setMeta(m);
        setNumbers(n);
      })
      .catch(() => setFailed(true));
  }, [open]);

  const all = useMemo(() => {
    if (!meta) return [];
    return serialList(numbers, meta);
  }, [meta, numbers]);

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((s) => {
      if (excluded.has(s.songId)) return false;
      if (!needle) return true;
      return (
        s.badge.toLowerCase().includes(needle) ||
        s.title.toLowerCase().includes(needle) ||
        s.songId.toLowerCase().includes(needle)
      );
    });
  }, [all, q, excluded]);

  const pickHit = (hit: Hit) => {
    if (excluded.has(hit.id)) return;
    const [b = site.defaultBookId] = hit.badge.split(' ');
    onPick({ songId: hit.id, book: b, badge: hit.badge, title: hit.title });
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('set.songsList')} id="songs-pick">
      <div class="songs-picker">
        <div class="segmented segmented--2" role="tablist" aria-label={t('set.songsList')}>
          <button
            type="button"
            role="tab"
            class="segmented__btn"
            aria-selected={mode === 'list'}
            onClick={() => setMode('list')}
          >
            {t('sets.list')}
          </button>
          <button
            type="button"
            role="tab"
            class="segmented__btn"
            aria-selected={mode === 'browse'}
            onClick={() => setMode('browse')}
          >
            {t('desktop.browse')}
          </button>
        </div>

        {mode === 'list' ? (
          <>
            <label class="field">
              <span class="visually-hidden">{t('set.filterSongs')}</span>
              <input
                class="field__input"
                type="search"
                placeholder={t('set.filterSongs')}
                value={q}
                onInput={(e) => setQ(e.currentTarget.value)}
              />
            </label>
            {failed ? <p class="notice">{t('desktop.previewError')}</p> : null}
            {!meta && !failed ? <p class="muted">{t('desktop.loading')}</p> : null}
            <ol class="songs-picker__list">
              {filtered.map((s) => (
                <li key={s.songId}>
                  <button
                    type="button"
                    class="songs-picker__row"
                    onClick={() => onPick(s)}
                  >
                    <span class="songs-picker__badge">{s.badge}</span>
                    <span class="songs-picker__title">{s.title}</span>
                    <span class="songs-picker__add" aria-hidden="true">
                      +
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {meta && filtered.length === 0 ? <p class="muted">{t('set.noSongsMatch')}</p> : null}
          </>
        ) : (
          <LetterBrowser onSelect={pickHit} />
        )}
      </div>
    </Sheet>
  );
}
