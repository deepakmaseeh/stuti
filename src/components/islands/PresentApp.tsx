import { useEffect, useMemo, useState } from 'preact/hooks';
import { t } from '../../i18n';
import type { BookBundle, BookBundleSong } from '../../lib/book-bundle';
import { expandSections } from '../../lib/pptx-export';
import { decodeSet } from '../../lib/setlist';
import { loadNumbers } from '../../lib/search';
import { setKeepAwake } from '../../lib/wakelock';

type PresentTheme = 'leather' | 'black' | 'white';
const THEME_KEY = 'stuti:presentTheme';

type Slide = {
  songId: string;
  title: string;
  badge: string;
  label: string;
  lines: [string, string, string][];
  lang: string;
};

function expandSlides(id: string, song: BookBundleSong): Slide[] {
  const badge = song.nums[0] ? `${song.nums[0][0]} ${song.nums[0][1]}` : '';
  const title = song.t[0];
  return expandSections(song).map((sec) => ({
    songId: id,
    title,
    badge,
    label: sec.label,
    lines: sec.lines,
    lang: song.lang,
  }));
}

export default function PresentApp() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [i, setI] = useState(0);
  const [error, setError] = useState('');
  const [blank, setBlank] = useState(false);
  const [layers, setLayers] = useState({ n: true, r: true, e: true });
  const [scale, setScale] = useState(1);
  const [hideChrome, setHideChrome] = useState(false);
  const [theme, setTheme] = useState<PresentTheme>('leather');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY) as PresentTheme | null;
      if (saved === 'leather' || saved === 'black' || saved === 'white') setTheme(saved);
    } catch {
      /* ignore */
    }

    const p = new URLSearchParams(location.search);
    const songId = p.get('song');
    const setCode = p.get('set');
    const start = Number(p.get('i') ?? 0);

    const load = async () => {
      try {
        const ids: string[] = [];
        if (setCode) {
          const set = decodeSet(setCode);
          if (!set?.s.length) throw new Error('set');
          ids.push(...set.s.map((s) => s.id));
        } else if (songId) ids.push(songId);
        else throw new Error('none');

        const numbers = await loadNumbers();
        const bookIds = Object.keys(numbers);
        const bundles = await Promise.all(
          bookIds.map((b) =>
            fetch(`/data/books/${b}.json`)
              .then((r) => (r.ok ? (r.json() as Promise<BookBundle>) : null))
              .catch(() => null),
          ),
        );
        const byId = new Map<string, BookBundleSong>();
        for (const bundle of bundles) {
          if (!bundle) continue;
          for (const [id, song] of Object.entries(bundle.songs)) byId.set(id, song);
        }

        const all: Slide[] = [];
        const missingBooks = new Set<string>();
        for (const id of ids) {
          const song = byId.get(id);
          if (!song) {
            const bookGuess = id.split('-')[0]?.toUpperCase();
            if (bookGuess) missingBooks.add(bookGuess);
            continue;
          }
          all.push(...expandSlides(id, song));
        }
        if (!all.length) {
          setError(
            missingBooks.size
              ? `Download ${[...missingBooks].join(', ')} to present offline`
              : t('desktop.previewError'),
          );
          return;
        }
        setSlides(all);
        setI(Math.min(Math.max(0, start), all.length - 1));
      } catch {
        setError(t('desktop.previewError'));
      }
    };

    void load();
    document.documentElement.requestFullscreen?.().catch(() => {});
    setKeepAwake(true).catch(() => {});

    let timer: ReturnType<typeof setTimeout>;
    const bump = () => {
      setHideChrome(false);
      clearTimeout(timer);
      timer = setTimeout(() => setHideChrome(true), 3000);
    };
    bump();
    addEventListener('mousemove', bump);
    return () => {
      removeEventListener('mousemove', bump);
      clearTimeout(timer);
      setKeepAwake(false).catch(() => {});
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        history.length > 1 ? history.back() : location.assign('/');
        return;
      }
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        setI((n) => Math.min(n + 1, slides.length - 1));
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setI((n) => Math.max(n - 1, 0));
      }
      if (e.key === 'Home') setI(0);
      if (e.key === 'End') setI(slides.length - 1);
      if (e.key === 'b' || e.key === 'B') setBlank((v) => !v);
      if (e.key === 'n' || e.key === 'N') setLayers((l) => ({ ...l, n: !l.n }));
      if (e.key === 'r' || e.key === 'R') setLayers((l) => ({ ...l, r: !l.r }));
      if (e.key === 'e' || e.key === 'E') setLayers((l) => ({ ...l, e: !l.e }));
      if (e.key === '+' || e.key === '=') setScale((s) => Math.min(1.4, s + 0.1));
      if (e.key === '-' || e.key === '_') setScale((s) => Math.max(0.6, s - 0.1));
      if (e.key === 't' || e.key === 'T') {
        setTheme((cur) => {
          const next: PresentTheme = cur === 'leather' ? 'black' : cur === 'black' ? 'white' : 'leather';
          try {
            localStorage.setItem(THEME_KEY, next);
          } catch {
            /* ignore */
          }
          return next;
        });
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [slides.length]);

  const slide = slides[i];
  const songIndex = useMemo(() => {
    if (!slide) return { cur: 0, total: 0, nextLabel: '' };
    const ids = [...new Set(slides.map((s) => s.songId))];
    const next = slides[i + 1];
    return {
      cur: ids.indexOf(slide.songId) + 1,
      total: ids.length,
      nextLabel: next ? next.label : '',
    };
  }, [slide, slides, i]);

  if (error) {
    return (
      <div class="present present--error">
        <p>{error}</p>
        <a href="/downloads/">{t('nav.offline')}</a>
      </div>
    );
  }
  if (!slide) return <div class="present present--loading">{t('desktop.loading')}</div>;

  return (
    <div
      class={`present present--${theme}${blank ? ' is-blank' : ''}${hideChrome ? ' is-chrome-hidden' : ''}`}
      onClick={() => setI((n) => Math.min(n + 1, slides.length - 1))}
    >
      <div class="present__top">
        <span class="present__badge">{slide.badge}</span>
        <span class="present__song">{slide.title}</span>
        <span class="present__sec">{slide.label}</span>
        <a
          class="present__exit"
          href="/"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            history.length > 1 ? history.back() : location.assign('/');
          }}
        >
          {t('desktop.exitPresent')}
        </a>
      </div>
      <div class="present__stage" style={{ transform: `scale(${scale})` }}>
        {slide.lines.map(([n, r, e]) => (
          <p class="present__line">
            {layers.n && n && <span class="present__n">{n}</span>}
            {layers.r && r && <span class="present__r">{r}</span>}
            {layers.e && e && <span class="present__e">{e}</span>}
          </p>
        ))}
      </div>
      <div class="present__bottom">
        <button
          type="button"
          class="present__nav"
          aria-label={t('set.prev')}
          onClick={(e) => {
            e.stopPropagation();
            setI((n) => Math.max(n - 1, 0));
          }}
        >
          ‹
        </button>
        <div class="present__dots">
          {slides.map((_, k) => (
            <i class={k === i ? 'is-on' : undefined} />
          ))}
        </div>
        <span class="present__progress">
          Song {songIndex.cur}/{songIndex.total}
          {songIndex.nextLabel ? ` · Next: ${songIndex.nextLabel}` : ''}
        </span>
        <button
          type="button"
          class="present__nav"
          aria-label={t('set.next')}
          onClick={(e) => {
            e.stopPropagation();
            setI((n) => Math.min(n + 1, slides.length - 1));
          }}
        >
          ›
        </button>
      </div>
    </div>
  );
}
