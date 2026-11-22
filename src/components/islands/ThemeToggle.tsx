import { useEffect, useState } from 'preact/hooks';
import { Contrast, MonitorSmartphone, Moon, Sun } from 'lucide-preact';
import { setPrefs, type Theme } from '../../lib/prefs';

const ORDER: Theme[] = ['system', 'light', 'dark', 'contrast'];
const ICON = { system: MonitorSmartphone, light: Sun, dark: Moon, contrast: Contrast } as const;
const LABEL = {
  system: 'Same as phone',
  light: 'Light',
  dark: 'Dark',
  contrast: 'High contrast',
} as const;

/** Cycles theme; never caches — reads DOM + listens for prefs events (§3.4). */
export default function ThemeToggle({ compact = true }: { compact?: boolean }) {
  const get = (): Theme => (document.documentElement.dataset.theme as Theme) || 'system';
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
