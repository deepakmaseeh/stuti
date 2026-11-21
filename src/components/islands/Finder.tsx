import { useEffect, useMemo, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { storage, updatePrefs } from '../../lib/storage';
import { site } from '../../site.config';
import BrowsePanel from './BrowsePanel';
import Keypad, { type BookChip } from './Keypad';
import SongListPanel from './SongListPanel';

type Tab = 'browse' | 'number' | 'songs';

function normalizeTab(raw: string | undefined): Tab {
  if (raw === 'number') return 'number';
  if (raw === 'songs' || raw === 'words') return 'songs';
  return 'browse';
}

export default function Finder({ books }: { books: BookChip[]; currentId?: string }) {
  const [desktop, setDesktop] = useState(false);
  const [tab, setTab] = useState<Tab>('browse');
  const [langFilter, setLangFilter] = useState('all');
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
    const prefs = storage.prefs.get();
    const url = new URLSearchParams(location.search);
    const d = {
      book: url.get('book') ?? undefined,
      n: url.get('n') ?? undefined,
      q: url.get('q') ?? undefined,
    };
    if (d.q || url.get('tab') === 'words' || url.get('tab') === 'songs') setTab('songs');
    else if (d.book || d.n || url.get('tab') === 'number') setTab('number');
    else if (url.get('tab') === 'browse') setTab('browse');
    else setTab(normalizeTab(prefs.lastTab));
    setDeep(d);
    setLangFilter(prefs.langFilter || 'all');
    const onLang = (e: Event) => setLangFilter((e as CustomEvent).detail?.lang || 'all');
    addEventListener('stuti:lang-filter', onLang);
    return () => removeEventListener('stuti:lang-filter', onLang);
  }, [desktop]);

  const filteredBooks = useMemo(
    () => (langFilter === 'all' ? books : books.filter((b) => b.lang === langFilter)),
    [books, langFilter],
  );

  const choose = (next: Tab) => {
    setTab(next);
    updatePrefs({ lastTab: next });
  };

  if (!desktop) return null;

  return (
    <div class="finder">
      <div class="finder__seg" role="tablist" aria-label={t('search.title')}>
        {(['browse', 'number', 'songs'] as const).map((id) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === id ? 'true' : 'false'}
            onClick={() => choose(id)}
          >
            {id === 'browse'
              ? t('desktop.browse')
              : id === 'number'
                ? t('search.number')
                : t('search.songs')}
          </button>
        ))}
      </div>

      {tab === 'browse' && <BrowsePanel active />}
      {tab === 'number' && deep !== undefined && (
        <Keypad
          books={filteredBooks.length ? filteredBooks : books}
          active
          desktopOnly
          initial={deep}
        />
      )}
      {tab === 'songs' && <SongListPanel active />}
    </div>
  );
}
