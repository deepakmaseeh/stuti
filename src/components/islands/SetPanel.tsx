import { useEffect, useState } from 'preact/hooks';
import { FileText, MonitorPlay, Pencil, Play, Presentation, Share2, Trash2 } from 'lucide-preact';
import { t } from '../../i18n';
import { loadMeta, loadNumbers, type MetaRow, type NumbersMap } from '../../lib/search';
import {
  getActiveSet,
  hydrateSets,
  listenSetsChanged,
  removeItem,
  songInWorshipSetUrl,
  songItems,
  updateSet,
  type WorshipSet,
} from '../../lib/sets';
import { formatSetDate } from '../../lib/setlist';
import { site } from '../../site.config';
import ShareSheet from './ShareSheet';

export default function SetPanel({ currentId = '' }: { currentId?: string }) {
  const [desktop, setDesktop] = useState(false);
  const [active, setActive] = useState<WorshipSet | undefined>();
  const [meta, setMeta] = useState<Record<string, MetaRow> | null>(null);
  const [numbers, setNumbers] = useState<NumbersMap>({});
  const [shareOpen, setShareOpen] = useState(false);
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
  const titles: Record<string, string> = {};
  for (const s of songs) {
    if (meta?.[s.songId]) titles[s.songId] = meta[s.songId]![0];
  }
  const badgeFor = (songId: string, book?: string) => {
    const row = meta?.[songId];
    if (!row) return book ?? '';
    if (book && numbers[book]) {
      const n = Object.keys(numbers[book]!).find((k) => numbers[book]![k] === songId);
      if (n) return `${book} ${n}`;
    }
    return row[3];
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
          <a href={`/sets/edit/?id=${encodeURIComponent(active.id)}`}>
            <Pencil size={14} strokeWidth={1.75} aria-hidden="true" /> {t('set.editSet')}
          </a>
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
                title={t('set.remove')}
                onClick={() => removeItem(active.id, it.uid)}
              >
                <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>

      <div class="set-panel__actions">
        <a
          class="btn btn--primary"
          href={songs[0] ? songInWorshipSetUrl(active, 0) : `/sets/edit/?id=${encodeURIComponent(active.id)}`}
          data-astro-reload
        >
          <Play size={18} strokeWidth={1.75} aria-hidden="true" /> {t('set.start')}
        </a>
        <div class="set-panel__action-row set-panel__tiles">
          <a
            class="set-panel__tile"
            href={songs[0] ? `/present/?id=${encodeURIComponent(active.id)}&i=0` : undefined}
            aria-disabled={!songs[0]}
            title={t('desktop.presentHelp')}
            data-feature="present"
          >
            <MonitorPlay size={22} strokeWidth={1.75} aria-hidden="true" />
            <span>Present</span>
          </a>
          <a
            class="set-panel__tile"
            href={`/sets/print/?id=${encodeURIComponent(active.id)}`}
            data-feature="pdf"
          >
            <FileText size={22} strokeWidth={1.75} aria-hidden="true" />
            <span>PDF</span>
          </a>
          <button
            type="button"
            class="set-panel__tile"
            data-feature="ppt"
            onClick={() => setShareOpen(true)}
            title="PowerPoint & share"
          >
            <Presentation size={22} strokeWidth={1.75} aria-hidden="true" />
            <span>PPT</span>
          </button>
          <button
            type="button"
            class="set-panel__tile"
            data-feature="share"
            onClick={() => setShareOpen(true)}
            title={t('set.share')}
          >
            <Share2 size={22} strokeWidth={1.75} aria-hidden="true" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {shareOpen ? (
        <ShareSheet open set={active} titles={titles} onClose={() => setShareOpen(false)} />
      ) : null}
    </div>
  );
}
