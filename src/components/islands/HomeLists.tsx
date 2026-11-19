import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import type { Hit } from '../../lib/search';
import { getDraft } from '../../lib/setlist';
import { storage, type DownloadRecord, type SongSnapshot } from '../../lib/storage';
import { LANG_TAG } from '../../lib/scripts';
import type { Lang } from '../../lib/schema';
import { songUrl } from '../../lib/songs';
import SongHitRow from './SongHitRow';

type State = {
  recent: SongSnapshot[];
  favs: SongSnapshot[];
  setCount: number;
  downloads: Record<string, DownloadRecord>;
};

const EMPTY: State = { recent: [], favs: [], setCount: 0, downloads: {} };
const toHit = (s: SongSnapshot): Hit => ({
  id: s.id,
  title: s.title,
  roman: '',
  lang: s.lang,
  badge: s.badge,
  score: 0,
});

/**
 * Personal lists from localStorage. The server render is the empty state a first-time visitor sees,
 * so there is no layout shift for them; returning users get their lists right after hydration.
 */
export default function HomeLists() {
  const [s, setS] = useState<State>(EMPTY);

  useEffect(() => {
    setS({
      recent: storage.recent.get().items,
      favs: storage.favs.get().items,
      setCount: getDraft().s.length,
      downloads: storage.downloads.get(),
    });
  }, []);

  const continueSong = s.recent[0];
  const dl = Object.values(s.downloads);
  const lastUpdate = dl
    .map((d) => d.updated)
    .sort()
    .at(-1);

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

      <a class="sunday-card" href="/set/">
        <span class="sunday-card__label">{t('home.sunday')}</span>
        <span class="sunday-card__text">
          {s.setCount ? t('home.sundayCount', { n: s.setCount }) : t('home.sundayEmpty')}
        </span>
      </a>

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
