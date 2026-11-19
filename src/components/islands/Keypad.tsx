import { useEffect, useMemo, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { LANG_TAG } from '../../lib/scripts';
import type { Lang } from '../../lib/schema';
import {
  loadMeta,
  loadNumbers,
  lookupNumber,
  numberVariants,
  type MetaRow,
  type NumbersMap,
} from '../../lib/search';
import { songUrl } from '../../lib/songs';
import { storage, updatePrefs } from '../../lib/storage';
import { site } from '../../site.config';

export type BookChip = { id: string; native: string; en: string; lang: Lang; numbering: 'numeric' | 'alnum' };

type Props = {
  books: BookChip[];
  active: boolean;
  /** From the deep link ?book=&n= (already applied once by the parent). */
  initial?: { book?: string; n?: string };
  /** Finder keypad: ignore keys unless the desktop shell is active (mobile keeps SearchTabs). */
  desktopOnly?: boolean;
};

const MAX = site.search.maxDigits;

/** Full navigation: the singer is done typing and wants the song page (toolbar, set, wake lock). */
const openSong = (id: string, book: string) => location.assign(`${songUrl(id)}?from=${book.toLowerCase()}`);

export default function Keypad({ books, active, initial, desktopOnly = false }: Props) {
  const findBook = (id?: string | null) => books.find((b) => b.id.toLowerCase() === id?.toLowerCase());
  const [bookId, setBookId] = useState(
    () => (findBook(initial?.book) ?? findBook(site.defaultBookId) ?? books[0])?.id ?? '',
  );
  const [digits, setDigits] = useState(() => (initial?.n ?? '').replace(/\D/g, '').slice(0, MAX));
  const [variant, setVariant] = useState<string | null>(null);
  const [order, setOrder] = useState(books.map((b) => b.id));
  const [numbers, setNumbers] = useState<NumbersMap | null>(null);
  const [meta, setMeta] = useState<Record<string, MetaRow> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const last = findBook(storage.prefs.get().lastBookId);
    // Last-used book first; the rest keep the book `order`.
    if (last) setOrder([last.id, ...books.map((b) => b.id).filter((id) => id !== last.id)]);
    if (last && !initial?.book) setBookId(last.id);
    Promise.all([loadNumbers(), loadMeta()])
      .then(([n, m]) => {
        setNumbers(n);
        setMeta(m);
      })
      .catch(() => setFailed(true));
  }, []);

  const book = findBook(bookId);
  const variants = useMemo(
    () => (numbers && book?.numbering === 'alnum' ? numberVariants(numbers, bookId, digits) : []),
    [numbers, bookId, digits],
  );
  const number = variant ?? digits;
  const matchId = numbers && number ? lookupNumber(numbers, bookId, number) : undefined;
  const match = matchId ? meta?.[matchId] : undefined;

  const type = (d: string) => {
    setVariant(null);
    setDigits((cur) => (cur.length >= MAX ? cur : cur + d));
  };
  const back = () => {
    setVariant(null);
    setDigits((cur) => cur.slice(0, -1));
  };
  const open = () => {
    if (matchId) openSong(matchId, bookId);
  };
  const pickBook = (id: string) => {
    setBookId(id);
    setVariant(null);
    updatePrefs({ lastBookId: id });
  };

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (desktopOnly && !document.documentElement.hasAttribute('data-desktop')) return;
      const el = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || el?.closest('input, textarea, select')) return;
      if (/^\d$/.test(e.key)) type(e.key);
      else if (e.key === 'Backspace') back();
      else if (e.key === 'Enter' && !el?.closest('button, a')) open();
      else if (e.key === 'Escape') setDigits('');
      else return;
      e.preventDefault();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  let status: string;
  if (failed) status = t('search.loadError');
  else if (!digits) status = t('search.typeNumber');
  else if (match) status = match[0];
  else if (!numbers) status = t('search.searching');
  else status = t('search.noNumber', { book: bookId });

  return (
    <div class="keypad-panel">
      <div class="book-chips" role="group" aria-label={t('search.book')}>
        {order.map((id) => {
          const b = findBook(id)!;
          return (
            <button
              type="button"
              class="chip"
              aria-pressed={id === bookId ? 'true' : 'false'}
              onClick={() => pickBook(id)}
              title={b.en}
            >
              {b.id}
            </button>
          );
        })}
      </div>

      <div class="num-display">
        <p class="num-display__book" lang={book ? LANG_TAG.n[book.lang] : undefined}>
          {book?.native}
        </p>
        <p class="num-display__digits" aria-hidden="true">
          {number || '\u00a0'}
        </p>
        <p
          class={`num-display__match${match ? ' is-match' : ''}`}
          lang={match ? LANG_TAG.n[match[2] as Lang] : undefined}
          aria-live="polite"
          data-testid="number-status"
        >
          {status}
        </p>
        {variants.length > 1 && (
          <div class="chips num-display__variants" role="group" aria-label={t('search.variants')}>
            {variants.map((v) => (
              <button
                type="button"
                class="chip"
                aria-pressed={v === number ? 'true' : 'false'}
                onClick={() => setVariant(v)}
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </div>

      <div class="keypad" role="group" aria-label={t('search.number')}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button type="button" class="key" onClick={() => type(d)}>
            {d}
          </button>
        ))}
        <button type="button" class="key key--fn" aria-label={t('search.backspace')} onClick={back}>
          <span aria-hidden="true">⌫</span>
        </button>
        <button type="button" class="key" onClick={() => type('0')}>
          0
        </button>
        <button type="button" class="key key--open" disabled={!matchId} onClick={open}>
          {t('search.open')}
        </button>
      </div>
    </div>
  );
}
