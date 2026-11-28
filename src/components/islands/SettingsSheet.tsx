import { useEffect, useState } from 'preact/hooks';
import {
  ChevronDown,
  Download,
  Info,
  LogIn,
  MonitorSmartphone,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
  X,
} from 'lucide-preact';
import { FLAGS } from '../../config/flags';
import { readPrefs, setPrefs, type Prefs, type Theme } from '../../lib/prefs';
import { clearRecentHistory, exportUserData, storage } from '../../lib/storage';
import { showToast } from '../../lib/toast';
import { site } from '../../site.config';

type BookOption = { id: string; en: string };

type Props = {
  books: BookOption[];
};

const THEMES: readonly [Theme, string, typeof Sun][] = [
  ['system', 'System', MonitorSmartphone],
  ['light', 'Light', Sun],
  ['dark', 'Dark', Moon],
];

const SIZE_PX = [18, 20, 22, 26, 30] as const;

export default function SettingsSheet({ books }: Props) {
  const [open, setOpen] = useState(false);
  const [prefs, setLocalPrefs] = useState<Prefs>(() => ({
    theme: 'system',
    size: 2,
    layers: { n: true, r: true, e: false },
    lastBookId: site.defaultBookId,
    musician: false,
    churchName: '',
    serviceTime: '10:00',
    persist: false,
  }));
  const [savedCount, setSavedCount] = useState(0);
  const [savedBytes, setSavedBytes] = useState(0);
  const [signedIn, setSignedIn] = useState(false);

  const syncFromStorage = () => {
    const p = readPrefs();
    setLocalPrefs((prev) => ({
      ...prev,
      ...p,
      layers: { n: true, r: true, e: false, ...(p.layers ?? {}) },
      lastBookId: p.lastBookId || site.defaultBookId,
      musician: Boolean(p.musician),
      churchName: p.churchName ?? '',
      serviceTime: p.serviceTime ?? '10:00',
      persist: Boolean(p.persist),
    }));
    const dls = storage.downloads.get();
    const vals = Object.values(dls);
    setSavedCount(vals.length);
    setSavedBytes(vals.reduce((sum, item) => sum + (item.bytes || 0), 0));
  };

  useEffect(() => {
    syncFromStorage();
    const w = window as Window & { __stutiOpenSettings?: boolean };
    if (w.__stutiOpenSettings) {
      w.__stutiOpenSettings = false;
      setOpen(true);
    }
    const onPrefs = () => syncFromStorage();
    const onOpen = () => {
      w.__stutiOpenSettings = false;
      syncFromStorage();
      setOpen(true);
    };
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const trigger = target?.closest?.('[data-open-settings]');
      if (!trigger) return;
      e.preventDefault();
      syncFromStorage();
      setOpen(true);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    addEventListener('stuti:prefs', onPrefs);
    addEventListener('stuti:open-settings', onOpen);
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    if (FLAGS.admin) {
      fetch('/api/admin/me')
        .then((r) => setSignedIn(r.ok))
        .catch(() => setSignedIn(false));
    }
    return () => {
      removeEventListener('stuti:prefs', onPrefs);
      removeEventListener('stuti:open-settings', onOpen);
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  if (!open) return null;

  const patch = (next: Partial<Prefs>) => {
    const updated = setPrefs(next);
    setLocalPrefs((prev) => ({ ...prev, ...updated }));
  };

  const sizeStep = Math.min(4, Math.max(0, prefs.size ?? 2));
  const romanOn = Boolean(prefs.layers?.r);
  const musicianOn = Boolean(prefs.musician);
  const persistOn = Boolean(prefs.persist);
  const mbText = savedBytes > 0 ? `${(savedBytes / (1024 * 1024)).toFixed(1)} MB` : '0 MB';

  const togglePersist = async () => {
    const nextVal = !persistOn;
    if (nextVal && navigator.storage?.persist) {
      try {
        await navigator.storage.persist();
      } catch {
        // ignore if unsupported
      }
    }
    patch({ persist: nextVal });
  };

  return (
    <>
      <div class="v3-scrim" onClick={() => setOpen(false)} />
      <div class="v3-sheet v3-drawer" role="dialog" aria-modal="true" aria-label="Settings">
        <div class="grab" />
        <div class="sh">
          <h2>Settings</h2>
          <button
            type="button"
            class="ib ink"
            aria-label="Close settings"
            onClick={() => setOpen(false)}
          >
            <X size={22} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <div class="sb">
          {/* 1. Theme */}
          <div class="grp" style={{ marginTop: 4 }}>
            <span class="lbl">Theme</span>
            <div class="seg3" role="group" aria-label="Theme" data-feature="theme">
              {THEMES.map(([id, label, Icon]) => (
                <button
                  type="button"
                  key={id}
                  class={prefs.theme === id ? 'on' : undefined}
                  aria-pressed={prefs.theme === id}
                  onClick={() => patch({ theme: id })}
                >
                  <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Text size */}
          <div class="grp">
            <span class="lbl">Text size</span>
            <input
              class="rng"
              type="range"
              min={0}
              max={4}
              step={1}
              value={sizeStep}
              aria-label="Text size"
              onInput={(e) => patch({ size: Number(e.currentTarget.value) })}
            />
            <div
              class="hi"
              lang="hi"
              style={{ fontSize: `${SIZE_PX[sizeStep]}px`, lineHeight: 1.5, marginTop: 6 }}
            >
              आओ प्यारो शरण मसीह की
            </div>
          </div>

          {/* 3. Songs */}
          <div class="grp">
            <span class="lbl">Songs</span>
            <div class="setrow">
              <span>Our church uses</span>
              <div class="v3-sel" style={{ width: 136 }}>
                <select
                  aria-label="Our church uses"
                  value={prefs.lastBookId || site.defaultBookId}
                  onChange={(e) => patch({ lastBookId: e.currentTarget.value })}
                >
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id}
                    </option>
                  ))}
                </select>
                <ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" />
              </div>
            </div>
            <div class="setrow">
              <span>Show Roman lyrics</span>
              <button
                type="button"
                class={`v3-switch${romanOn ? ' on' : ''}`}
                role="switch"
                aria-label="Show Roman lyrics"
                aria-checked={romanOn}
                onClick={() =>
                  patch({
                    layers: {
                      n: prefs.layers?.n ?? true,
                      r: !romanOn,
                      e: prefs.layers?.e ?? false,
                    },
                  })
                }
              />
            </div>
            <div class="setrow">
              <span>Show key for musicians</span>
              <button
                type="button"
                class={`v3-switch${musicianOn ? ' on' : ''}`}
                role="switch"
                aria-label="Show key for musicians"
                aria-checked={musicianOn}
                onClick={() => patch({ musician: !musicianOn })}
              />
            </div>
          </div>

          {/* 4. Church */}
          <div class="grp">
            <span class="lbl">Church</span>
            <label class="setrow">
              <span>Church name</span>
              <input
                type="text"
                class="v3-inline-input"
                placeholder="Optional"
                value={prefs.churchName ?? ''}
                onInput={(e) => patch({ churchName: e.currentTarget.value })}
              />
            </label>
            <label class="setrow">
              <span>Service time</span>
              <input
                type="time"
                class="v3-inline-input"
                value={prefs.serviceTime || '10:00'}
                onInput={(e) => patch({ serviceTime: e.currentTarget.value })}
              />
            </label>
          </div>

          {/* 5. Offline */}
          <div class="grp">
            <span class="lbl">Offline</span>
            <a
              href="/downloads/"
              class="btn-v3 sec"
              style={{ width: '100%', justifyContent: 'space-between' }}
              onClick={() => setOpen(false)}
            >
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <Download size={18} strokeWidth={1.75} aria-hidden="true" />
                {savedCount} of {books.length} books saved
              </span>
              <span class="muted">{mbText}</span>
            </a>
            <div class="setrow">
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <ShieldCheck size={18} strokeWidth={1.75} aria-hidden="true" />
                Keep downloads safe
              </span>
              <button
                type="button"
                class={`v3-switch${persistOn ? ' on' : ''}`}
                role="switch"
                aria-label="Keep downloads safe"
                aria-checked={persistOn}
                onClick={() => void togglePersist()}
              />
            </div>
          </div>

          {/* 6. Data & backup */}
          <div class="grp">
            <span class="lbl">Data &amp; backup</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                class="btn-v3 sec"
                style={{ flex: 1, minWidth: 140, justifyContent: 'center' }}
                onClick={() => {
                  clearRecentHistory();
                  showToast('Recent history cleared');
                }}
              >
                <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                Clear recent history
              </button>
              <button
                type="button"
                class="btn-v3 sec"
                style={{ flex: 1, minWidth: 140, justifyContent: 'center' }}
                onClick={() => {
                  const json = exportUserData();
                  const blob = new Blob([json], { type: 'application/json' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `stuti-backup-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                  showToast('Data exported');
                }}
              >
                <Download size={16} strokeWidth={1.75} aria-hidden="true" />
                Export data
              </button>
            </div>
          </div>

          {/* 7. About & Guide */}
          <a
            href="/guide/"
            class="btn-v3 sec"
            style={{ width: '100%', marginTop: 18 }}
            onClick={() => setOpen(false)}
          >
            <Info size={18} strokeWidth={1.75} aria-hidden="true" />
            About &amp; Guide
          </a>

          {/* 7. Editor sign-in */}
          {FLAGS.admin && (
            <a
              href="/admin/"
              class="btn-v3 pri"
              style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}
              onClick={() => setOpen(false)}
            >
              <LogIn size={18} strokeWidth={1.75} aria-hidden="true" />
              {signedIn ? 'Open admin' : 'Editor sign-in'}
            </a>
          )}
        </div>
      </div>
    </>
  );
}
