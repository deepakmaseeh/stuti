import { useEffect, useMemo, useState } from 'preact/hooks';
import { t } from '../../i18n';
import type { BrowseIndex } from '../../lib/browse';
import { loadMeta, type Hit, type MetaRow } from '../../lib/search';
import { storage, updatePrefs } from '../../lib/storage';
import { site } from '../../site.config';
import Keypad, { type BookChip } from './Keypad';
import WordSearch from './WordSearch';
import SongHitRow from './SongHitRow';

type Tab = 'number' | 'words' | 'browse';

export default function Finder({ books, currentId = '' }: { books: BookChip[]; currentId?: string }) {
  const [desktop, setDesktop] = useState(false);
  const [tab, setTab] = useState<Tab>('number');
  const [langFilter, setLangFilter] = useState('all');
  const [meta, setMeta] = useState<Record<string, MetaRow> | null>(null);
  const [browse, setBrowse] = useState<BrowseIndex | null>(null);
  const [letter, setLetter] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  /** undefined until URL/prefs read so Keypad gets the deep-link book/n on first mount. */
  const [deep, setDeep] = useState<{ book?: string; n?: string; q?: string } | undefined>(undefined);

  useEffect(() => {
    const mq = matchMedia(`(min-width: ${site.layout.desktopMin}px)`);
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!desktop) return;
    const prefs = storage.prefs.get();
    const url = new URLSearchParams(location.search);
    const d = {
      book: url.get('book') ?? undefined,
      n: url.get('n') ?? undefined,
      q: url.get('q') ?? undefined,
    };
    if (d.q || url.get('tab') === 'words') setTab('words');
    else if (d.book || d.n) setTab('number');
    else {
      const last = prefs.lastTab;
      setTab(last === 'words' || last === 'browse' ? last : 'number');
    }
    setDeep(d);
    setLangFilter(prefs.langFilter || 'all');
    loadMeta().then(setMeta).catch(() => {});
    const onLang = (e: Event) => setLangFilter((e as CustomEvent).detail?.lang || 'all');
    addEventListener('stuti:lang-filter', onLang);
    return () => removeEventListener('stuti:lang-filter', onLang);
  }, [desktop]);

  useEffect(() => {
    if (tab !== 'browse') return;
    const langs = langFilter === 'all' ? [...site.languages] : [langFilter];
    Promise.all(
      langs.map((lang) =>
        fetch(`/search/browse-${lang}.json`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ),
    ).then((parts) => {
      const merged: BrowseIndex = { letters: [], topics: [], byLetter: {}, byTopic: {} };
      for (const part of parts) {
        if (!part) continue;
        for (const L of part.letters as string[]) {
          if (!merged.byLetter[L]) merged.letters.push(L);
          merged.byLetter[L] = [...new Set([...(merged.byLetter[L] ?? []), ...(part.byLetter[L] ?? [])])];
        }
        for (const T of part.topics as string[]) {
          if (!merged.byTopic[T]) merged.topics.push(T);
          merged.byTopic[T] = [...new Set([...(merged.byTopic[T] ?? []), ...(part.byTopic[T] ?? [])])];
        }
      }
      setBrowse(merged);
    });
  }, [tab, langFilter]);

  const filteredBooks = useMemo(
    () => (langFilter === 'all' ? books : books.filter((b) => b.lang === langFilter)),
    [books, langFilter],
  );

  const browseHits: Hit[] = useMemo(() => {
    if (!meta || !browse) return [];
    let ids: string[] | null = null;
    if (letter) ids = browse.byLetter[letter] ?? [];
    if (topic) {
      const tIds = browse.byTopic[topic] ?? [];
      ids = ids ? ids.filter((id) => tIds.includes(id)) : tIds;
    }
    if (!ids) ids = Object.keys(meta);
    const hits: Hit[] = [];
    for (const id of ids) {
      const row = meta[id];
      if (!row) continue;
      if (langFilter !== 'all' && row[2] !== langFilter) continue;
      hits.push({
        id,
        title: row[0],
        roman: row[1],
        lang: row[2],
        badge: row[3],
        score: 0,
        firstLine: row[4],
      });
    }
    hits.sort((a, b) => a.title.localeCompare(b.title, a.lang));
    return hits;
  }, [meta, browse, letter, topic, langFilter]);

  const choose = (next: Tab) => {
    setTab(next);
    updatePrefs({ lastTab: next });
  };

  if (!desktop) return null;

  return (
    <div class="finder">
      <div class="finder__seg" role="tablist" aria-label={t('search.title')}>
        {(['number', 'words', 'browse'] as const).map((id) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === id ? 'true' : 'false'}
            onClick={() => choose(id)}
          >
            {id === 'browse' ? t('desktop.browse') : t(id === 'number' ? 'search.number' : 'search.words')}
          </button>
        ))}
      </div>

      {tab === 'number' && deep !== undefined && (
        <Keypad
          books={filteredBooks.length ? filteredBooks : books}
          active
          desktopOnly
          initial={deep}
        />
      )}
      {tab === 'words' && <WordSearch active autoFocus={false} initialQuery={deep?.q} />}
      {tab === 'browse' && (
        <div class="finder-browse">
          <p class="finder-label">{t('desktop.firstLetter')}</p>
          <div class="finder-letters">
            {(browse?.letters ?? []).map((L) => (
              <button
                type="button"
                class="finder-letter"
                aria-pressed={letter === L ? 'true' : 'false'}
                onClick={() => setLetter(letter === L ? null : L)}
              >
                {L}
              </button>
            ))}
          </div>
          {(browse?.topics.length ?? 0) > 0 && (
            <>
              <p class="finder-label">{t('desktop.topics')}</p>
              <div class="chips">
                {browse!.topics.map((top) => (
                  <button
                    type="button"
                    class="chip"
                    aria-pressed={topic === top ? 'true' : 'false'}
                    onClick={() => setTopic(topic === top ? null : top)}
                  >
                    {top}
                  </button>
                ))}
              </div>
            </>
          )}
          <p class="finder-label">
            {browseHits.length === 1
              ? t('desktop.songCount.one')
              : t('desktop.songCount', { n: browseHits.length })}
          </p>
          <div class="finder-list">
            {browseHits.slice(0, 300).map((hit) => (
              <div class={hit.id === currentId ? 'finder-row-wrap is-current' : 'finder-row-wrap'}>
                <SongHitRow hit={hit} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
