import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import type { Lang } from '../../lib/schema';
import { LANG_TAG } from '../../lib/scripts';
import { loadMeta, type MetaRow } from '../../lib/search';
import { decodeSet, songInSetUrl, type SetList } from '../../lib/setlist';

const SWIPE_MIN = 60;

/** Prev / "2 of 5 · next title" / Next above the bottom nav when the song was opened from a set. */
export default function SetNavBar() {
  const [ctx, setCtx] = useState<{ set: SetList; code: string; i: number } | null>(null);
  const [meta, setMeta] = useState<Record<string, MetaRow> | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const code = p.get('set');
    const set = code ? decodeSet(code) : null;
    const i = Number(p.get('i') ?? 0);
    if (!code || !set || !set.s.length || !Number.isInteger(i) || i < 0 || i >= set.s.length) return;
    setCtx({ set, code, i });
    document.body.classList.add('has-setnav');
    loadMeta()
      .then(setMeta)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!ctx) return;
    const lyrics = document.querySelector<HTMLElement>('.lyrics');
    if (!lyrics) return;
    let x0 = 0;
    let y0 = 0;
    const down = (e: TouchEvent) => {
      x0 = e.touches[0]!.clientX;
      y0 = e.touches[0]!.clientY;
    };
    const up = (e: TouchEvent) => {
      const dx = e.changedTouches[0]!.clientX - x0;
      const dy = e.changedTouches[0]!.clientY - y0;
      // Horizontal swipes only: ignore anything that was mostly a vertical scroll.
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
  const { set, code, i } = ctx;
  const n = set.s.length;
  function go(to: number) {
    if (to >= 0 && to < n) location.assign(songInSetUrl(set, code, to));
  }
  const next = set.s[i + 1];
  const nextRow = next ? meta?.[next.id] : undefined;

  return (
    <nav class="setnav" aria-label={set.t}>
      {i > 0 ? (
        <a class="setnav__btn" href={songInSetUrl(set, code, i - 1)} rel="prev" data-set-prev>
          ‹ {t('set.prev')}
        </a>
      ) : (
        <a class="setnav__btn" href={`/set/#s=${code}`} data-set-prev>
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
        <a class="setnav__btn setnav__btn--next" href={songInSetUrl(set, code, i + 1)} rel="next" data-set-next>
          {t('set.next')} ›
        </a>
      ) : (
        <a class="setnav__btn" href={`/set/#s=${code}`} data-set-next>
          {t('nav.set')} ›
        </a>
      )}
    </nav>
  );
}
