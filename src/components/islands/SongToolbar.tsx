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
import { addToDraft, isInDraft, removeFromDraft } from '../../lib/setlist';
import { showToast } from '../../lib/toast';
import { isAwake, onWakeChange, setKeepAwake, wakeLockSupported } from '../../lib/wakelock';
import type { BookBundle } from '../../lib/book-bundle';
import { downloadPptx } from '../../lib/pptx-export';

type LayerState = 'missing' | 'draft' | 'reviewed';
type LayerKey = 'n' | 'r' | 'e';

export type SongToolbarProps = {
  snapshot: SongSnapshot;
  isEnglish: boolean;
  nativeLabel: string;
  nativeLang: string;
  layers: { r: LayerState; e: LayerState };
  share: { title: string; text: string; url: string };
  /** Book codes this song appears in, in `numbers` order. */
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
  // Server render uses defaults; real prefs/support are read after mount so hydration matches.
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [awake, setAwake] = useState(false);
  const [supported, setSupported] = useState(true);
  const [inSet, setInSet] = useState(false);

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
    const stored = storage.prefs.get();
    setPrefs(stored);
    setInSet(isInDraft(snapshot.id));
    const canWake = wakeLockSupported();
    setSupported(canWake);
    pushRecent(snapshot);
    const nudge = storage.installNudge.get();
    storage.installNudge.set({ ...nudge, songOpens: (nudge.songOpens ?? 0) + 1 });

    const off = onWakeChange(setAwake);
    setAwake(isAwake());
    const fromSet = new URLSearchParams(location.search).has('set');
    if (canWake && (fromSet || stored.keepAwake)) setKeepAwake(true).catch(() => {});

    // Song page only: hide the bottom nav on scroll down, show on scroll up.
    let lastY = scrollY;
    const onScroll = () => {
      const y = scrollY;
      if (Math.abs(y - lastY) > 8) {
        document.body.classList.toggle('nav-hidden', y > lastY && y > 120);
        lastY = y;
      }
    };
    addEventListener('scroll', onScroll, { passive: true });
    return () => {
      off();
      removeEventListener('scroll', onScroll);
    };
  }, []);

  const toggleLayer = (k: LayerKey) => {
    const next = { ...prefs.layers, [k]: !prefs.layers[k] };
    if (!available.some((a) => next[a])) return; // at least one visible layer stays on
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

  const toggleSet = () => {
    if (inSet) {
      removeFromDraft(snapshot.id);
      setInSet(false);
      showToast(t('set.removedToast'));
      dispatchEvent(new Event('stuti:set-changed'));
      return;
    }
    // Remember which book the singer came from so the set shows the number they know.
    const from = new URLSearchParams(location.search).get('from')?.toLowerCase();
    const book = books.find((b) => b.toLowerCase() === from) ?? books[0];
    if (addToDraft({ id: snapshot.id, ...(book ? { book } : {}) })) {
      setInSet(true);
      showToast(t('set.addedToast'));
      dispatchEvent(new Event('stuti:set-changed'));
    } else showToast(t('set.fullToast'));
  };

  const chips: { key: LayerKey; label: string; lang?: string; state?: LayerState }[] = [
    { key: 'n', label: nativeLabel, lang: nativeLang },
    ...(layers.r !== 'missing' ? [{ key: 'r' as const, label: t('song.roman'), state: layers.r }] : []),
    ...(layers.e !== 'missing' ? [{ key: 'e' as const, label: t('song.english'), state: layers.e }] : []),
  ];

  const layoutOn = prefs.layout === 'columns';

  const Icon = ({ children, label }: { children: ComponentChildren; label: string }) => (
    <>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" class="tool__icon">
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
    <div class="toolbar">
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
          class="tool"
          aria-label={t('song.smaller')}
          disabled={prefs.size <= 0}
          onClick={() => save({ size: Math.max(0, prefs.size - 1) })}
        >
          <Icon label="A−">
            <path
              d="M5 18h2.2l.7-2h3.2l.7 2H14l-3.2-9H8.2L5 18zm3.4-3.6 1.1-3.2 1.1 3.2H8.4zM16 11h6v2h-6z"
              fill="currentColor"
            />
          </Icon>
        </button>
        <button
          type="button"
          class="tool"
          aria-label={t('song.larger')}
          disabled={prefs.size >= SIZE_STEPS - 1}
          onClick={() => save({ size: Math.min(SIZE_STEPS - 1, prefs.size + 1) })}
        >
          <Icon label="A+">
            <path
              d="M4 18h2.2l.7-2h3.2l.7 2H13l-3.2-9H6.8L4 18zm3.4-3.6 1.1-3.2 1.1 3.2H7.4zM16 8h2v3h3v2h-3v3h-2v-3h-3v-2h3V8z"
              fill="currentColor"
            />
          </Icon>
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
                <path
                  d="M4 5h5v14H4V5zm6 0h5v14h-5V5zm6 0h4v14h-4V5z"
                  fill="currentColor"
                />
              </Icon>
            ) : (
              <Icon label={t('song.layoutStacked')}>
                <path d="M4 5h16v4H4V5zm0 5h16v4H4v-4zm0 5h16v4H4v-4z" fill="currentColor" />
              </Icon>
            )}
          </button>
        )}
        <button
          type="button"
          class={awake ? 'tool tool--on' : 'tool'}
          aria-pressed={awake ? 'true' : 'false'}
          disabled={!supported}
          title={supported ? undefined : t('song.wakeUnsupported')}
          onClick={toggleAwake}
        >
          <Icon label={awake ? t('song.screenOn') : t('song.keepAwake')}>
            <path
              d="M12 4.5 13.8 9H19l-4.1 3 1.6 4.8L12 14.2 7.5 16.8 9.1 12 5 9h5.2L12 4.5z"
              fill="currentColor"
            />
          </Icon>
        </button>
        <button
          type="button"
          class={inSet ? 'tool tool--on' : 'tool'}
          aria-pressed={inSet ? 'true' : 'false'}
          onClick={toggleSet}
        >
          {inSet ? (
            <Icon label={t('song.inSet')}>
              <path
                d="M5 6h11v2H5V6zm0 5h11v2H5v-2zm0 5h8v2H5v-2zm12.2-1.3 1.4-1.4 2.1 2.1 3.5-3.5 1.4 1.4-4.9 4.9-3.5-3.5z"
                fill="currentColor"
              />
            </Icon>
          ) : (
            <Icon label={t('song.addSet')}>
              <path
                d="M5 6h11v2H5V6zm0 5h11v2H5v-2zm0 5h8v2H5v-2zm13-6h2v3h3v2h-3v3h-2v-3h-3v-2h3V10z"
                fill="currentColor"
              />
            </Icon>
          )}
        </button>
        <button type="button" class="tool" onClick={() => shareLink(share)}>
          <Icon label={t('song.share')}>
            <path
              d="M18 16a3 3 0 0 0-2.2 1l-6.3-3.3a3.1 3.1 0 0 0 0-1.4L15.8 9A3 3 0 1 0 14 7a3 3 0 0 0 .1.7L8 11a3 3 0 1 0 0 2l6.1 3.2A3 3 0 1 0 18 16z"
              fill="currentColor"
            />
          </Icon>
        </button>
        <button type="button" class="tool layout-toggle" onClick={() => window.print()}>
          <Icon label={t('desktop.pdf')}>
            <path
              d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm7 1.5V9h4.5L14 4.5zM8 12h8v1.5H8V12zm0 3.5h8V17H8v-1.5zm0 3.5h5V21H8v-2z"
              fill="currentColor"
            />
          </Icon>
        </button>
        <button type="button" class="tool layout-toggle" onClick={() => void exportPpt()}>
          <Icon label={t('desktop.ppt')}>
            <path
              d="M3 5h18v12H3V5zm2 2v8h14V7H5zm3 11h8v2H8v-2zM8 9h4.5a2.2 2.2 0 0 1 0 4.4H10V15H8V9zm2 1.5v1.4h2.3a.7.7 0 0 0 0-1.4H10z"
              fill="currentColor"
            />
          </Icon>
        </button>
      </div>
      {!supported && (
        <p class="tools__note">
          {t('song.keepAwake')}: {t('song.wakeUnsupported')}
        </p>
      )}
    </div>
  );
}
