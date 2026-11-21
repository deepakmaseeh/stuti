import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { storage, type RecentItem } from '../../lib/storage';
import { songUrl } from '../../lib/songs';

/** Magnifier menu: Browse / Number / Songs + recent songs. */
export default function MobileSearchMenu() {
  const [recent, setRecent] = useState<RecentItem[]>([]);

  useEffect(() => {
    const sync = () => setRecent(storage.recent.get().items.slice(0, 5));
    sync();
    addEventListener('stuti:set-changed', sync);
    return () => removeEventListener('stuti:set-changed', sync);
  }, []);

  return (
    <details class="menu search-menu">
      <summary class="icon-btn" aria-label={t('nav.search')}>
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </summary>
      <div class="menu__list" role="menu">
        <a href="/search/?tab=browse" role="menuitem">
          {t('desktop.browse')}
        </a>
        <a href="/search/?tab=number" role="menuitem">
          {t('search.number')}
        </a>
        <a href="/search/?tab=songs" role="menuitem">
          {t('search.songs')}
        </a>
        {recent.length > 0 && (
          <>
            <p class="menu__label">{t('home.recent')}</p>
            {recent.map((r) => (
              <a href={songUrl(r.id)} role="menuitem" data-astro-reload>
                {r.title}
              </a>
            ))}
          </>
        )}
      </div>
    </details>
  );
}
