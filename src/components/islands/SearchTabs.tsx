import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { loadNumbers, lookupNumber } from '../../lib/search';
import { songUrl } from '../../lib/songs';
import { storage, updatePrefs } from '../../lib/storage';
import Keypad, { type BookChip } from './Keypad';
import WordSearch from './WordSearch';

type Tab = 'number' | 'words';
type Deep = { book?: string; n?: string; q?: string };

const TABS: Tab[] = ['number', 'words'];

export default function SearchTabs({ books }: { books: BookChip[] }) {
  // Server render: Number tab. The real tab/deep link is applied after mount.
  const [tab, setTab] = useState<Tab>('number');
  const [deep, setDeep] = useState<Deep | null>(null);
  // Arrow-key tab switching keeps focus on the tabs; clicks and page load focus the search box.
  const [focusInput, setFocusInput] = useState(true);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const d: Deep = {
      book: p.get('book') ?? undefined,
      n: p.get('n') ?? undefined,
      q: p.get('q') ?? undefined,
    };
    if (d.book && d.n) {
      // /search/?book=DT&n=117 opens the song straight away when the number exists.
      loadNumbers()
        .then((map) => {
          const id = lookupNumber(map, d.book!, d.n!);
          if (id) location.replace(`${songUrl(id)}?from=${d.book!.toLowerCase()}`);
        })
        .catch(() => {});
      setTab('number');
    } else if (d.q || p.get('tab') === 'words') setTab('words');
    else setTab(storage.prefs.get().lastTab);
    setDeep(d);
  }, []);

  const choose = (next: Tab, focus = false) => {
    setTab(next);
    setFocusInput(!focus);
    updatePrefs({ lastTab: next });
    if (focus) tabRefs.current[TABS.indexOf(next)]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    choose(tab === 'number' ? 'words' : 'number', true);
  };

  return (
    <div class="search">
      <div class="segmented" role="tablist" aria-label={t('search.title')} onKeyDown={onKeyDown}>
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
            {t(id === 'number' ? 'search.number' : 'search.words')}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="panel-number" aria-labelledby="tab-number" hidden={tab !== 'number'}>
        {/* Keyed on the deep link so a ?book=&n= arriving after mount re-seeds the keypad. */}
        <Keypad
          key={`${deep?.book}-${deep?.n}`}
          books={books}
          active={tab === 'number'}
          initial={deep ?? undefined}
        />
      </div>
      <div role="tabpanel" id="panel-words" aria-labelledby="tab-words" hidden={tab !== 'words'}>
        {deep && <WordSearch active={tab === 'words'} autoFocus={focusInput} initialQuery={deep.q} />}
      </div>
    </div>
  );
}
