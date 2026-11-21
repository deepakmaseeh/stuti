import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import type { Lang } from '../../lib/schema';
import { LANG_TAG } from '../../lib/scripts';
import { loadMeta, type MetaRow } from '../../lib/search';
import {
  decodeWorshipSet,
  getSet,
  hydrateSets,
  songInWorshipSetUrl,
  songItems,
  type WorshipSet,
} from '../../lib/sets';
import { decodeSet } from '../../lib/setlist';

const SWIPE_MIN = 60;

type Ctx = { set: WorshipSet; i: number; sharedCode?: string };

function readCtx(): Ctx | null {
  const p = new URLSearchParams(location.search);
  const i = Number(p.get('i') ?? 0);
  if (!Number.isInteger(i) || i < 0) return null;

  const setId = p.get('set');
  // v2: stored set id (UUID or id-… fallback), not a long base64 share blob
  if (setId && (setId.startsWith('id-') || /^[0-9a-f]{8}-[0-9a-f-]{4,}$/i.test(setId))) {
    hydrateSets();
    const set = getSet(setId);
    const songs = set ? songItems(set) : [];
    if (set && songs.length && i < songs.length) return { set, i };
  }
  // Any short set id that exists locally
  if (setId && setId.length < 80 && !setId.includes('.')) {
    hydrateSets();
    const set = getSet(setId);
    const songs = set ? songItems(set) : [];
    if (set && songs.length && i < songs.length) return { set, i };
  }

  const shared = p.get('shared');
  if (shared) {
    const set = decodeWorshipSet(shared);
    const songs = set ? songItems(set) : [];
    if (set && songs.length && i < songs.length) return { set, i, sharedCode: shared };
  }

  // Legacy v1: ?set=<base64 share code>
  if (setId && decodeSet(setId)) {
    const set = decodeWorshipSet(setId);
    const songs = set ? songItems(set) : [];
    if (set && songs.length && i < songs.length) return { set, i, sharedCode: setId };
  }
  return null;
}

/** Prev / "2 of 5" / Next when the song was opened from a set. */
export default function SetNavBar() {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [meta, setMeta] = useState<Record<string, MetaRow> | null>(null);

  useEffect(() => {
    const sync = () => {
      const next = readCtx();
      setCtx(next);
      document.body.classList.toggle('has-setnav', !!next);
    };
    sync();
    loadMeta().then(setMeta).catch(() => {});
    document.addEventListener('astro:page-load', sync);
    return () => document.removeEventListener('astro:page-load', sync);
  }, []);

  useEffect(() => {
    if (!ctx) return;
    const lyrics = document.querySelector<HTMLElement>('.lyrics');
    if (!lyrics) return;
    let x0 = 0;
    let y0 = 0;
    const songs = songItems(ctx.set);
    const go = (to: number) => {
      if (to >= 0 && to < songs.length) {
        location.assign(songInWorshipSetUrl(ctx.set, to, ctx.sharedCode));
      }
    };
    const down = (e: TouchEvent) => {
      x0 = e.touches[0]!.clientX;
      y0 = e.touches[0]!.clientY;
    };
    const up = (e: TouchEvent) => {
      const dx = e.changedTouches[0]!.clientX - x0;
      const dy = e.changedTouches[0]!.clientY - y0;
      if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      go(dx < 0 ? ctx.i + 1 : ctx.i - 1);
    };
    lyrics.addEventListener('touchstart', down, { passive: true });
    lyrics.addEventListener('touchend', up, { passive: true });
    return () => {
      lyrics.removeEventListener('touchstart', down);
      lyrics.removeEventListener('touchend', up);
    };
  }, [ctx]);

  if (!ctx) return null;
  const songs = songItems(ctx.set);
  const n = songs.length;
  const { set, i, sharedCode } = ctx;
  const next = songs[i + 1];
  const nextRow = next ? meta?.[next.songId] : undefined;
  const backHref = sharedCode ? `/sets/view/#s=${sharedCode}` : `/sets/edit/?id=${set.id}`;

  return (
    <nav class="setnav" aria-label={set.title}>
      {i > 0 ? (
        <a class="setnav__btn" href={songInWorshipSetUrl(set, i - 1, sharedCode)} rel="prev" data-set-prev data-astro-reload>
          ‹ {t('set.prev')}
        </a>
      ) : (
        <a class="setnav__btn" href={backHref} data-set-prev data-astro-reload>
          ‹ {t('nav.set')}
        </a>
      )}
      <span class="setnav__mid">
        <span class="setnav__count">{t('set.of', { i: i + 1, n })}</span>
        {nextRow && (
          <span class="setnav__next" lang={LANG_TAG.n[nextRow[2] as Lang]}>
            {nextRow[0]}
          </span>
        )}
      </span>
      {i < n - 1 ? (
        <a
          class="setnav__btn setnav__btn--next"
          href={songInWorshipSetUrl(set, i + 1, sharedCode)}
          rel="next"
          data-set-next
          data-astro-reload
        >
          {t('set.next')} ›
        </a>
      ) : (
        <a class="setnav__btn" href={backHref} data-set-next data-astro-reload>
          {t('nav.set')} ›
        </a>
      )}
    </nav>
  );
}
