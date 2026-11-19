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
      return;
    }
    // Remember which book the singer came from so the set shows the number they know.
    const from = new URLSearchParams(location.search).get('from')?.toLowerCase();
    const book = books.find((b) => b.toLowerCase() === from) ?? books[0];
    if (addToDraft({ id: snapshot.id, ...(book ? { book } : {}) })) {
      setInSet(true);
      showToast(t('set.addedToast'));
    } else showToast(t('set.fullToast'));
  };

  const chips: { key: LayerKey; label: string; lang?: string; state?: LayerState }[] = [
    { key: 'n', label: nativeLabel, lang: nativeLang },
    ...(layers.r !== 'missing' ? [{ key: 'r' as const, label: t('song.roman'), state: layers.r }] : []),
    ...(layers.e !== 'missing' ? [{ key: 'e' as const, label: t('song.english'), state: layers.e }] : []),
  ];

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
          <span aria-hidden="true">A−</span>
        </button>
        <button
          type="button"
          class="tool"
          aria-label={t('song.larger')}
          disabled={prefs.size >= SIZE_STEPS - 1}
          onClick={() => save({ size: Math.min(SIZE_STEPS - 1, prefs.size + 1) })}
        >
          <span aria-hidden="true">A+</span>
        </button>
        <button
          type="button"
          class={`tool${awake ? ' tool--on' : ''}`}
          aria-pressed={awake ? 'true' : 'false'}
          disabled={!supported}
          title={supported ? undefined : t('song.wakeUnsupported')}
          onClick={toggleAwake}
        >
          <span aria-hidden="true">☀</span> {awake ? t('song.screenOn') : t('song.keepAwake')}
        </button>
        <button
          type="button"
          class={`tool${inSet ? ' tool--on' : ''}`}
          aria-pressed={inSet ? 'true' : 'false'}
          onClick={toggleSet}
        >
          {inSet ? t('song.inSet') : t('song.addSet')}
        </button>
        <button type="button" class="tool" onClick={() => shareLink(share)}>
          {t('song.share')}
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
