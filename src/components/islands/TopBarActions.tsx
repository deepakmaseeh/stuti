import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { storage, updatePrefs, type Theme } from '../../lib/storage';
import { isAwake, setKeepAwake, wakeLockSupported } from '../../lib/wakelock';
import { getActiveSet, hydrateSets, listenSetsChanged, songItems, type WorshipSet } from '../../lib/sets';

const THEMES: Theme[] = ['light', 'dark', 'contrast', 'system'];

export default function TopBarActions() {
  const [theme, setTheme] = useState<Theme>('system');
  const [awake, setAwake] = useState(false);
  const [active, setActive] = useState<WorshipSet | undefined>();
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    hydrateSets();
    const p = storage.prefs.get();
    setTheme(p.theme);
    setAwake(isAwake());
    const refresh = () => setActive(getActiveSet());
    refresh();
    setOfflineReady(Object.keys(storage.downloads.get()).length > 0);

    const onLang = (e: Event) => {
      const btn = (e.target as HTMLElement).closest('[data-lang]') as HTMLElement | null;
      if (!btn || !btn.closest('[data-lang-filter]')) return;
      const id = btn.getAttribute('data-lang') || 'all';
      updatePrefs({ langFilter: id });
      document.querySelectorAll('[data-lang-filter] [data-lang]').forEach((el) => {
        el.setAttribute('aria-pressed', el.getAttribute('data-lang') === id ? 'true' : 'false');
      });
      dispatchEvent(new CustomEvent('stuti:lang-filter', { detail: { lang: id } }));
    };
    addEventListener('click', onLang);
    const off = listenSetsChanged(refresh);
    return () => {
      removeEventListener('click', onLang);
      off();
    };
  }, []);

  const cycleTheme = () => {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]!;
    updatePrefs({ theme: next });
    document.documentElement.dataset.theme = next;
    setTheme(next);
  };

  const toggleAwake = async () => {
    try {
      await setKeepAwake(!awake);
      updatePrefs({ keepAwake: !awake });
      setAwake(!awake);
    } catch {
      /* unsupported */
    }
  };

  const openDrawer = () => {
    document.querySelector('.desktop-set')?.classList.add('is-open');
    document.querySelector('.desktop-set-drawer-backdrop')?.classList.add('is-open');
  };

  const count = active ? songItems(active).length : 0;
  const shortTitle = active?.title
    ? active.title.length > 22
      ? `${active.title.slice(0, 20)}…`
      : active.title
    : t('nav.sets');

  return (
    <div class="topbar__acts">
      {offlineReady && (
        <span class="topbar__pill">
          <i class="topbar__pill-dot" aria-hidden="true" />
          {t('home.offlineReady')}
        </span>
      )}
      {wakeLockSupported() && (
        <button
          type="button"
          class="topbar__btn topbar-keep-awake"
          aria-pressed={awake ? 'true' : 'false'}
          onClick={toggleAwake}
        >
          ☀ {awake ? t('song.screenOn') : t('song.keepAwake')}
        </button>
      )}
      <button type="button" class="topbar__btn" onClick={cycleTheme} title={t('desktop.theme')}>
        ◐ {t('desktop.theme')}
      </button>
      <button
        type="button"
        class="topbar__setpill"
        onClick={openDrawer}
        title={active ? `${active.title} · ${count} songs` : t('desktop.thisSunday')}
      >
        <span class="topbar__setpill-dot" aria-hidden="true" />
        <b>{shortTitle}</b>
        <span>({count})</span>
      </button>
    </div>
  );
}
