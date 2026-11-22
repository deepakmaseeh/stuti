import { useEffect, useMemo, useState } from 'preact/hooks';
import { X } from 'lucide-preact';
import { t } from '../../i18n';
import { loadMeta, loadNumbers, type Hit, type MetaRow, type NumbersMap } from '../../lib/search';
import { updatePrefs, storage } from '../../lib/storage';
import SongHitRow from './SongHitRow';

const TOPICS = [
  { id: 'all', label: 'All topics' },
  { id: 'christmas', label: 'Christmas' },
  { id: 'sunday-school', label: 'Sunday school' },
  { id: 'children', label: 'Children' },
  { id: 'bhajan', label: 'Bhajan' },
  { id: 'praise', label: 'Praise' },
  { id: 'worship', label: 'Worship' },
] as const;

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

/** Unified song search: one input + Language/Book/Topic dropdowns (§6). */
export default function SongListPanel({ active }: { active: boolean }) {
  const [meta, setMeta] = useState<Record<string, MetaRow> | null>(null);
  const [numbers, setNumbers] = useState<NumbersMap>({});
  const [q, setQ] = useState('');
  const [book, setBook] = useState('all');
  const [lang, setLang] = useState('all');
  const [topic, setTopic] = useState('all');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!active) return;
    setFailed(false);
    const prefs = storage.prefs.get();
    if (prefs.langFilter && prefs.langFilter !== 'all') setLang(prefs.langFilter);
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
    let rows = all;
    if (lang !== 'all') rows = rows.filter((h) => h.lang === lang);
    if (topic !== 'all') {
      const needle = topic.replace('-', ' ');
      rows = rows.filter(
        (h) =>
          h.title.toLowerCase().includes(needle) ||
          h.roman.toLowerCase().includes(needle) ||
          (h.firstLine ?? '').toLowerCase().includes(needle) ||
          h.badge.toLowerCase().includes(topic === 'christmas' ? 'xmas' : topic),
      );
    }
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (h) =>
        h.badge.toLowerCase().includes(needle) ||
        h.title.toLowerCase().includes(needle) ||
        h.roman.toLowerCase().includes(needle) ||
        h.id.toLowerCase().includes(needle) ||
        (h.firstLine ?? '').toLowerCase().includes(needle),
    );
  }, [all, q, lang, topic]);

  const filtersOn = lang !== 'all' || book !== 'all' || topic !== 'all';

  const clearFilters = () => {
    setLang('all');
    setBook('all');
    setTopic('all');
    updatePrefs({ langFilter: 'all' });
  };

  if (!active) return null;

  return (
    <div class="song-list-panel search-block">
      <label class="search-block__input">
        <span class="visually-hidden">{t('search.songs')}</span>
        <input
          class="field__input"
          type="search"
          inputMode="search"
          placeholder="Number or words…"
          value={q}
          data-feature="search"
          onInput={(e) => setQ(e.currentTarget.value)}
        />
      </label>

      <div class={`search-block__filters ${filtersOn ? '' : ''} row-scroll`} role="group" aria-label="Filters">
        <label class="filter-select">
          <span class="visually-hidden">Language</span>
          <select
            data-feature="language"
            value={lang}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setLang(v);
              updatePrefs({ langFilter: v });
            }}
          >
            <option value="all">Language: All</option>
            <option value="hi">Language: हिन्दी</option>
            <option value="en">Language: English</option>
          </select>
        </label>
        <label class="filter-select">
          <span class="visually-hidden">{t('search.book')}</span>
          <select value={book} onChange={(e) => setBook(e.currentTarget.value)}>
            <option value="all">Book: All</option>
            {bookIds.map((b) => (
              <option value={b} key={b}>
                Book: {b}
              </option>
            ))}
          </select>
        </label>
        <label class="filter-select">
          <span class="visually-hidden">Topic</span>
          <select value={topic} onChange={(e) => setTopic(e.currentTarget.value)}>
            {TOPICS.map((tp) => (
              <option value={tp.id} key={tp.id}>
                Topic: {tp.label.replace(/^All topics$/, 'All')}
              </option>
            ))}
          </select>
        </label>
        {filtersOn ? (
          <button type="button" class="icon-btn" onClick={clearFilters} aria-label="Clear filters" title="Clear">
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {failed ? <p class="notice">{t('search.loadError')}</p> : null}
      {!failed && !meta ? <p class="muted">{t('desktop.loading')}</p> : null}
      {meta ? (
        filtered.length === 0 ? (
          <p class="muted">{t('set.noSongsMatch')}</p>
        ) : (
          <ul class="results">
            {filtered.slice(0, 80).map((h) => (
              <li key={h.id}>
                <SongHitRow hit={h} />
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
