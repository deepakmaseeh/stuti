import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { shareLink } from '../../lib/share';
import {
  DEFAULT_PREFS,
  pushRecent,
  SIZE_STEPS,
  storage,
  updatePrefs,
  type Prefs,
  type SongSnapshot,
} from '../../lib/storage';
import {
  addSongToSet,
  createSet,
  getActiveSet,
  getSets,
  hydrateSets,
  isSongInActive,
  listenSetsChanged,
  removeSongFromActive,
  setActive,
  type WorshipSet,
} from '../../lib/sets';
import { showToast } from '../../lib/toast';
import { isAwake, onWakeChange, setKeepAwake, wakeLockSupported } from '../../lib/wakelock';
import type { BookBundle } from '../../lib/book-bundle';
import { downloadPptx } from '../../lib/pptx-export';
import Sheet from './Sheet';

type LayerState = 'missing' | 'draft' | 'reviewed';
type LayerKey = 'n' | 'r' | 'e';

export type SongToolbarProps = {
  snapshot: SongSnapshot;
  isEnglish: boolean;
  nativeLabel: string;
  nativeLang: string;
  layers: { r: LayerState; e: LayerState };
  share: { title: string; text: string; url: string };
  books: string[];
};

function applyHtml(prefs: Prefs) {
  const h = document.documentElement;
  h.dataset.layers = (['n', 'r', 'e'] as const).filter((k) => prefs.layers[k]).join(' ') || 'n';
  h.dataset.size = String(prefs.size);
  h.dataset.layout = prefs.layout === 'columns' ? 'columns' : 'stacked';
}

export default function SongToolbar({
  snapshot,
  isEnglish,
  nativeLabel,
  nativeLang,
  layers,
  share,
  books,
}: SongToolbarProps) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [awake, setAwake] = useState(false);
  const [supported, setSupported] = useState(true);
  const [inSet, setInSet] = useState(false);
  const [activeSet, setActiveSet] = useState<WorshipSet | undefined>();
  const [pickOpen, setPickOpen] = useState(false);
  const [ready, setReady] = useState(false);

  const available: LayerKey[] = [
    'n',
    ...(layers.r !== 'missing' ? (['r'] as const) : []),
    ...(layers.e !== 'missing' ? (['e'] as const) : []),
  ];

  const save = (patch: Partial<Prefs>) => {
    const next = updatePrefs(patch);
    setPrefs(next);
    applyHtml(next);
  };

  useEffect(() => {
    hydrateSets();
    const stored = storage.prefs.get();
    setPrefs(stored);
    const syncInSet = () => {
      setInSet(isSongInActive(snapshot.id));
      setActiveSet(getActiveSet());
    };
    syncInSet();
    const canWake = wakeLockSupported();
    setSupported(canWake);
    pushRecent(snapshot);
    const nudge = storage.installNudge.get();
    storage.installNudge.set({ ...nudge, songOpens: (nudge.songOpens ?? 0) + 1 });

    const offWake = onWakeChange(setAwake);
    setAwake(isAwake());
    const params = new URLSearchParams(location.search);
    const fromSet = params.has('set') || params.has('shared');
    if (canWake && (fromSet || stored.keepAwake)) setKeepAwake(true).catch(() => {});
    setReady(true);

    let lastY = scrollY;
    const onScroll = () => {
      const y = scrollY;
      if (Math.abs(y - lastY) > 8) {
        document.body.classList.toggle('nav-hidden', y > lastY && y > 120);
        lastY = y;
      }
    };
    addEventListener('scroll', onScroll, { passive: true });
    const offSets = listenSetsChanged(syncInSet);
    return () => {
      offWake();
      offSets();
      removeEventListener('scroll', onScroll);
    };
  }, [snapshot.id]);

  const toggleLayer = (k: LayerKey) => {
    const next = { ...prefs.layers, [k]: !prefs.layers[k] };
    if (!available.some((a) => next[a])) return;
    save({ layers: next });
  };

  const toggleAwake = async () => {
    try {
      await setKeepAwake(!awake);
      save({ keepAwake: !awake });
    } catch {
      showToast(t('song.wakeUnsupported'));
    }
  };

  const bookForAdd = () => {
    const from = new URLSearchParams(location.search).get('from')?.toLowerCase();
    return books.find((b) => b.toLowerCase() === from) ?? books[0];
  };

  const addToSet = (set: WorshipSet) => {
    const book = bookForAdd();
    setActive(set.id);
    if (!addSongToSet(set.id, { songId: snapshot.id, ...(book ? { book } : {}) })) {
      showToast(t('set.fullToast'));
      return;
    }
    setInSet(true);
    setActiveSet(getActiveSet());
    setPickOpen(false);
    showToast(t('set.addedToToast', { title: set.title }));
  };

  const toggleSet = () => {
    if (inSet) {
      removeSongFromActive(snapshot.id);
      setInSet(false);
      showToast(t('set.removedToast'));
      return;
    }
    hydrateSets();
    const sets = getSets();
    const active = getActiveSet();
    if (sets.length > 1) {
      setPickOpen(true);
      return;
    }
    if (active) {
      addToSet(active);
      return;
    }
    const created = createSet({ makeActive: true });
    addToSet(created);
  };

  const shortSetTitle = (title?: string) => {
    if (!title) return t('set.newSet');
    return title.length > 18 ? `${title.slice(0, 16)}…` : title;
  };

  const chips: { key: LayerKey; label: string; lang?: string; state?: LayerState }[] = [
    { key: 'n', label: nativeLabel, lang: nativeLang },
    ...(layers.r !== 'missing' ? [{ key: 'r' as const, label: t('song.roman'), state: layers.r }] : []),
    ...(layers.e !== 'missing' ? [{ key: 'e' as const, label: t('song.english'), state: layers.e }] : []),
  ];

  const layoutOn = prefs.layout === 'columns';

  const Icon = ({ children, label }: { children: ComponentChildren; label: string }) => (
    <>
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="tool__icon"
      >
        {children}
      </svg>
      <span class="tool__label">{label}</span>
    </>
  );

  const exportPpt = async () => {
    showToast(t('desktop.preparingPpt'));
    try {
      const book = books[0];
      if (!book) throw new Error('book');
      const bundle = (await fetch(`/data/books/${book}.json`).then((r) => {
        if (!r.ok) throw new Error('fetch');
        return r.json();
      })) as BookBundle;
      const song = bundle.songs[snapshot.id];
      if (!song) throw new Error('song');
      await downloadPptx([{ id: snapshot.id, song, layers: prefs.layers }]);
    } catch {
      showToast(t('desktop.previewError'));
    }
  };

  return (
    <div class={ready ? 'toolbar toolbar--ready' : 'toolbar'}>
      {!isEnglish && chips.length > 1 && (
        <div class="chips" role="group" aria-label={t('song.layers')}>
          {chips.map((c) => (
            <button
              type="button"
              class="chip"
              aria-pressed={prefs.layers[c.key] ? 'true' : 'false'}
              onClick={() => toggleLayer(c.key)}
            >
              <span lang={c.lang}>{c.label}</span>
              {c.state === 'draft' && <span class="pill pill--warn">{t('song.draft')}</span>}
            </button>
          ))}
        </div>
      )}
      <div class="tools">
        <button
          type="button"
          class="tool tool--size"
          aria-label={t('song.smaller')}
          disabled={prefs.size <= 0}
          onClick={() => save({ size: Math.max(0, prefs.size - 1) })}
        >
          <span class="tool__size" aria-hidden="true">
            A−
          </span>
        </button>
        <button
          type="button"
          class="tool tool--size"
          aria-label={t('song.larger')}
          disabled={prefs.size >= SIZE_STEPS - 1}
          onClick={() => save({ size: Math.min(SIZE_STEPS - 1, prefs.size + 1) })}
        >
          <span class="tool__size" aria-hidden="true">
            A+
          </span>
        </button>
        {!isEnglish && (
          <button
            type="button"
            class={layoutOn ? 'tool layout-toggle tool--on' : 'tool layout-toggle'}
            aria-pressed={layoutOn ? 'true' : 'false'}
            title={t('song.layoutHint')}
            onClick={() => save({ layout: layoutOn ? 'stacked' : 'columns' })}
          >
            {layoutOn ? (
              <Icon label={t('song.layoutColumns')}>
                <rect x="3" y="4" width="5" height="16" rx="1" />
                <rect x="10" y="4" width="5" height="16" rx="1" />
                <rect x="17" y="4" width="4" height="16" rx="1" />
              </Icon>
            ) : (
              <Icon label={t('song.layoutStacked')}>
                <rect x="3" y="4" width="18" height="4" rx="1" />
                <rect x="3" y="10" width="18" height="4" rx="1" />
                <rect x="3" y="16" width="18" height="4" rx="1" />
              </Icon>
            )}
          </button>
        )}
        <button
          type="button"
          class={awake ? 'tool tool--on tool-keep-awake' : 'tool tool-keep-awake'}
          aria-pressed={awake ? 'true' : 'false'}
          disabled={!supported}
          title={supported ? undefined : t('song.wakeUnsupported')}
          onClick={toggleAwake}
        >
          <Icon label={awake ? t('song.screenOn') : t('song.keepAwake')}>
            <circle cx="12" cy="12" r="3.5" />
            <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.5 1.5M18.3 18.3l1.5 1.5M2.5 12h2M19.5 12h2M4.2 19.8l1.5-1.5M18.3 5.7l1.5-1.5" />
          </Icon>
        </button>
        <button
          type="button"
          class={inSet ? 'tool tool--on tool--set' : 'tool tool--set'}
          aria-pressed={inSet ? 'true' : 'false'}
          title={
            inSet
              ? t('song.inSetNamed', { title: activeSet?.title ?? t('set.title') })
              : t('song.addSetTo', { title: shortSetTitle(activeSet?.title) })
          }
          onClick={toggleSet}
        >
          {inSet ? (
            <Icon label="✓ In set">
              <path d="M9 6h11M9 12h11M9 18h7" />
              <path d="M4 6h.01M4 12h.01M4 18h.01" />
              <path d="m14.5 16 2 2 3.5-3.5" />
            </Icon>
          ) : (
            <Icon label={t('song.addSetTo', { title: shortSetTitle(activeSet?.title) })}>
              <path d="M9 6h11M9 12h11M9 18h7" />
              <path d="M4 6h.01M4 12h.01M4 18h.01" />
              <path d="M19 15v6M16 18h6" />
            </Icon>
          )}
        </button>
        <button type="button" class="tool" onClick={() => shareLink(share)}>
          <Icon label={t('song.share')}>
            <circle cx="18" cy="5" r="2.5" />
            <circle cx="6" cy="12" r="2.5" />
            <circle cx="18" cy="19" r="2.5" />
            <path d="m8.6 13.4 6.7 3.9M15.3 6.7l-6.7 3.9" />
          </Icon>
        </button>
        <button type="button" class="tool layout-toggle" onClick={() => window.print()}>
          <Icon label={t('desktop.pdf')}>
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
            <path d="M14 3v6h6" />
            <path d="M9 13h6M9 17h5" />
          </Icon>
        </button>
        <button type="button" class="tool layout-toggle" onClick={() => void exportPpt()}>
          <Icon label={t('desktop.ppt')}>
            <rect x="2" y="4" width="20" height="13" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </Icon>
        </button>
      </div>
      {!supported && (
        <p class="tools__note">
          {t('song.keepAwake')}: {t('song.wakeUnsupported')}
        </p>
      )}

      <Sheet open={pickOpen} onClose={() => setPickOpen(false)} title={t('song.pickSet')} id="pick-set">
        <ul class="set-pick-list">
          {getSets().map((s) => (
            <li key={s.id}>
              <button type="button" class="set-pick-list__btn" onClick={() => addToSet(s)}>
                <span class="set-pick-list__title">{s.title}</span>
                <span class="set-pick-list__meta">
                  {s.date}
                  {s.id === activeSet?.id ? ` · ${t('set.open')}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          class="btn btn--primary"
          onClick={() => addToSet(createSet({ makeActive: true }))}
        >
          {t('song.newSetForAdd')}
        </button>
      </Sheet>
    </div>
  );
}
