import { useEffect, useMemo, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { loadMeta, loadNumbers, type Hit, type MetaRow, type NumbersMap } from '../../lib/search';
import SongHitRow from './SongHitRow';

function serialHits(numbers: NumbersMap, meta: Record<string, MetaRow>, bookFilter: string): Hit[] {
  const out: Hit[] = [];
  const books = Object.keys(numbers)
    .filter((b) => bookFilter === 'all' || b === bookFilter)
    .sort((a, b) => a.localeCompare(b));
  for (const book of books) {
    const map = numbers[book] ?? {};
    const nums = Object.keys(map).sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
      return a.localeCompare(b, undefined, { numeric: true });
    });
    for (const num of nums) {
      const id = map[num]!;
      const row = meta[id];
      out.push({
        id,
        title: row?.[0] ?? id,
        roman: row?.[1] ?? '',
        lang: row?.[2] ?? 'hi',
        badge: `${book} ${num}`,
        score: 0,
        firstLine: row?.[4],
      });
    }
  }
  return out;
}

/** Full book song list in number order (replaces Words on search / Finder). */
export default function SongListPanel({ active }: { active: boolean }) {
  const [meta, setMeta] = useState<Record<string, MetaRow> | null>(null);
  const [numbers, setNumbers] = useState<NumbersMap>({});
  const [q, setQ] = useState('');
  const [book, setBook] = useState('all');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!active) return;
    setFailed(false);
    Promise.all([loadMeta(), loadNumbers()])
      .then(([m, n]) => {
        setMeta(m);
        setNumbers(n);
      })
      .catch(() => setFailed(true));
  }, [active]);

  const bookIds = useMemo(() => Object.keys(numbers).sort((a, b) => a.localeCompare(b)), [numbers]);

  const all = useMemo(() => {
    if (!meta) return [];
    return serialHits(numbers, meta, book);
  }, [meta, numbers, book]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(
      (h) =>
        h.badge.toLowerCase().includes(needle) ||
        h.title.toLowerCase().includes(needle) ||
        h.roman.toLowerCase().includes(needle) ||
        h.id.toLowerCase().includes(needle),
    );
  }, [all, q]);

  if (!active) return null;

  return (
    <div class="song-list-panel">
      <p class="search-help">{t('search.songsHelp')}</p>
      {bookIds.length > 1 && (
        <div class="song-list-panel__books" role="group" aria-label={t('search.book')}>
          <button
            type="button"
            class="chip"
            aria-pressed={book === 'all' ? 'true' : 'false'}
            onClick={() => setBook('all')}
          >
            {t('desktop.langAll')}
          </button>
          {bookIds.map((id) => (
            <button
              type="button"
              key={id}
              class="chip"
              aria-pressed={book === id ? 'true' : 'false'}
              onClick={() => setBook(id)}
            >
              {id}
            </button>
          ))}
        </div>
      )}
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
      {failed ? <p class="notice">{t('search.loadError')}</p> : null}
      {!meta && !failed ? <p class="muted">{t('desktop.loading')}</p> : null}
      <div class="song-list-panel__scroll">
        {filtered.map((hit) => (
          <SongHitRow key={`${hit.badge}-${hit.id}`} hit={hit} />
        ))}
      </div>
      {meta && filtered.length === 0 ? <p class="muted">{t('set.noSongsMatch')}</p> : null}
    </div>
  );
}
