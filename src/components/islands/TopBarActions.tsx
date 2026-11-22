import { useEffect, useState } from 'preact/hooks';
import { ListMusic, Sun } from 'lucide-preact';
import { t } from '../../i18n';
import { storage, updatePrefs } from '../../lib/storage';
import { isAwake, setKeepAwake, wakeLockSupported } from '../../lib/wakelock';
import { getActiveSet, hydrateSets, listenSetsChanged, songItems, type WorshipSet } from '../../lib/sets';

/** Desktop header actions: Keep awake + ActiveSetPill (theme is ThemeToggle). */
export default function TopBarActions() {
  const [awake, setAwake] = useState(false);
  const [active, setActive] = useState<WorshipSet | undefined>();
  const [wide, setWide] = useState(false);

  useEffect(() => {
    hydrateSets();
    setAwake(isAwake());
    setWide(matchMedia('(min-width: 1280px)').matches);
    const refresh = () => setActive(getActiveSet());
    refresh();
    return listenSetsChanged(refresh);
  }, []);

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
    ? active.title.length > 28
      ? `${active.title.slice(0, 26)}…`
      : active.title
    : '';

  return (
    <div class="topbar__acts">
      {wakeLockSupported() && (
        <button
          type="button"
          class="icon-btn topbar-keep-awake"
          aria-pressed={awake ? 'true' : 'false'}
          onClick={toggleAwake}
          data-feature="keep-awake"
          title={awake ? t('song.screenOn') : t('song.keepAwake')}
          aria-label={awake ? t('song.screenOn') : t('song.keepAwake')}
        >
          <Sun size={20} strokeWidth={1.75} aria-hidden="true" />
          {wide ? <span>{awake ? t('song.screenOn') : t('song.keepAwake')}</span> : null}
        </button>
      )}
      <button
        type="button"
        class="topbar__setpill"
        onClick={openDrawer}
        data-feature="add-to-set"
        title={active ? `${active.title} · ${count} songs` : t('desktop.thisSunday')}
      >
        <span class="topbar__setpill-dot" aria-hidden="true" />
        <ListMusic size={16} strokeWidth={1.75} aria-hidden="true" />
        {active ? (
          <>
            <b>{shortTitle}</b>
            <span>
              · {count} {count === 1 ? 'song' : 'songs'}
            </span>
          </>
        ) : (
          <span>+ Plan a set</span>
        )}
      </button>
    </div>
  );
}
