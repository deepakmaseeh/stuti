import { useEffect, useState } from 'preact/hooks';
import { Pencil, Play, Plus, Star } from 'lucide-preact';
import { t } from '../../i18n';
import type { Hit } from '../../lib/search';
import {
  getActiveSet,
  hydrateSets,
  listenSetsChanged,
  songItems,
  type WorshipSet,
} from '../../lib/sets';
import { formatSetDate } from '../../lib/setlist';
import { loadMeta, type MetaRow } from '../../lib/search';
import { storage, type SongSnapshot } from '../../lib/storage';
import { LANG_TAG } from '../../lib/scripts';
import type { Lang } from '../../lib/schema';
import { songUrl } from '../../lib/songs';
import SongHitRow from './SongHitRow';

type Tab = 'recent' | 'favourites';
type State = {
  recent: SongSnapshot[];
  favs: SongSnapshot[];
  active?: WorshipSet;
  meta: Record<string, MetaRow> | null;
};

const EMPTY: State = { recent: [], favs: [], meta: null };
const toHit = (s: SongSnapshot): Hit => ({
  id: s.id,
  title: s.title,
  roman: '',
  lang: s.lang,
  badge: s.badge,
  score: 0,
});

function firstSongLabel(metaBadge: string | undefined, title: string): string {
  if (metaBadge) return `${metaBadge} · ${title}`;
  return title;
}

export default function HomeLists() {
  const [s, setS] = useState<State>(EMPTY);
  const [tab, setTab] = useState<Tab>('recent');

  useEffect(() => {
    hydrateSets();
    try {
      const saved = localStorage.getItem('stuti:homeSongsTab');
      if (saved === 'favourites' || saved === 'recent') setTab(saved);
    } catch {
      /* */
    }
    const refresh = () => {
      setS((cur) => ({
        recent: storage.recent.get().items,
        favs: storage.favs.get().items,
        active: getActiveSet(),
        meta: cur.meta,
      }));
    };
    refresh();
    loadMeta()
      .then((meta) => setS((cur) => ({ ...cur, meta })))
      .catch(() => {});
    return listenSetsChanged(refresh);
  }, []);

  const setSongsTab = (next: Tab) => {
    setTab(next);
    try {
      localStorage.setItem('stuti:homeSongsTab', next);
    } catch {
      /* */
    }
  };

  const active = s.active;
  const songs = active ? songItems(active) : [];
  const first = songs[0];
  const firstMeta = first && s.meta ? s.meta[first.songId] : undefined;
  const firstBadge = firstMeta?.[3] ?? (first?.book ? String(first.book) : '');
  const firstTitle = firstMeta?.[0] ?? first?.songId ?? '';
  const list = tab === 'recent' ? s.recent : s.favs;
  const showYourSongs = s.recent.length > 0 || s.favs.length > 0;

  return (
    <div class="home-lists">
      {active ? (
        <section class="sunday" data-guide="sunday" aria-label={t('set.thisSunday')}>
          <div class="d">
            {formatSetDate(active.date).toUpperCase()}
            {active.time ? ` · ${active.time}` : ''}
          </div>
          <h3>{active.title}</h3>
          {first ? (
            <div class="first">
              First: <b>{firstBadge || active.title}</b> · <span>{firstTitle}</span>
            </div>
          ) : null}
          <div class="acts">
            {first ? (
              <a
                class="btn-v3 w"
                href={`/song/${first.songId}/?set=${encodeURIComponent(active.id)}&i=0`}
                data-astro-reload
                data-feature="present"
              >
                <Play size={18} fill="currentColor" strokeWidth={1.75} aria-hidden="true" />
                {t('set.startSinging')}
              </a>
            ) : null}
            <a
              class="btn-v3 o icon"
              style={{ width: 44, padding: 0 }}
              href={`/sets/edit/?id=${encodeURIComponent(active.id)}`}
              aria-label={t('set.edit')}
            >
              <Pencil size={18} strokeWidth={1.75} aria-hidden="true" />
            </a>
          </div>
        </section>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <a class="btn-v3 ghost" href="/sets/">
            <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
            Plan this Sunday
          </a>
        </div>
      )}

      {showYourSongs ? (
        <section class="your-songs" aria-labelledby="your-songs-title">
          <div class="sechead" style={{ marginTop: 10 }}>
            <h2 id="your-songs-title">Your songs</h2>
            {list.length > 0 ? (
              <a class="link-v3" href="/search/">
                See all ({list.length})
              </a>
            ) : null}
          </div>
          <div class="segtabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'recent'}
              class={tab === 'recent' ? 'on' : undefined}
              onClick={() => setSongsTab('recent')}
            >
              {t('home.recent')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'favourites'}
              class={tab === 'favourites' ? 'on' : undefined}
              onClick={() => setSongsTab('favourites')}
            >
              {t('home.favourites')}
            </button>
          </div>
          {list.length === 0 ? (
            <p class="muted sm" style={{ padding: '14px 0' }}>
              {tab === 'favourites' ? (
                <>
                  Tap <Star size={14} style={{ display: 'inline', verticalAlign: '-2px' }} aria-hidden="true" /> on any
                  song to keep it here.
                </>
              ) : (
                'Open a song to see it here.'
              )}
            </p>
          ) : (
            <div class="results" style={{ display: 'block' }}>
              {list.slice(0, 3).map((row, i) => (
                <a key={row.id} class="row-v3" href={songUrl(row.id)}>
                  <span
                    class="badge"
                    style={{ width: 44, height: 44, minWidth: 44, flex: 'none' }}
                    aria-hidden="true"
                  >
                    <span class="badge__book">{row.badge.split(' ')[0]}</span>
                    <span class="badge__num" style={{ fontSize: 16 }}>
                      {row.badge.split(' ')[1]}
                    </span>
                  </span>
                  <div class="mid">
                    <div class="t" lang={LANG_TAG.n[row.lang as Lang]}>
                      {row.title}
                      {tab === 'recent' && i === 0 ? <span class="tagc">{t('home.continue')}</span> : null}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
