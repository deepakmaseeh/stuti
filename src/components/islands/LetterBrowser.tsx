import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ChevronDown, ChevronLeft, X } from 'lucide-preact';
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

function readHash(): Session {
  try {
    if (typeof location === 'undefined' || !location.hash) return {};
    const p = new URLSearchParams(location.hash.slice(1));
    const lang = p.get('lang');
    const l = p.get('l');
    const book = p.get('book');
    const topic = p.get('topic');
    return {
      lang: lang === 'hi' || lang === 'en' ? lang : undefined,
      letter: l || undefined,
      book: book || undefined,
      topic: topic || undefined,
    };
  } catch {
    return {};
  }
}

/** Tap language → letter grid → songs. No text box (MASTER §6). */
export default function LetterBrowser({ books = [], onSelect }: Props) {
  const fromHash = !onSelect ? readHash() : {};
  const saved = typeof sessionStorage !== 'undefined' ? readSession() : {};
  const [lang, setLang] = useState<Script | null>(fromHash.lang ?? saved.lang ?? null);
  const [letter, setLetter] = useState<string | null>(fromHash.letter ?? saved.letter ?? null);
  const [book, setBook] = useState(fromHash.book ?? saved.book ?? 'all');
  const [topic, setTopic] = useState(fromHash.topic ?? saved.topic ?? 'all');
  const [browse, setBrowse] = useState<BrowseIndex | null>(null);
  const [topicMap, setTopicMap] = useState<Record<string, string[]>>({});
  const [meta, setMeta] = useState<Record<string, MetaRow> | null>(null);
  const [loadError, setLoadError] = useState(false);
  const gridScrollRef = useRef(0);

  useEffect(() => {
    if (onSelect) return;
    const onHash = () => {
      const h = readHash();
      if (h.lang !== undefined) setLang(h.lang);
      setLetter(h.letter ?? null);
      if (h.book !== undefined) setBook(h.book);
      if (h.topic !== undefined) setTopic(h.topic);
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, [onSelect]);

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
    if (!onSelect && typeof history !== 'undefined') {
      const p = new URLSearchParams();
      if (lang) p.set('lang', lang);
      if (book !== 'all') p.set('book', book);
      if (topic !== 'all') p.set('topic', topic);
      if (letter) p.set('l', letter);
      const nextHash = p.toString() ? `#${p.toString()}` : '';
      if (location.hash !== nextHash) {
        history.replaceState(null, '', `${location.pathname}${location.search}${nextHash}`);
      }
    }
  }, [lang, letter, book, topic, onSelect]);

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
    gridScrollRef.current = window.scrollY;
    setLetter(L);
    pushRecentLetter(lang, L);
  };

  const backToLetters = () => {
    setLetter(null);
    requestAnimationFrame(() => window.scrollTo(0, gridScrollRef.current));
  };

  const clearFilters = () => {
    setBook('all');
    setTopic('all');
  };

  const filtersOn = book !== 'all' || topic !== 'all';

  return (
    <div class="letter-browser" data-feature="language">
      {!letter ? (
        <>
          <h2 class="letter-browser__title">Find a song</h2>

          <div class="langs" role="group" aria-label={t('desktop.browse')} data-guide="langs">
            {site.languages.map((l) => (
              <button
                type="button"
                key={l}
                class={`lang${l === 'hi' ? ' hi' : ''}${lang === l ? ' on' : ''}`}
                aria-pressed={lang === l}
                onClick={() => pickLang(l)}
              >
                {LANG_NATIVE[l]}
              </button>
            ))}
          </div>

          <div class="filters">
            <label class="v3-sel">
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
              <ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" />
            </label>
            <label class="v3-sel">
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
              <ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" />
            </label>
          </div>
          {filtersOn ? (
            <button type="button" class="chip letter-browser__clear" style={{ marginTop: 8 }} onClick={clearFilters}>
              <X size={14} strokeWidth={1.75} aria-hidden="true" /> Clear filters
            </button>
          ) : null}

          {lang ? (
            <div class="letters" role="group" aria-label={t('desktop.firstLetter')} data-guide="letters">
              {(browse?.letters ?? []).map((L) => {
                const n = letterCounts[L] ?? 0;
                return (
                  <button
                    type="button"
                    key={L}
                    class="key"
                    disabled={n === 0}
                    aria-disabled={n === 0}
                    aria-label={L}
                    onClick={() => pickLetter(L)}
                  >
                    {L}
                  </button>
                );
              })}
              {!browse && !loadError ? <p class="search-help">{t('search.searching')}</p> : null}
            </div>
          ) : (
            <p class="empty-hint">Pick a language to see its letters.</p>
          )}
        </>
      ) : (
        <div class="letter-browser__results">
          <div class="crumb">
            <button type="button" class="ib ink" aria-label="Back to letters" onClick={backToLetters}>
              <ChevronLeft size={22} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <span>
              {LANG_NATIVE[lang]} › <span class="hi" style={{ fontSize: 20 }}>{letter}</span>{' '}
              <span class="muted" style={{ fontWeight: 500 }}>
                · {hits.length === 1 ? t('desktop.songCount.one') : t('desktop.songCount', { n: hits.length })}
              </span>
            </span>
            <button type="button" class="ib ink x" aria-label="Close" onClick={backToLetters}>
              <X size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
          <div class="browse-list">
            {hits.slice(0, 400).map((hit) => (
              <SongHitRow key={hit.id} hit={hit} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}

      {loadError ? <p class="notice">{t('search.loadError')}</p> : null}
    </div>
  );
}
