import { t } from '../../i18n';
import Keypad, { type BookChip } from './Keypad';

/** Left desktop pane on song pages: number keypad + links to search / books / set. */
export default function SongSidePanel({ books }: { books: BookChip[] }) {
  return (
    <div class="song-side" data-desktop-source>
      <p class="song-side__label">{t('desktop.jumpNumber')}</p>
      <Keypad books={books} active />
      <nav class="song-side__links" aria-label={t('desktop.more')}>
        <a href="/search/?tab=songs">{t('search.songs')}</a>
        <a href="/books/">{t('books.title')}</a>
        <a href="/set/">{t('nav.set')}</a>
      </nav>
    </div>
  );
}
