import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { loadNumbers, lookupNumber } from '../../lib/search';
import { songUrl } from '../../lib/songs';
import { storage, updatePrefs } from '../../lib/storage';
import { site } from '../../site.config';
import BrowsePanel from './BrowsePanel';
import Keypad, { type BookChip } from './Keypad';
import SongListPanel from './SongListPanel';

type Tab = 'browse' | 'number' | 'songs';
type Deep = { book?: string; n?: string; q?: string };

const TABS: Tab[] = ['browse', 'number', 'songs'];

function tabLabel(id: Tab) {
  if (id === 'browse') return t('desktop.browse');
  if (id === 'number') return t('search.number');
  return t('search.songs');
}

function normalizeTab(raw: string | undefined): Tab {
  if (raw === 'number') return 'number';
  if (raw === 'songs' || raw === 'words') return 'songs';
  return 'browse';
}

export default function SearchTabs({ books }: { books: BookChip[] }) {
  const [desktop, setDesktop] = useState(false);
  const [tab, setTab] = useState<Tab>('browse');
  const [deep, setDeep] = useState<Deep | undefined>(undefined);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const mq = matchMedia(`(min-width: ${site.layout.desktopMin}px)`);
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const d: Deep = {
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
      setTab('number');
    } else if (d.q || p.get('tab') === 'words' || p.get('tab') === 'songs') setTab('songs');
    else if (p.get('tab') === 'number') setTab('number');
    else if (p.get('tab') === 'browse') setTab('browse');
    else setTab(normalizeTab(storage.prefs.get().lastTab));
    setDeep(d);
  }, []);

  const choose = (next: Tab, focus = false) => {
    setTab(next);
    updatePrefs({ lastTab: next });
    if (focus) tabRefs.current[TABS.indexOf(next)]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = TABS.indexOf(tab);
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!;
    choose(next, true);
  };

  if (desktop) {
    return <p class="notice muted">{t('desktop.useFinder')}</p>;
  }

  return (
    <div class="search">
      <div class="segmented segmented--3" role="tablist" aria-label={t('search.title')} onKeyDown={onKeyDown}>
        {TABS.map((id, i) => (
          <button
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-controls={`panel-${id}`}
            aria-selected={tab === id ? 'true' : 'false'}
            tabIndex={tab === id ? 0 : -1}
            class="segmented__btn"
            onClick={() => choose(id)}
          >
            {tabLabel(id)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="panel-browse" aria-labelledby="tab-browse" hidden={tab !== 'browse'}>
        <BrowsePanel active={tab === 'browse'} />
      </div>
      <div role="tabpanel" id="panel-number" aria-labelledby="tab-number" hidden={tab !== 'number'}>
        {deep !== undefined && (
          <Keypad books={books} active={tab === 'number'} initial={deep} />
        )}
      </div>
      <div role="tabpanel" id="panel-songs" aria-labelledby="tab-songs" hidden={tab !== 'songs'}>
        <SongListPanel active={tab === 'songs'} />
      </div>
    </div>
  );
}
