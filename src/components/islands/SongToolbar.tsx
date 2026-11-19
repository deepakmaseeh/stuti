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
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
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
            <path d="M5 20 10 4h2l5 16" />
            <path d="M7.2 14h7.6" />
            <path d="M17 12h5" />
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
            <path d="M4 20 9 4h2l5 16" />
            <path d="M6.2 14h7.6" />
            <path d="M17 9v8" />
            <path d="M13 13h8" />
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
          class={awake ? 'tool tool--on' : 'tool'}
          aria-pressed={awake ? 'true' : 'false'}
          disabled={!supported}
          title={supported ? undefined : t('song.wakeUnsupported')}
          onClick={toggleAwake}
        >
          <Icon label={awake ? t('song.screenOn') : t('song.keepAwake')}>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
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
              <path d="M9 6h12M9 12h12M9 18h7" />
              <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none" />
              <path d="m14 16 2 2 4-4" />
            </Icon>
          ) : (
            <Icon label={t('song.addSet')}>
              <path d="M9 6h12M9 12h12M9 18h7" />
              <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none" />
              <path d="M19 15v6M16 18h6" />
            </Icon>
          )}
        </button>
        <button type="button" class="tool" onClick={() => shareLink(share)}>
          <Icon label={t('song.share')}>
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
          </Icon>
        </button>
        <button type="button" class="tool layout-toggle" onClick={() => window.print()}>
          <Icon label={t('desktop.pdf')}>
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
            <path d="M14 3v6h6" />
            <path d="M9 13h6M9 17h6" />
          </Icon>
        </button>
        <button type="button" class="tool layout-toggle" onClick={() => void exportPpt()}>
          <Icon label={t('desktop.ppt')}>
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
            <path d="M7 8h4M7 12h10" />
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
