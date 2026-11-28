import { useEffect, useMemo, useState } from 'preact/hooks';
import { t } from '../../i18n';
import type { BookBundle, BookBundleSong } from '../../lib/book-bundle';
import { decodeSet } from '../../lib/setlist';
import { loadNumbers } from '../../lib/search';
import { LANG_TAG } from '../../lib/scripts';
import type { Lang } from '../../lib/schema';
import { setKeepAwake } from '../../lib/wakelock';
import {
  decodeWorshipSet,
  getSet,
  hydrateSets,
  v1ToWorshipSet,
  type WorshipSet,
} from '../../lib/sets';
import {
  buildRunSheet,
  buildSlides,
  parseRepeatMarker,
  type BuiltSlide,
  type RunSheetSong,
} from '../../lib/sets/runsheet';
import { site } from '../../site.config';

type PresentTheme = 'leather' | 'black' | 'white';
const THEME_KEY = 'stuti:presentTheme';

function bundleToRunSong(id: string, song: BookBundleSong): RunSheetSong {
  return {
    id,
    title: { native: song.t[0], roman: song.t[1], en: song.t[2] },
    numbers: song.nums.map(([book, number]) => ({ book, number })),
    lang: song.lang,
    sections: song.sec.map((s) => ({
      type: s.type,
      label: s.label,
      lines: s.lines.map(([n, r, e]) => {
        const p = parseRepeatMarker(n);
        return { n: p.t, r, e, ...(p.x > 1 ? { x: p.x } : {}) };
      }),
    })),
  };
}

async function loadBundles(): Promise<Map<string, BookBundleSong>> {
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
  return byId;
}

function setFromParams(): WorshipSet | null {
  const p = new URLSearchParams(location.search);
  const id = p.get('id');
  if (id) {
    hydrateSets();
    return getSet(id) ?? null;
  }
  const setCode = p.get('set');
  if (!setCode) return null;
  const v2 = decodeWorshipSet(setCode);
  if (v2) return v2;
  const v1 = decodeSet(setCode);
  return v1 ? v1ToWorshipSet(v1) : null;
}

export default function PresentApp() {
  const [slides, setSlides] = useState<BuiltSlide[]>([]);
  const [i, setI] = useState(0);
  const [error, setError] = useState('');
  const [blank, setBlank] = useState(false);
  const [whiteout, setWhiteout] = useState(false);
  const [layers, setLayers] = useState({ n: true, r: false, e: false });
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
    const start = Number(p.get('i') ?? 0);

    const load = async () => {
      try {
        const byId = await loadBundles();
        const worship = setFromParams();

        if (worship) {
          const map: Record<string, RunSheetSong> = {};
          for (const row of worship.rows) {
            if (row.k !== 's') continue;
            const song = byId.get(row.song);
            if (song) map[row.song] = bundleToRunSong(row.song, song);
          }
          const sheet = buildRunSheet(worship, map);
          const built = buildSlides(sheet, {
            set: worship,
            church: site.name,
            layers: { n: true, r: true, e: false },
          });
          if (!built.length) throw new Error('empty');
          setSlides(built);
          setI(Math.min(Math.max(0, start), built.length - 1));
          return;
        }

        if (!songId) throw new Error('none');
        const song = byId.get(songId);
        if (!song) throw new Error('missing');
        const fake: WorshipSet = {
          v: 2.1,
          id: 'present-one',
          title: song.t[0],
          date: new Date().toISOString().slice(0, 10),
          service: 'other',
          rows: [{ k: 's', id: 's1', song: songId, book: song.nums[0]?.[0] ?? 'TLBC' }],
          items: [{ kind: 'song', uid: 's1', songId, book: song.nums[0]?.[0] }],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const sheet = buildRunSheet(fake, { [songId]: bundleToRunSong(songId, song) });
        const built = buildSlides(sheet, { set: fake, church: site.name });
        setSlides(built);
        setI(Math.min(Math.max(0, start), built.length - 1));
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
        if (history.length > 1) history.back();
        else location.assign('/');
        return;
      }
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        setI((n) => Math.min(n + 1, slides.length - 1));
        setBlank(false);
        setWhiteout(false);
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setI((n) => Math.max(n - 1, 0));
        setBlank(false);
        setWhiteout(false);
      }
      if (e.key === 'Home') setI(0);
      if (e.key === 'End') setI(slides.length - 1);
      if (e.key === 'b' || e.key === 'B') {
        setBlank((v) => !v);
        setWhiteout(false);
      }
      if (e.key === 'w' || e.key === 'W') {
        setWhiteout((v) => !v);
        setBlank(false);
      }
      if (e.key === 'l' || e.key === 'L') setLayers((l) => ({ ...l, r: !l.r }));
      if (e.key === 'c' || e.key === 'C') setLayers((l) => ({ ...l, n: !l.n }));
      if (e.key === 'n' || e.key === 'N') setLayers((l) => ({ ...l, e: !l.e }));
      if (/^[1-9]$/.test(e.key)) {
        const songSlides = slides
          .map((s, idx) => ({ s, idx }))
          .filter((x) => x.s.kind === 'lyrics');
        const songIds = [...new Set(songSlides.map((x) => (x.s.kind === 'lyrics' ? x.s.songId : '')))];
        const target = songIds[Number(e.key) - 1];
        if (target) {
          const hit = songSlides.find((x) => x.s.kind === 'lyrics' && x.s.songId === target);
          if (hit) setI(hit.idx);
        }
      }
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
  }, [slides]);

  const slide = slides[i];
  const next = slides[i + 1];
  const nextLabel = useMemo(() => {
    if (!next) return '';
    if (next.kind === 'title') return next.title;
    if (next.kind === 'section') return next.label;
    if (next.kind === 'item') return next.title;
    if (next.kind === 'custom') return next.title || (next.style === 'blank' ? 'Blank slide' : 'Slide');
    if (next.kind === 'note') return `${next.stanza} · Note`;
    return `Song · ${next.book} ${next.no}`;
  }, [next]);

  if (error) {
    return (
      <div class="present present--error">
        <p>{error}</p>
        <a href="/downloads/">{t('nav.offline')}</a>
      </div>
    );
  }
  if (!slide) return <div class="present present--loading">{t('desktop.loading')}</div>;

  const overlay = blank ? ' is-blank' : whiteout ? ' is-whiteout' : '';

  return (
    <div
      class={`present present--${theme}${overlay}${hideChrome ? ' is-chrome-hidden' : ''}`}
      onClick={() => {
        setI((n) => Math.min(n + 1, slides.length - 1));
        setBlank(false);
        setWhiteout(false);
      }}
    >
      <div class="present__top">
        {slide.kind === 'lyrics' ? (
          <>
            <span class="present__badge">
              {slide.book} {slide.no}
            </span>
            <span class="present__sec">{slide.tag}</span>
          </>
        ) : (
          <span class="present__sec">{slide.kind.toUpperCase()}</span>
        )}
        <a
          class="present__exit"
          href="/"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (history.length > 1) history.back();
            else location.assign('/');
          }}
        >
          {t('desktop.exitPresent')}
        </a>
      </div>
      <div class="present__stage" style={{ transform: `scale(${scale})` }}>
        {slide.kind === 'title' ? (
          <>
            <p class="present__line">
              <span class="present__n">{slide.title}</span>
            </p>
            <p class="present__line">
              <span class="present__r">{slide.sub}</span>
            </p>
          </>
        ) : null}
        {slide.kind === 'section' ? (
          <p class="present__line">
            <span class="present__n">{slide.label}</span>
          </p>
        ) : null}
        {slide.kind === 'item' ? (
          <>
            <p class="present__line">
              <span class="present__n">{slide.title}</span>
            </p>
            {slide.sub ? (
              <p class="present__line">
                <span class="present__r">{slide.sub}</span>
              </p>
            ) : null}
          </>
        ) : null}
        {slide.kind === 'custom' && slide.style !== 'blank' ? (
          <>
            {slide.title ? (
              <p class="present__line">
                <span class="present__n">{slide.title}</span>
              </p>
            ) : null}
            {slide.body ? (
              <p class="present__line">
                <span class="present__r">{slide.body}</span>
              </p>
            ) : null}
          </>
        ) : null}
        {slide.kind === 'note' ? (
          <>
            <p class="present__line">
              <span class="present__r">
                {slide.book} {slide.no} · {slide.stanza}
              </span>
            </p>
            <p class="present__line">
              <span class="present__n">{slide.text}</span>
            </p>
          </>
        ) : null}
        {slide.kind === 'lyrics' && slide.note ? (
          <p class="present__line">
            <span class="present__r">{slide.note}</span>
          </p>
        ) : null}
        {slide.kind === 'lyrics'
          ? slide.lines.map((l) => (
              <p class="present__line">
                {layers.n && l.t ? (
                  <span class="present__n" lang={LANG_TAG.n[(slide.script as Lang) ?? 'hi'] ?? 'en'}>
                    {l.t}
                    {l.x > 1 ? ` ×${l.x}` : ''}
                  </span>
                ) : null}
              </p>
            ))
          : null}
        {slide.kind === 'lyrics' && layers.r && slide.roman?.length
          ? slide.roman.map((r) => (
              <p class="present__line">
                <span class="present__r">{r}</span>
              </p>
            ))
          : null}
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
          {i + 1}/{slides.length}
          {nextLabel ? ` · Next: ${nextLabel}` : ''}
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
