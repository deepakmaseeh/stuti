import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { query, type Hit } from '../../lib/search';
import { storage } from '../../lib/storage';
import { site } from '../../site.config';
import SongHitRow from './SongHitRow';

type Props = { active: boolean; autoFocus: boolean; initialQuery?: string };

const PAGE = site.search.pageSize;

export default function WordSearch({ active, autoFocus, initialQuery = '' }: Props) {
  const [q, setQ] = useState(initialQuery);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [shown, setShown] = useState<number>(PAGE);
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (active && autoFocus) input.current?.focus();
  }, [active]);

  useEffect(() => {
    const text = q.trim();
    const mine = ++seq.current;
    if (!text) {
      setHits(null);
      return;
    }
    const timer = setTimeout(() => {
      query(text, storage.prefs.get().searchLangs)
        .then((h) => {
          if (mine !== seq.current) return;
          setHits(h);
          setShown(PAGE);
          setFailed(false);
        })
        .catch(() => mine === seq.current && setFailed(true));
    }, site.search.debounceMs);
    return () => clearTimeout(timer);
  }, [q]);

  const onInput = (value: string) => {
    setQ(value);
    const url = new URL(location.href);
    if (value.trim()) url.searchParams.set('q', value);
    else url.searchParams.delete('q');
    url.searchParams.delete('book');
    url.searchParams.delete('n');
    history.replaceState(history.state, '', url);
  };

  const missingUrl = `${site.report.missingSongUrl}&title=${encodeURIComponent(`Missing song: ${q.trim()}`)}`;

  return (
    <div class="word-panel">
      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <input
          ref={input}
          class="search-input"
          data-word-search
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCapitalize="off"
          spellcheck={false}
          aria-label={t('search.words')}
          placeholder={t('search.placeholder')}
          value={q}
          onInput={(e) => onInput(e.currentTarget.value)}
        />
      </form>

      {failed ? (
        <p class="search-help">{t('search.loadError')}</p>
      ) : hits === null ? (
        <p class="search-help">{q.trim() ? t('search.searching') : t('search.wordsHelp')}</p>
      ) : hits.length === 0 ? (
        <div class="search-help">
          <p>{t('search.none')}</p>
          <p>
            <a href={missingUrl} rel="noopener" target="_blank">
              {t('search.reportMissing')}
            </a>
          </p>
        </div>
      ) : (
        <>
          <p class="visually-hidden" aria-live="polite">
            {t('search.results', { n: hits.length })}
          </p>
          <ul class="results" data-testid="results">
            {hits.slice(0, shown).map((h) => (
              <li key={h.id}>
                <SongHitRow hit={h} />
              </li>
            ))}
          </ul>
          {hits.length > shown && (
            <button type="button" class="tool show-more" onClick={() => setShown((s) => s + PAGE)}>
              {t('search.showMore')}
            </button>
          )}
        </>
      )}
    </div>
  );
}
