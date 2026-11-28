import { useEffect, useState } from 'preact/hooks';
import {
  AArrowDown,
  AArrowUp,
  CirclePlay,
  ListChecks,
  ListPlus,
  Presentation,
  Sun,
} from 'lucide-preact';
import { FLAGS } from '../../config/flags';
import type { MediaItem } from '../../lib/schema';
import { t } from '../../i18n';
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
import VideoSheet from './VideoSheet';

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
  videos?: MediaItem[];
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
  videos = [],
}: SongToolbarProps) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [awake, setAwake] = useState(false);
  const [supported, setSupported] = useState(true);
  const [inSet, setInSet] = useState(false);
  const [activeSet, setActiveSet] = useState<WorshipSet | undefined>();
  const [pickOpen, setPickOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
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
      document.body.classList.remove('nav-hidden');
    };
  }, [snapshot.id]);

  useEffect(() => {
    const onPpt = () => void exportPpt();
    addEventListener('stuti:song-ppt', onPpt);
    return () => removeEventListener('stuti:song-ppt', onPpt);
  }, [prefs.layers]);

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
      <div class="tools tools--icons">
        <button
          type="button"
          class="tool tool--icon"
          aria-label={t('song.smaller')}
          title={t('song.smaller')}
          disabled={prefs.size <= 0}
          onClick={() => save({ size: Math.max(0, prefs.size - 1) })}
        >
          <AArrowDown size={22} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          class="tool tool--icon"
          aria-label={t('song.larger')}
          title={t('song.larger')}
          disabled={prefs.size >= SIZE_STEPS - 1}
          onClick={() => save({ size: Math.min(SIZE_STEPS - 1, prefs.size + 1) })}
        >
          <AArrowUp size={22} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          class={awake ? 'tool tool--icon tool--on tool-keep-awake' : 'tool tool--icon tool-keep-awake'}
          aria-pressed={awake ? 'true' : 'false'}
          aria-label={awake ? t('song.screenOn') : t('song.keepAwake')}
          title={supported ? (awake ? t('song.screenOn') : t('song.keepAwake')) : t('song.wakeUnsupported')}
          disabled={!supported}
          onClick={toggleAwake}
        >
          <Sun size={22} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          class={inSet ? 'tool tool--icon tool--on tool--set' : 'tool tool--icon tool--set'}
          aria-pressed={inSet ? 'true' : 'false'}
          aria-label={
            inSet
              ? t('song.inSetNamed', { title: activeSet?.title ?? t('set.title') })
              : t('song.addSetTo', { title: shortSetTitle(activeSet?.title) })
          }
          title={
            inSet
              ? t('song.inSetNamed', { title: activeSet?.title ?? t('set.title') })
              : t('song.addSetTo', { title: shortSetTitle(activeSet?.title) })
          }
          data-feature="add-to-set"
          onClick={toggleSet}
        >
          {inSet ? (
            <ListChecks size={22} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <ListPlus size={22} strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
        {FLAGS.videos ? (
          videos.length > 0 ? (
            <button
              type="button"
              class="tool tool--icon"
              style={{ position: 'relative' }}
              aria-label={`${videos.length} videos`}
              title="Videos"
              data-guide="video"
              onClick={() => setVideoOpen(true)}
            >
              <CirclePlay size={22} strokeWidth={1.75} aria-hidden="true" />
              <span class="cnt">{videos.length}</span>
            </button>
          ) : (
            <button
              type="button"
              class="tool tool--icon"
              disabled
              aria-disabled="true"
              aria-label="No video yet"
              title="No video yet"
              style={{ opacity: 0.3, cursor: 'not-allowed' }}
            >
              <CirclePlay size={22} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )
        ) : null}
        <a
          class="tool tool--icon"
          href={`/present/?song=${encodeURIComponent(snapshot.id)}`}
          aria-label={t('desktop.present')}
          title={t('desktop.present')}
          data-feature="present"
        >
          <Presentation size={22} strokeWidth={1.75} aria-hidden="true" />
        </a>
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

      {FLAGS.videos ? (
        <VideoSheet
          open={videoOpen}
          onClose={() => setVideoOpen(false)}
          videos={videos}
          songTitle={snapshot.title}
        />
      ) : null}
    </div>
  );
}
