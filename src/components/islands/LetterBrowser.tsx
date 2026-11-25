import { useEffect, useMemo, useState } from 'preact/hooks';
import { ChevronLeft, X } from 'lucide-preact';
import { t } from '../../i18n';
import type { BrowseIndex } from '../../lib/browse';
import { LANG_NATIVE } from '../../lib/scripts';
import { loadMeta, type Hit, type MetaRow } from '../../lib/search';
import { pushRecentLetter, storage } from '../../lib/storage';
import { site } from '../../site.config';
import SongHitRow from './SongHitRow';

type Script = (typeof site.languages)[number];

const SESSION_KEY = 'stuti:letterBrowser';
const PREFERRED_TOPICS = ['Christmas', 'Sunday-school', 'Children', 'Bhajan', 'Praise', 'Worship'];

type Session = { lang?: Script; letter?: string; book?: string; topic?: string };

function readSession(): Session {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}') as Session;
  } catch {
    return {};
  }
}
function writeSession(s: Session) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* */
  }
}

type Props = {
  books?: { id: string; lang: string; native: string; en: string }[];
  onSelect?: (hit: Hit) => void;
  /** Show plus on rows (editor browse sheet). */
  pickMode?: boolean;
};

/** Tap language → letter grid → songs. No text box (MASTER §6). */
export default function LetterBrowser({ books = [], onSelect }: Props) {
  const saved = typeof sessionStorage !== 'undefined' ? readSession() : {};
  const [lang, setLang] = useState<Script | null>(saved.lang ?? null);
  const [letter, setLetter] = useState<string | null>(saved.letter ?? null);
  const [book, setBook] = useState(saved.book ?? 'all');
  const [topic, setTopic] = useState(saved.topic ?? 'all');
  const [browse, setBrowse] = useState<BrowseIndex | null>(null);
  const [topicMap, setTopicMap] = useState<Record<string, string[]>>({});
  const [meta, setMeta] = useState<Record<string, MetaRow> | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    loadMeta()
      .then(setMeta)
      .catch(() => setLoadError(true));
    let cancelled = false;
    Promise.all(
      site.languages.map((l) =>
        fetch(`/search/browse-${l}.json`)
          .then((r) => (r.ok ? (r.json() as Promise<BrowseIndex>) : null))
          .catch(() => null),
      ),
    ).then((indexes) => {
      if (cancelled) return;
      const merged: Record<string, string[]> = {};
      for (const idx of indexes) {
        if (!idx) continue;
        for (const [name, ids] of Object.entries(idx.byTopic)) {
          merged[name] = [...new Set([...(merged[name] ?? []), ...ids])];
        }
      }
      setTopicMap(merged);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!lang) {
      setBrowse(null);
      return;
    }
    let cancelled = false;
    fetch(`/search/browse-${lang}.json`)
      .then((r) => {
        if (!r.ok) throw new Error('browse');
        return r.json() as Promise<BrowseIndex>;
      })
      .then((data) => {
        if (!cancelled) setBrowse(data);
      })
      .catch(() => {
        if (!cancelled) {
          setBrowse(null);
          setLoadError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  useEffect(() => {
    writeSession({
      lang: lang ?? undefined,
      letter: letter ?? undefined,
      book,
      topic,
    });
  }, [lang, letter, book, topic]);

  const topics = useMemo(() => {
    const available = new Set(Object.keys(topicMap));
    const preferred = PREFERRED_TOPICS.filter((name) => available.has(name));
    return preferred.length ? preferred : Object.keys(topicMap).slice(0, 8);
  }, [topicMap]);

  const bookOptions = useMemo(() => {
    if (!lang) return books;
    return books.filter((b) => b.lang === lang);
  }, [books, lang]);

  const letterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!browse || !meta) return counts;
    for (const L of browse.letters) {
      const ids = browse.byLetter[L] ?? [];
      let n = 0;
      for (const id of ids) {
        const row = meta[id];
        if (!row) continue;
        if (book !== 'all' && !row[3]?.toUpperCase().startsWith(book.toUpperCase())) continue;
        if (topic !== 'all' && !(topicMap[topic] ?? []).includes(id)) continue;
        n++;
      }
      counts[L] = n;
    }
    return counts;
  }, [browse, meta, book, topic, topicMap]);

  const hits: Hit[] = useMemo(() => {
    if (!meta || !letter || !browse) return [];
    let ids = browse.byLetter[letter] ?? [];
    if (topic !== 'all') {
      const tIds = new Set(topicMap[topic] ?? []);
      ids = ids.filter((id) => tIds.has(id));
    }
    const out: Hit[] = [];
    for (const id of ids) {
      const row = meta[id];
      if (!row) continue;
      if (lang && row[2] !== lang) continue;
      if (book !== 'all' && !row[3]?.toUpperCase().startsWith(book.toUpperCase())) continue;
      out.push({
        id,
        title: row[0],
        roman: row[1],
        lang: row[2],
        badge: row[3],
        score: 0,
        firstLine: row[4],
      });
    }
    out.sort((a, b) => a.title.localeCompare(b.title, a.lang));
    return out;
  }, [meta, browse, letter, lang, book, topic, topicMap]);

  const pickLang = (next: Script) => {
    setLang(next);
    setLetter(null);
    if (book !== 'all') {
      const b = books.find((x) => x.id.toUpperCase() === book.toUpperCase());
      if (b && b.lang !== next) setBook('all');
    }
  };

  const onBookChange = (id: string) => {
    setBook(id);
    if (id !== 'all') {
      const b = books.find((x) => x.id.toUpperCase() === id.toUpperCase());
      if (b) {
        setLang(b.lang as Script);
        setLetter(null);
      }
    }
  };

  const pickLetter = (L: string) => {
    if (!lang) return;
    if ((letterCounts[L] ?? 0) === 0) return;
    setLetter(L);
    pushRecentLetter(lang, L);
  };

  const clearFilters = () => {
    setBook('all');
    setTopic('all');
  };

  const filtersOn = book !== 'all' || topic !== 'all';

  return (
    <div class="letter-browser" data-feature="language">
      <h2 class="letter-browser__title">{t('search.title')}</h2>

      <div class="letter-browser__langs" role="group" aria-label={t('desktop.browse')}>
        {site.languages.map((l) => (
          <button
            type="button"
            key={l}
            class={lang === l ? 'letter-browser__lang is-on' : 'letter-browser__lang'}
            aria-pressed={lang === l}
            onClick={() => pickLang(l)}
          >
            {LANG_NATIVE[l]}
          </button>
        ))}
      </div>

      <div class="letter-browser__filters grid-2">
        <label class="field">
          <span class="visually-hidden">Book</span>
          <select
            value={book}
            onChange={(e) => onBookChange(e.currentTarget.value)}
            aria-label="Book"
          >
            <option value="all">Book: All</option>
            {(lang ? bookOptions : books).map((b) => (
              <option key={b.id} value={b.id}>
                Book: {b.id}
              </option>
            ))}
          </select>
        </label>
        <label class="field">
          <span class="visually-hidden">Topic</span>
          <select
            value={topic}
            onChange={(e) => {
              setTopic(e.currentTarget.value);
              setLetter(null);
            }}
            aria-label="Topic"
          >
            <option value="all">Topic: All</option>
            {topics.map((name) => (
              <option key={name} value={name}>
                Topic:{' '}
                {name === 'Sunday-school'
                  ? t('search.topicSundaySchool')
                  : name === 'Christmas'
                    ? t('search.topicChristmas')
                    : name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {filtersOn ? (
        <button type="button" class="chip letter-browser__clear" onClick={clearFilters}>
          <X size={14} strokeWidth={1.75} aria-hidden="true" /> Clear filters
        </button>
      ) : null}

      {/* State B: letter grid */}
      {lang && !letter ? (
        <div class="letter-browser__grid" role="group" aria-label={t('desktop.firstLetter')}>
          {(browse?.letters ?? []).map((L) => {
            const n = letterCounts[L] ?? 0;
            return (
              <button
                type="button"
                key={L}
                class="letter-browser__key"
                disabled={n === 0}
                aria-disabled={n === 0}
                onClick={() => pickLetter(L)}
              >
                <span class="letter-browser__glyph">{L}</span>
                {n > 0 ? <span class="letter-browser__count">{n}</span> : null}
              </button>
            );
          })}
          {!browse && !loadError ? <p class="search-help">{t('search.searching')}</p> : null}
        </div>
      ) : null}

      {/* State C: song list */}
      {lang && letter ? (
        <div class="letter-browser__results">
          <div class="letter-browser__mini">
            <button
              type="button"
              class="icon-btn"
              aria-label="Back to letters"
              onClick={() => setLetter(null)}
            >
              <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <span class="letter-browser__crumb">
              {LANG_NATIVE[lang]} › {letter} ·{' '}
              {hits.length === 1
                ? t('desktop.songCount.one')
                : t('desktop.songCount', { n: hits.length })}
            </span>
            <button
              type="button"
              class="icon-btn"
              aria-label="Close"
              onClick={() => setLetter(null)}
            >
              <X size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
          <div class="browse-list">
            {hits.slice(0, 400).map((hit) => (
              <SongHitRow key={hit.id} hit={hit} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ) : null}

      {loadError ? <p class="notice">{t('search.loadError')}</p> : null}
    </div>
  );
}
