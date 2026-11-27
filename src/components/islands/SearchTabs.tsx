import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { loadNumbers, lookupNumber } from '../../lib/search';
import { songUrl } from '../../lib/songs';
import { site } from '../../site.config';
import LetterBrowser from './LetterBrowser';
import type { BookChip } from './Keypad';

/** Search tab = language → letter → songs (MASTER §6). No text box / number keypad. */
export default function SearchTabs({ books }: { books: BookChip[] }) {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const mq = matchMedia(`(min-width: ${site.layout.desktopMin}px)`);
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const book = p.get('book');
    const n = p.get('n');
    if (book && n) {
      loadNumbers()
        .then((map) => {
          const id = lookupNumber(map, book, n);
          if (id) location.replace(`${songUrl(id)}?from=${book.toLowerCase()}`);
        })
        .catch(() => {});
    } else if (p.has('q') || p.has('tab')) {
      history.replaceState(null, '', `/search/${location.hash}`);
    }
  }, []);

  if (desktop) {
    return <p class="notice muted">{t('desktop.useFinder')}</p>;
  }

  return (
    <div class="search search--unified" data-feature="search">
      <LetterBrowser books={books} />
    </div>
  );
}
