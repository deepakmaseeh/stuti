import { useEffect, useState } from 'preact/hooks';
import { Pencil, Play, Plus } from 'lucide-preact';
import { t } from '../../i18n';
import type { Hit } from '../../lib/search';
import {
  getActiveSet,
  hydrateSets,
  listenSetsChanged,
  serviceLabel,
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
        <div class="sunday-card">
          <span class="sunday-card__label">{t('set.thisSunday')}</span>
          <div class="sunday-card__title">{active.title}</div>
          <div class="sunday-card__text">
            {formatSetDate(active.date)}
            {active.time ? ` · ${active.time}` : ''} · {serviceLabel(active.service)}
            {active.leader ? ` · ${active.leader}` : ''}
          </div>
          {first ? <div class="sunday-card__songs">{firstSongLabel(firstBadge || undefined, firstTitle)}</div> : null}
          <div class="sunday-card__acts">
            {first ? (
              <a
                class="btn btn--primary"
                href={`/song/${first.songId}/?set=${encodeURIComponent(active.id)}&i=0`}
                data-astro-reload
                data-feature="present"
              >
                <Play size={18} strokeWidth={1.75} aria-hidden="true" /> {t('set.startSinging')}
              </a>
            ) : null}
            <a class="btn" href={`/sets/edit/?id=${encodeURIComponent(active.id)}`} aria-label={t('set.edit')}>
              <Pencil size={18} strokeWidth={1.75} aria-hidden="true" />
            </a>
          </div>
        </div>
      ) : (
        <a class="sunday-card" href="/sets/">
          <span class="sunday-card__label">{t('home.sunday')}</span>
          <div class="sunday-card__title">{t('home.sundayEmpty')}</div>
          <div class="sunday-card__acts">
            <span class="btn btn--primary">
              <Plus size={18} strokeWidth={1.75} aria-hidden="true" /> {t('set.newSet')}
            </span>
          </div>
        </a>
      )}

      {showYourSongs ? (
        <section class="your-songs" aria-labelledby="your-songs-title">
          <div class="your-songs__head">
            <h2 class="group-title" id="your-songs-title">
              Your songs
            </h2>
            <div class="your-songs__tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'recent'}
                class={tab === 'recent' ? 'is-active' : undefined}
                onClick={() => setSongsTab('recent')}
              >
                {t('home.recent')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'favourites'}
                class={tab === 'favourites' ? 'is-active' : undefined}
                onClick={() => setSongsTab('favourites')}
              >
                {t('home.favourites')}
              </button>
            </div>
          </div>
          {list.length === 0 ? (
            <p class="muted empty-line">
              {tab === 'favourites' ? t('home.favEmpty') : 'Open a song to see it here.'}
            </p>
          ) : (
            <ul class="results">
              {list.slice(0, 3).map((row, i) => (
                <li key={row.id}>
                  {tab === 'recent' && i === 0 ? (
                    <a class="continue-card" href={songUrl(row.id)}>
                      <span class="badge badge--header" role="img" aria-label={row.badge}>
                        <span class="badge__book" aria-hidden="true">
                          {row.badge.split(' ')[0]}
                        </span>
                        <span class="badge__num" aria-hidden="true">
                          {row.badge.split(' ')[1]}
                        </span>
                      </span>
                      <span class="continue-card__text">
                        <span class="continue-card__label">{t('home.continue')}</span>
                        <span class="continue-card__title" lang={LANG_TAG.n[row.lang as Lang]}>
                          {row.title}
                        </span>
                      </span>
                    </a>
                  ) : (
                    <SongHitRow hit={toHit(row)} />
                  )}
                </li>
              ))}
            </ul>
          )}
          {list.length > 3 ? (
            <a class="your-songs__more" href={`/search/?tab=songs`}>
              See all ({list.length})
            </a>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
