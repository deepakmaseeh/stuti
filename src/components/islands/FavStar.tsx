import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { isFavourite, toggleFavourite, type SongSnapshot } from '../../lib/storage';

export default function FavStar({ snapshot }: { snapshot: SongSnapshot }) {
  const [fav, setFav] = useState(false);
  useEffect(() => setFav(isFavourite(snapshot.id)), []);

  return (
    <button
      type="button"
      class={`icon-btn star${fav ? ' star--on' : ''}`}
      aria-pressed={fav ? 'true' : 'false'}
      aria-label={fav ? t('song.unfavourite') : t('song.favourite')}
      onClick={() => setFav(toggleFavourite(snapshot))}
    >
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />
      </svg>
    </button>
  );
}
