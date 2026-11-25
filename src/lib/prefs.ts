/** Theme / layout prefs (STUTI_MASTER_SPEC §3). Survives ClientRouter swaps. */

export const PREFS_KEY = 'stuti:prefs';

export type Theme = 'system' | 'light' | 'dark';
export type Prefs = {
  theme?: Theme;
  size?: number;
  layers?: { n: boolean; r: boolean; e: boolean };
  layout?: 'stacked' | 'columns';
  keepAwake?: boolean;
  lastBookId?: string;
  lastTab?: string;
  langFilter?: string;
  searchLangs?: string[];
  v?: number;
};

const THEME_COLOR: Record<'light' | 'dark', string> = {
  light: '#4a1820',
  dark: '#1a0f11',
};

export function readPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') as Prefs & { theme?: string };
    // Migrate removed contrast theme → dark
    if (raw.theme === 'contrast') raw.theme = 'dark';
    return raw;
  } catch {
    return {};
  }
}

export function resolveTheme(t: Theme = 'system'): 'light' | 'dark' {
  if (t === 'light' || t === 'dark') return t;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyPrefs(root: HTMLElement = document.documentElement, p: Prefs = readPrefs()): void {
  let chosen: Theme = p.theme ?? 'system';
  if ((chosen as string) === 'contrast') chosen = 'dark';
  const scheme = resolveTheme(chosen);
  root.dataset.theme = chosen;
  root.dataset.scheme = scheme;
  root.style.colorScheme = scheme === 'light' ? 'light' : 'dark';
  const l = p.layers ?? { n: true, r: true, e: false };
  root.dataset.layers = (['n', 'r', 'e'] as const).filter((k) => l[k]).join(' ') || 'n';
  const desktop = root.dataset.desktop;
  root.dataset.size = String(p.size ?? (desktop ? 3 : 2));
  root.dataset.layout = p.layout === 'columns' || desktop === 'wide' ? 'columns' : 'stacked';
  const meta = root.ownerDocument.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[scheme]);
}

export function setPrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...readPrefs(), ...patch };
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  applyPrefs(document.documentElement, next);
  dispatchEvent(new CustomEvent('stuti:prefs', { detail: next }));
  return next;
}
