import { useEffect, useMemo, useState } from 'preact/hooks';
import { t } from '../../i18n';
import type { BrowseIndex } from '../../lib/browse';
import { LANG_NATIVE } from '../../lib/scripts';
import { loadMeta, type Hit, type MetaRow } from '../../lib/search';
import { pushRecentLetter, storage, type RecentLetter } from '../../lib/storage';
import { site } from '../../site.config';
import SongHitRow from './SongHitRow';

type Script = (typeof site.languages)[number];

/** Preferred occasion chips (title-cased tags from browse index). */
const PREFERRED_TOPICS = ['Christmas', 'Sunday-school', 'Children', 'Bhajan', 'Praise', 'Worship'];

/** Browse by first letter or topic: हिन्दी / English expand, tap letter/topic → songs. */
export default function BrowsePanel({
  active,
  onSelect,
}: {
  active: boolean;
  /** When set, tapping a song picks it (add-to-set) instead of opening the page. */
  onSelect?: (hit: Hit) => void;
}) {
  const [script, setScript] = useState<Script | null>(null);
  const [lettersOpen, setLettersOpen] = useState(false);
  const [browse, setBrowse] = useState<BrowseIndex | null>(null);
  const [topicMap, setTopicMap] = useState<Record<string, string[]>>({});
  const [letter, setLetter] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [meta, setMeta] = useState<Record<string, MetaRow> | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [recents, setRecents] = useState<RecentLetter[]>([]);

  useEffect(() => {
    if (!active) return;
    setRecents(storage.recentLetters.get().items);
    if (!script) setScript(site.languages.includes('hi') ? 'hi' : (site.languages[0] ?? 'hi'));
    loadMeta()
      .then(setMeta)
      .catch(() => setLoadError(true));
    // Merge topics across languages so Christmas (hi) and Sunday school (en) both show.
    let cancelled = false;
    Promise.all(
      site.languages.map((lang) =>
        fetch(`/search/browse-${lang}.json`)
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
  }, [active]);

  useEffect(() => {
    if (!active || !script) return;
    let cancelled = false;
    setLoadError(false);
    fetch(`/search/browse-${script}.json`)
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
  }, [active, script]);

  const topicChips = useMemo(() => {
    const available = new Set(Object.keys(topicMap));
    const preferred = PREFERRED_TOPICS.filter((name) => available.has(name));
    return preferred.length ? preferred : Object.keys(topicMap).slice(0, 8);
  }, [topicMap]);

  const hits: Hit[] = useMemo(() => {
    if (!meta) return [];
    const ids = topic
      ? (topicMap[topic] ?? [])
      : letter && browse
        ? (browse.byLetter[letter] ?? [])
        : [];
    if (!ids.length) return [];
    const out: Hit[] = [];
    for (const id of ids) {
      const row = meta[id];
      if (!row) continue;
      if (!topic && script && row[2] !== script) continue;
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
  }, [meta, browse, letter, topic, topicMap, script]);

  const pickScript = (next: Script) => {
    if (script === next && lettersOpen) {
      setLettersOpen(false);
      return;
    }
    setScript(next);
    setLettersOpen(true);
    setLetter(null);
    setTopic(null);
  };

  const pickLetter = (L: string, lang: Script = script ?? 'hi') => {
    setScript(lang);
    setLetter(L);
    setTopic(null);
    setLettersOpen(false);
    pushRecentLetter(lang, L);
    setRecents(storage.recentLetters.get().items);
  };

  const pickTopic = (name: string) => {
    if (!script) setScript(site.languages[0] ?? 'hi');
    setTopic(name);
    setLetter(null);
    setLettersOpen(false);
  };

  return (
    <div class="browse-panel">
      <p class="search-help">{t('search.browseHelp')}</p>
      <div class="browse-scripts" role="group" aria-label={t('desktop.browse')}>
        {site.languages.map((lang) => (
          <button
            type="button"
            class="browse-scripts__btn"
            aria-pressed={script === lang ? 'true' : 'false'}
            aria-expanded={script === lang && lettersOpen ? 'true' : 'false'}
            onClick={() => pickScript(lang)}
          >
            {LANG_NATIVE[lang]}
          </button>
        ))}
      </div>

      {topicChips.length > 0 && (
        <div class="browse-topics" role="group" aria-label={t('desktop.topics')}>
          <p class="browse-recents__label">{t('desktop.topics')}</p>
          <div class="browse-recents__chips">
            {topicChips.map((name) => (
              <button
                type="button"
                class={`chip browse-topic${topic === name ? ' browse-topic--active' : ''}`}
                aria-pressed={topic === name ? 'true' : 'false'}
                onClick={() => pickTopic(name)}
              >
                {name === 'Sunday-school' ? t('search.topicSundaySchool') : name === 'Christmas' ? t('search.topicChristmas') : name}
              </button>
            ))}
          </div>
        </div>
      )}

      {recents.length > 0 && !lettersOpen && !topic && (
        <div class="browse-recents" role="group" aria-label={t('search.recentLetters')}>
          <p class="browse-recents__label">{t('search.recentLetters')}</p>
          <div class="browse-recents__chips">
            {recents.map((r) => (
              <button
                type="button"
                class="browse-letter browse-letter--recent"
                onClick={() => pickLetter(r.letter, r.script as Script)}
              >
                {r.letter}
              </button>
            ))}
          </div>
        </div>
      )}

      {lettersOpen && script && (
        <div class="browse-letters" role="group" aria-label={t('desktop.firstLetter')}>
          {(browse?.letters ?? []).map((L) => (
            <button
              type="button"
              class="browse-letter"
              aria-pressed={letter === L ? 'true' : 'false'}
              onClick={() => pickLetter(L)}
            >
              {L}
            </button>
          ))}
          {!browse && !loadError && <p class="search-help">{t('search.searching')}</p>}
        </div>
      )}

      {(letter || topic) && (
        <div class="browse-results">
          <div class="browse-results__bar">
            <button
              type="button"
              class="chip"
              onClick={() => {
                if (topic) {
                  setTopic(null);
                } else {
                  setLettersOpen(true);
                  setLetter(null);
                }
              }}
            >
              {topic
                ? topic === 'Sunday-school'
                  ? t('search.topicSundaySchool')
                  : topic === 'Christmas'
                    ? t('search.topicChristmas')
                    : topic
                : letter}
            </button>
            <span class="browse-results__count">
              {hits.length === 1
                ? t('desktop.songCount.one')
                : t('desktop.songCount', { n: hits.length })}
            </span>
          </div>
          <div class="browse-list">
            {hits.slice(0, 300).map((hit) => (
              <SongHitRow key={hit.id} hit={hit} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}

      {!letter && !topic && !lettersOpen && recents.length === 0 && (
        <p class="search-help">{t('search.browsePickAlphabet')}</p>
      )}
      {lettersOpen && browse && !letter && !topic && (
        <p class="search-help">{t('search.browsePickLetter')}</p>
      )}
      {loadError && <p class="notice">{t('search.loadError')}</p>}
    </div>
  );
}
