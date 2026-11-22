import { useEffect, useState } from 'preact/hooks';
import { Hash, Search } from 'lucide-preact';
import { t } from '../../i18n';
import { site } from '../../site.config';
import Keypad, { type BookChip } from './Keypad';
import SongListPanel from './SongListPanel';

/** Desktop finder: one search block + optional keypad (§6). */
export default function Finder({ books }: { books: BookChip[]; currentId?: string }) {
  const [desktop, setDesktop] = useState(false);
  const [mode, setMode] = useState<'search' | 'number'>('search');
  const [deep, setDeep] = useState<{ book?: string; n?: string; q?: string } | undefined>(undefined);

  useEffect(() => {
    const mq = matchMedia(`(min-width: ${site.layout.desktopMin}px)`);
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!desktop) return;
    const url = new URLSearchParams(location.search);
    const d = {
      book: url.get('book') ?? undefined,
      n: url.get('n') ?? undefined,
      q: url.get('q') ?? undefined,
    };
    if (d.book || d.n || url.get('tab') === 'number') setMode('number');
    setDeep(d);
  }, [desktop]);

  if (!desktop) return null;

  return (
    <div class="finder search--unified" data-feature="search">
      <div class="search-mode-row">
        <button
          type="button"
          class={mode === 'search' ? 'chip is-on' : 'chip'}
          onClick={() => setMode('search')}
          aria-pressed={mode === 'search'}
        >
          <Search size={16} strokeWidth={1.75} aria-hidden="true" /> {t('search.songs')}
        </button>
        <button
          type="button"
          class={mode === 'number' ? 'chip is-on' : 'chip'}
          onClick={() => setMode('number')}
          aria-pressed={mode === 'number'}
          aria-label="Number keypad"
          title="Number keypad"
        >
          <Hash size={16} strokeWidth={1.75} aria-hidden="true" /> 123
        </button>
      </div>
      {mode === 'number' && deep !== undefined ? (
        <Keypad books={books} active desktopOnly initial={deep} />
      ) : (
        <SongListPanel active />
      )}
    </div>
  );
}
