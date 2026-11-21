import { useEffect, useState } from 'preact/hooks';
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
import { storage, type DownloadRecord, type SongSnapshot } from '../../lib/storage';
import { LANG_TAG } from '../../lib/scripts';
import type { Lang } from '../../lib/schema';
import { songUrl } from '../../lib/songs';
import SongHitRow from './SongHitRow';

type State = {
  recent: SongSnapshot[];
  favs: SongSnapshot[];
  downloads: Record<string, DownloadRecord>;
  active?: WorshipSet;
};

const EMPTY: State = { recent: [], favs: [], downloads: {} };
const toHit = (s: SongSnapshot): Hit => ({
  id: s.id,
  title: s.title,
  roman: '',
  lang: s.lang,
  badge: s.badge,
  score: 0,
});

export default function HomeLists() {
  const [s, setS] = useState<State>(EMPTY);

  useEffect(() => {
    hydrateSets();
    const refresh = () => {
      setS({
        recent: storage.recent.get().items,
        favs: storage.favs.get().items,
        downloads: storage.downloads.get(),
        active: getActiveSet(),
      });
    };
    refresh();
    return listenSetsChanged(refresh);
  }, []);

  const continueSong = s.recent[0];
  const dl = Object.values(s.downloads);
  const lastUpdate = dl
    .map((d) => d.updated)
    .sort()
    .at(-1);
  const active = s.active;
  const songs = active ? songItems(active) : [];
  const first = songs[0];

  return (
    <div class="home-lists">
      {dl.length > 0 ? (
        <a class="status-pill status-pill--ok" href="/downloads/">
          <span aria-hidden="true">●</span> {t('home.offlineReady')} ·{' '}
          {t('home.readyCount', { n: dl.length })}
          {lastUpdate ? ` · ${lastUpdate}` : ''}
        </a>
      ) : (
        <a class="status-pill" href="/downloads/">
          {t('home.downloadPrompt')}
        </a>
      )}

      {continueSong && (
        <a class="continue-card" href={songUrl(continueSong.id)}>
          <span class="badge badge--header" role="img" aria-label={continueSong.badge}>
            <span class="badge__book" aria-hidden="true">
              {continueSong.badge.split(' ')[0]}
            </span>
            <span class="badge__num" aria-hidden="true">
              {continueSong.badge.split(' ')[1]}
            </span>
          </span>
          <span class="continue-card__text">
            <span class="continue-card__label">{t('home.continue')}</span>
            <span class="continue-card__title" lang={LANG_TAG.n[continueSong.lang as Lang]}>
              {continueSong.title}
            </span>
          </span>
        </a>
      )}

      {active ? (
        <div class="sunday-card">
          <span class="sunday-card__label">{t('set.thisSunday')}</span>
          <div class="sunday-card__title">{active.title}</div>
          <div class="sunday-card__text">
            {formatSetDate(active.date)}
            {active.time ? ` · ${active.time}` : ''} · {serviceLabel(active.service)}
            {active.leader ? ` · ${active.leader}` : ''} ·{' '}
            {songs.length === 1 ? t('set.songs.one') : t('set.songs', { n: songs.length })}
          </div>
          {first ? (
            <div class="sunday-card__songs">
              First: {first.book ? `${first.book} ` : ''}
              {first.songId.replace(/^(en|hi|ta|te|pa)-/, '').replace(/-/g, ' ')}
            </div>
          ) : null}
          <div class="sunday-card__acts">
            {first ? (
              <a
                class="btn btn--primary"
                href={`/song/${first.songId}/?set=${encodeURIComponent(active.id)}&i=0`}
                data-astro-reload
              >
                ▶ {t('set.startSinging')}
              </a>
            ) : null}
            <a class="btn" href={`/sets/edit/?id=${encodeURIComponent(active.id)}`}>
              Edit
            </a>
            <a class="btn" href={`/sets/print/?id=${encodeURIComponent(active.id)}`}>
              PDF
            </a>
            <a class="btn" href="/sets/">
              All sets
            </a>
          </div>
        </div>
      ) : (
        <a class="sunday-card" href="/sets/">
          <span class="sunday-card__label">{t('home.sunday')}</span>
          <div class="sunday-card__title">{t('home.sundayEmpty')}</div>
          <div class="sunday-card__acts">
            <span class="btn btn--primary">+ {t('set.newSet')}</span>
          </div>
        </a>
      )}

      <section aria-labelledby="favs-title">
        <h2 class="group-title" id="favs-title">
          {t('home.favourites')}
        </h2>
        {s.favs.length ? (
          <ul class="results">
            {s.favs.map((f) => (
              <li key={f.id}>
                <SongHitRow hit={toHit(f)} />
              </li>
            ))}
          </ul>
        ) : (
          <p class="muted empty-line">{t('home.favEmpty')}</p>
        )}
      </section>

      {s.recent.length > 0 && (
        <section aria-labelledby="recent-title">
          <h2 class="group-title" id="recent-title">
            {t('home.recent')}
          </h2>
          <ul class="results">
            {s.recent.slice(0, 5).map((r) => (
              <li key={r.id}>
                <SongHitRow hit={toHit(r)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
