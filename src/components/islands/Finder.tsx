import { useEffect, useState } from 'preact/hooks';
import { site } from '../../site.config';
import LetterBrowser from './LetterBrowser';
import type { BookChip } from './Keypad';

/** Desktop finder pane: same letter browser as Search tab (MASTER §6). */
export default function Finder({ books }: { books: BookChip[]; currentId?: string }) {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const mq = matchMedia(`(min-width: ${site.layout.desktopMin}px)`);
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  if (!desktop) return null;

  return (
    <div class="finder search--unified" data-feature="search">
      <LetterBrowser books={books} />
    </div>
  );
}
