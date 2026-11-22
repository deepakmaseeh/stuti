import { useEffect, useState } from 'preact/hooks';
import { Hash, Search } from 'lucide-preact';
import { t } from '../../i18n';
import { loadNumbers, lookupNumber } from '../../lib/search';
import { songUrl } from '../../lib/songs';
import { site } from '../../site.config';
import Keypad, { type BookChip } from './Keypad';
import SongListPanel from './SongListPanel';

/** One search surface: list + filters, with optional number keypad (FINAL_UI_SPEC §6). */
export default function SearchTabs({ books }: { books: BookChip[] }) {
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
    const p = new URLSearchParams(location.search);
    const d = {
      book: p.get('book') ?? undefined,
      n: p.get('n') ?? undefined,
      q: p.get('q') ?? undefined,
    };
    if (d.book && d.n) {
      loadNumbers()
        .then((map) => {
          const id = lookupNumber(map, d.book!, d.n!);
          if (id) location.replace(`${songUrl(id)}?from=${d.book!.toLowerCase()}`);
        })
        .catch(() => {});
      setMode('number');
    } else if (p.get('tab') === 'number') setMode('number');
    setDeep(d);
  }, []);

  if (desktop) {
    return <p class="notice muted">{t('desktop.useFinder')}</p>;
  }

  return (
    <div class="search search--unified" data-feature="search">
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
          title="Number keypad"
          aria-label="Number keypad"
        >
          <Hash size={16} strokeWidth={1.75} aria-hidden="true" /> 123
        </button>
      </div>
      {mode === 'number' && deep !== undefined ? (
        <Keypad books={books} active initial={deep} />
      ) : (
        <SongListPanel active />
      )}
    </div>
  );
}
