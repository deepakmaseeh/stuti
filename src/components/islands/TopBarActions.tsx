import { useEffect, useState } from 'preact/hooks';
import { ListMusic, Plus } from 'lucide-preact';
import { t } from '../../i18n';
import { getActiveSet, hydrateSets, listenSetsChanged, songItems, type WorshipSet } from '../../lib/sets';

/** Desktop header: ActiveSetPill only (theme/settings live in Settings; keep-awake on song toolbar). */
export default function TopBarActions() {
  const [active, setActive] = useState<WorshipSet | undefined>();

  useEffect(() => {
    hydrateSets();
    const refresh = () => setActive(getActiveSet());
    refresh();
    return listenSetsChanged(refresh);
  }, []);

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
      <button
        type="button"
        class="topbar__setpill"
        onClick={openDrawer}
        data-feature="add-to-set"
        title={active ? `${active.title} · ${count} songs` : t('desktop.thisSunday')}
      >
        <span class="topbar__setpill-dot" aria-hidden="true" />
        {active ? (
          <>
            <ListMusic size={16} strokeWidth={1.75} aria-hidden="true" />
            <b>{shortTitle}</b>
            <span>
              · {count} {count === 1 ? 'song' : 'songs'}
            </span>
          </>
        ) : (
          <>
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
            <span>Plan Sunday</span>
          </>
        )}
      </button>
    </div>
  );
}
