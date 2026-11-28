import { useEffect, useState } from 'preact/hooks';
import { ArrowLeft, Printer } from 'lucide-preact';
import type { BookBundle, BookBundleSong } from '../../lib/book-bundle';
import { loadMeta } from '../../lib/search';
import { getSet, hydrateSets } from '../../lib/sets';
import { parseRepeatMarker } from '../../lib/sets/runsheet';
import { site } from '../../site.config';

type PrintSong = {
  id: string;
  book: string;
  number: string;
  song: BookBundleSong;
};

export default function LyricsPrintApp() {
  const [songs, setSongs] = useState<PrintSong[] | null>(null);
  const [error, setError] = useState('');
  const [showRoman, setShowRoman] = useState(false);
  const [backHref, setBackHref] = useState('/');
  const [heading, setHeading] = useState('Lyrics PDF');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const songId = params.get('song');
    const setId = params.get('set');

    const load = async () => {
      try {
        const meta = await loadMeta();
        let targetIds: string[] = [];

        if (songId) {
          targetIds = [songId];
          setBackHref(`/song/${encodeURIComponent(songId)}/`);
        } else if (setId) {
          hydrateSets();
          const set = getSet(setId);
          if (!set) {
            setError('Set not found on this device.');
            return;
          }
          setBackHref(`/sets/`);
          setHeading(`${set.title} · Lyrics`);
          targetIds = (set.rows ?? [])
            .filter((r): r is Extract<typeof r, { k: 'song' }> => r.k === 'song')
            .map((r) => r.songId);
        } else {
          setError('No song or set specified.');
          return;
        }

        const booksNeeded = new Set<string>();
        for (const id of targetIds) {
          const m = meta[id];
          const [b] = (m?.[3] ?? '').trim().split(/\s+/);
          if (b) booksNeeded.add(b);
        }

        const bundles: Record<string, BookBundle> = {};
        await Promise.all(
          [...booksNeeded].map(async (b) => {
            const res = await fetch(`/data/books/${encodeURIComponent(b)}.json`);
            if (res.ok) {
              bundles[b] = (await res.json()) as BookBundle;
            }
          }),
        );

        const loaded: PrintSong[] = [];
        for (const id of targetIds) {
          const m = meta[id];
          const [b, n = ''] = (m?.[3] ?? '').trim().split(/\s+/);
          const s = b ? bundles[b]?.songs?.[id] : undefined;
          if (s && b) {
            loaded.push({ id, book: b, number: n, song: s });
          }
        }
        if (!loaded.length) {
          setError('No songs found to print.');
          return;
        }
        if (songId && loaded[0]) {
          setHeading(`${loaded[0].book} ${loaded[0].number} · ${loaded[0].song.t[0]}`);
        }
        setSongs(loaded);
      } catch {
        setError('Could not load song lyrics.');
      }
    };

    void load();
  }, []);

  useEffect(() => {
    const fit = () => {
      const pages = document.querySelectorAll<HTMLElement>('.lyr-a4');
      pages.forEach((page) => {
        const wrap = page.parentElement;
        if (!wrap) return;
        const w = Math.min(innerWidth - 32, 794);
        const s = w / 794;
        page.style.transform = `scale(${s})`;
        page.style.transformOrigin = 'top left';
        wrap.style.width = `${w}px`;
        wrap.style.height = `${page.offsetHeight * s}px`;
      });
    };
    fit();
    addEventListener('resize', fit);
    const t = setTimeout(fit, 120);
    return () => {
      removeEventListener('resize', fit);
      clearTimeout(t);
    };
  }, [songs, showRoman]);

  return (
    <div class="lyr-print-root">
      <div class="lyr-print-top no-print">
        <a class="icon-btn" href={backHref} aria-label="Back">
          <ArrowLeft size={22} strokeWidth={1.75} aria-hidden="true" />
        </a>
        <div class="lyr-print-top__title">{heading}</div>
        <button
          type="button"
          class={showRoman ? 'chip' : 'chip'}
          aria-pressed={showRoman ? 'true' : 'false'}
          onClick={() => setShowRoman((v) => !v)}
        >
          Roman
        </button>
      </div>

      {error ? <p class="empty-hint">{error}</p> : null}
      {!error && !songs ? <p class="empty-hint">Loading lyrics…</p> : null}

      <div class="lyr-pages">
        {songs?.map((item) => (
          <div class="lyr-page-wrap" key={item.id}>
            <article class="lyr-a4">
              <header class="lyr-a4__head">
                <span class="lyr-a4__badge">
                  {item.book} {item.number}
                </span>
                <h2 class="lyr-a4__title">{item.song.t[0]}</h2>
                {item.song.t[1] ? <p class="lyr-a4__sub">{item.song.t[1]}</p> : null}
              </header>

              <div class="lyr-a4__body">
                {item.song.sec.map((sec, si) => {
                  const isChorus = sec.type === 'chorus' || sec.type === 'refrain';
                  return (
                    <section
                      key={`${item.id}-${si}`}
                      class={isChorus ? 'lyr-a4__sec lyr-a4__sec--chorus' : 'lyr-a4__sec'}
                    >
                      <div class="lyr-a4__sec-label">{sec.label}</div>
                      {sec.lines.map(([rawN, r], li) => {
                        const { t, x } = parseRepeatMarker(rawN);
                        return (
                          <div class="lyr-a4__line" key={li}>
                            <span class="lyr-a4__n">
                              {t}
                              {x > 1 ? <span class="lyr-a4__rep">×{x}</span> : null}
                            </span>
                            {showRoman && r ? <span class="lyr-a4__r">{r}</span> : null}
                          </div>
                        );
                      })}
                    </section>
                  );
                })}
              </div>

              <footer class="lyr-a4__foot">
                {site.name} · {item.book} {item.number}
              </footer>
            </article>
          </div>
        ))}
      </div>

      {songs?.length ? (
        <div class="lyr-print-bar no-print">
          <button type="button" class="btn btn--primary" onClick={() => window.print()}>
            <Printer size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>Print / Save as PDF</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
