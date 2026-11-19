import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { isDesktopViewport, parseSongHtml, type SongPreview } from '../../lib/desktop';

type OpenDetail = { url: string; replace?: boolean };

/**
 * Right-hand song pane on desktop list pages (search, books, set).
 * Intercepts song links, fetches the static song page, and re-renders lyrics as text
 * (no HTML injection). Without JS, those links navigate normally.
 */
export default function DesktopPreview() {
  const [song, setSong] = useState<SongPreview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const host = document.querySelector<HTMLElement>('[data-song-preview]');
    if (!host) return;

    const show = async (url: string, replace = false) => {
      if (!isDesktopViewport()) {
        location.assign(url);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(String(res.status));
        const parsed = parseSongHtml(await res.text(), url);
        if (!parsed) throw new Error('parse');
        setSong(parsed);
        host.classList.add('is-filled');
        history[replace ? 'replaceState' : 'pushState']({ stutiPreview: url }, '', url);
      } catch {
        setError(t('desktop.previewError'));
        setSong(null);
        host.classList.remove('is-filled');
      } finally {
        setLoading(false);
      }
    };

    const onOpen = (e: Event) => {
      const { url, replace } = (e as CustomEvent<OpenDetail>).detail;
      if (url) void show(url, replace);
    };

    const onClick = (e: MouseEvent) => {
      if (
        !isDesktopViewport() ||
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey
      )
        return;
      // Only song rows (search hits, book index, set items) — not "Start singing" or other actions.
      const a = (e.target as Element | null)?.closest?.(
        'a.song-row[href*="/song/"]',
      ) as HTMLAnchorElement | null;
      if (!a || a.closest('[data-no-preview]')) return;
      if (!a.closest('[data-desktop-source]')) return;
      e.preventDefault();
      void show(a.href);
    };

    const onPop = () => {
      if (/\/song\//.test(location.pathname)) void show(location.href, true);
      else {
        setSong(null);
        host.classList.remove('is-filled');
      }
    };

    addEventListener('stuti:open-song', onOpen);
    addEventListener('click', onClick);
    addEventListener('popstate', onPop);
    // Restore preview if the user landed on a list page after a desktop pushState to a song URL.
    if (/\/song\//.test(location.pathname) && isDesktopViewport()) void show(location.href, true);

    return () => {
      removeEventListener('stuti:open-song', onOpen);
      removeEventListener('click', onClick);
      removeEventListener('popstate', onPop);
    };
  }, []);

  useEffect(() => {
    const host = document.querySelector('[data-song-preview]');
    if (!host) return;
    if (song) host.classList.add('is-filled');
    else if (!loading) host.classList.remove('is-filled');
  }, [song, loading]);

  if (!song && !loading && !error) return null;

  return (
    <>
      {loading && <p class="muted">{t('desktop.loading')}</p>}
      {error && (
        <p class="notice" role="alert">
          {error}
        </p>
      )}
      {song && (
        <article class="song-preview">
          <div class="shell__preview-head">
            <div>
              <h2 class="shell__preview-title" lang={song.titleLang}>
                {song.title}
              </h2>
              {song.subtitle && <p class="shell__preview-sub">{song.subtitle}</p>}
            </div>
            <a class="btn btn--small" href={song.url} data-no-preview>
              {t('desktop.openFull')}
            </a>
          </div>
          <div class="lyrics has-r has-e">
            {song.sections.map((sec) => (
              <section class={`sec${sec.chorus ? ' sec--chorus' : ''}`} aria-label={sec.label}>
                {sec.label && <h3 class="sec__label">{sec.label}</h3>}
                {sec.lines.map((line) => (
                  <p class="line">
                    {line.n && (
                      <span class="n" lang={line.nLang}>
                        {line.n}
                      </span>
                    )}
                    {line.r && (
                      <span class="r" lang={line.rLang}>
                        {line.r}
                      </span>
                    )}
                    {line.e && (
                      <span class="e" lang="en">
                        {line.e}
                      </span>
                    )}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </article>
      )}
    </>
  );
}
