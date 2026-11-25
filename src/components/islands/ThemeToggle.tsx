import { useEffect, useState } from 'preact/hooks';
import { MonitorSmartphone, Moon, Sun } from 'lucide-preact';
import { setPrefs, type Theme } from '../../lib/prefs';

const ORDER: Theme[] = ['system', 'light', 'dark'];
const ICON = { system: MonitorSmartphone, light: Sun, dark: Moon } as const;
const LABEL = { system: 'Same as phone', light: 'Light', dark: 'Dark' } as const;

/** Cycles System → Light → Dark. Prefer SettingsPanel segmented control for full UI. */
export default function ThemeToggle({ compact = true }: { compact?: boolean }) {
  const get = (): Theme => {
    const t = document.documentElement.dataset.theme as Theme | 'contrast' | undefined;
    if (t === 'contrast') return 'dark';
    return t || 'system';
  };
  const [t, setT] = useState<Theme>('system');

  useEffect(() => {
    const sync = () => setT(get());
    sync();
    addEventListener('stuti:prefs', sync);
    addEventListener('storage', sync);
    document.addEventListener('astro:after-swap', sync);
    return () => {
      removeEventListener('stuti:prefs', sync);
      removeEventListener('storage', sync);
      document.removeEventListener('astro:after-swap', sync);
    };
  }, []);

  const next = ORDER[(ORDER.indexOf(t) + 1) % ORDER.length]!;
  const Icon = ICON[t];

  return (
    <button
      type="button"
      class="icon-btn"
      data-feature="theme"
      onClick={() => setPrefs({ theme: next })}
      aria-label={`Theme: ${LABEL[t]}. Switch to ${LABEL[next]}`}
      title={`Theme: ${LABEL[t]}`}
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
      {!compact ? <span>{LABEL[t]}</span> : null}
    </button>
  );
}

export function ThemeSegment() {
  const get = (): Theme => {
    const t = document.documentElement.dataset.theme as Theme | 'contrast' | undefined;
    if (t === 'contrast') return 'dark';
    return t || 'system';
  };
  const [t, setT] = useState<Theme>('system');

  useEffect(() => {
    const sync = () => setT(get());
    sync();
    addEventListener('stuti:prefs', sync);
    addEventListener('storage', sync);
    document.addEventListener('astro:after-swap', sync);
    return () => {
      removeEventListener('stuti:prefs', sync);
      removeEventListener('storage', sync);
      document.removeEventListener('astro:after-swap', sync);
    };
  }, []);

  return (
    <div class="theme-seg" role="group" aria-label="Theme" data-feature="theme">
      {ORDER.map((id) => {
        const Icon = ICON[id];
        return (
          <button
            type="button"
            key={id}
            class={t === id ? 'is-on' : undefined}
            aria-pressed={t === id}
            onClick={() => setPrefs({ theme: id })}
          >
            <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>{LABEL[id]}</span>
          </button>
        );
      })}
    </div>
  );
}
