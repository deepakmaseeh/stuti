import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { loadMeta, loadNumbers, type MetaRow, type NumbersMap } from '../../lib/search';
import {
  encodeForPresent,
  encodeWorshipSet,
  getActiveSet,
  hydrateSets,
  listenSetsChanged,
  removeItem,
  setShareUrl,
  songInWorshipSetUrl,
  songItems,
  updateSet,
  type WorshipSet,
} from '../../lib/sets';
import { formatSetDate } from '../../lib/setlist';
import type { BookBundle } from '../../lib/book-bundle';
import { downloadPptx } from '../../lib/pptx-export';
import { showToast } from '../../lib/toast';
import { site } from '../../site.config';
import QrSheet from './QrSheet';

export default function SetPanel({ currentId = '' }: { currentId?: string }) {
  const [desktop, setDesktop] = useState(false);
  const [active, setActive] = useState<WorshipSet | undefined>();
  const [meta, setMeta] = useState<Record<string, MetaRow> | null>(null);
  const [numbers, setNumbers] = useState<NumbersMap>({});
  const [qrOpen, setQrOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);

  useEffect(() => {
    const mq = matchMedia(`(min-width: ${site.layout.desktopMin}px)`);
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!desktop) return;
    hydrateSets();
    const refresh = () => {
      setActive(getActiveSet());
      const p = new URLSearchParams(location.search);
      const i = Number(p.get('i') ?? -1);
      setCurrentIndex(Number.isInteger(i) ? i : -1);
    };
    refresh();
    Promise.all([loadMeta(), loadNumbers()])
      .then(([m, n]) => {
        setMeta(m);
        setNumbers(n);
      })
      .catch(() => {});
    const off = listenSetsChanged(refresh);
    document.addEventListener('astro:page-load', refresh);
    return () => {
      off();
      document.removeEventListener('astro:page-load', refresh);
    };
  }, [desktop]);

  if (!desktop) return null;

  if (!active) {
    return (
      <div class="set-panel">
        <p class="muted">{t('desktop.setEmpty')}</p>
        <a class="btn btn--primary" href="/sets/">
          {t('set.newSet')}
        </a>
      </div>
    );
  }

  const songs = songItems(active);
  const code = encodeWorshipSet(active);
  const shareUrl = setShareUrl(code);
  const presentCode = encodeForPresent(active);

  const badgeFor = (songId: string, book?: string) => {
    const row = meta?.[songId];
    if (!row) return book ?? '';
    if (book && numbers[book]) {
      const n = Object.keys(numbers[book]!).find((k) => numbers[book]![k] === songId);
      if (n) return `${book} ${n}`;
    }
    return row[3];
  };

  const exportPpt = async () => {
    showToast(t('desktop.preparingPpt'));
    try {
      const book = songs[0]?.book ?? site.defaultBookId;
      const bundle = (await fetch(`/data/books/${book}.json`).then((r) => r.json())) as BookBundle;
      await downloadPptx(
        songs
          .map((s) => ({
            id: s.songId,
            song: bundle.songs[s.songId]!,
            layers: { n: true, r: true, e: false },
          }))
          .filter((x) => x.song),
      );
    } catch {
      showToast(t('desktop.previewError'));
    }
  };

  return (
    <div class="set-panel">
      <div class="set-panel__ribbon">
        <div class="set-panel__ribbon-label">{formatSetDate(active.date)}</div>
        <input
          class="set-panel__title"
          aria-label={t('set.titleLabel')}
          value={active.title}
          maxLength={80}
          onInput={(e) => updateSet(active.id, { title: e.currentTarget.value })}
        />
        <div class="set-panel__meta">
          {songs.length === 1 ? t('desktop.songCount.one') : t('desktop.songCount', { n: songs.length })}
          {' · '}
          <a href={`/sets/edit/?id=${encodeURIComponent(active.id)}`}>{t('set.editSet')}</a>
        </div>
      </div>

      <div class="set-panel__list">
        {active.items.map((it) => {
          if (it.kind === 'heading') {
            return (
              <p class="set-panel__heading" key={it.uid}>
                {it.text}
              </p>
            );
          }
          const songIndex = songs.findIndex((s) => s.uid === it.uid);
          const title = meta?.[it.songId]?.[0] ?? it.songId;
          const isCurrent = songIndex === currentIndex || it.songId === currentId;
          return (
            <div class={isCurrent ? 'set-panel__row is-current' : 'set-panel__row'} key={it.uid}>
              <a class="set-panel__song" href={songInWorshipSetUrl(active, songIndex)} data-astro-reload>
                <span class="set-panel__ord">{songIndex + 1}</span>
                <span class="set-panel__badge">{badgeFor(it.songId, it.book)}</span>
                <span class="set-panel__name">{title}</span>
                {it.key ? <span class="set-panel__key">{it.key}</span> : null}
              </a>
              <button
                type="button"
                class="icon-btn"
                aria-label={t('set.remove')}
                onClick={() => removeItem(active.id, it.uid)}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <div class="set-panel__actions">
        <a
          class="btn btn--primary"
          href={songs[0] ? `/present/?set=${encodeURIComponent(presentCode)}&i=0` : undefined}
          title={t('desktop.presentHelp')}
        >
          ▶ {t('desktop.presentSet')}
        </a>
        <div class="set-panel__action-row">
          <button type="button" class="btn btn--secondary" onClick={() => setQrOpen(true)}>
            {t('desktop.qrCong')}
          </button>
          <a class="btn btn--secondary" href={`/sets/print/?id=${encodeURIComponent(active.id)}`}>
            {t('desktop.pdf')}
          </a>
          <button type="button" class="btn btn--secondary" onClick={() => void exportPpt()}>
            {t('desktop.ppt')}
          </button>
        </div>
        <a class="btn btn--ghost" href={songs[0] ? songInWorshipSetUrl(active, 0) : '/sets/'} data-astro-reload>
          ▶ {t('set.start')}
        </a>
      </div>

      {qrOpen ? (
        <QrSheet open={true} url={shareUrl} title={active.title} onClose={() => setQrOpen(false)} />
      ) : null}
    </div>
  );
}
