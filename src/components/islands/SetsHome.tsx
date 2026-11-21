import { useEffect, useMemo, useState } from 'preact/hooks';
import { t } from '../../i18n';
import {
  deleteSet,
  duplicateSet,
  getSets,
  hydrateSets,
  listenSetsChanged,
  pastSets,
  serviceLabel,
  songItems,
  upcomingSets,
  type WorshipSet,
} from '../../lib/sets';
import { formatSetDate } from '../../lib/setlist';
import { showToast } from '../../lib/toast';
import NewSetDialog from './NewSetDialog';
import SetsCalendar from './SetsCalendar';

type Tab = 'list' | 'calendar';

function SetCard({ set, past }: { set: WorshipSet; past?: boolean }) {
  const n = songItems(set).length;
  return (
    <article class={past ? 'sets-card sets-card--past' : 'sets-card'}>
      <a class="sets-card__main" href={`/sets/edit/?id=${encodeURIComponent(set.id)}`}>
        <h3 class="sets-card__title">{set.title}</h3>
        <p class="sets-card__meta">
          {formatSetDate(set.date)} · {serviceLabel(set.service)} ·{' '}
          {n === 1 ? t('set.songs.one') : t('set.songs', { n })}
        </p>
      </a>
      <div class="sets-card__acts">
        <a class="btn btn--secondary btn--small" href={`/sets/edit/?id=${encodeURIComponent(set.id)}`}>
          {t('set.open')}
        </a>
        <button
          type="button"
          class="icon-btn"
          aria-label={t('set.useAgain')}
          title={t('set.useAgain')}
          onClick={() => {
            const copy = duplicateSet(set.id);
            if (copy) {
              showToast(t('set.duplicated'));
              location.href = `/sets/edit/?id=${encodeURIComponent(copy.id)}`;
            }
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
            <path d="M17 3v4h4" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M7 21a8 8 0 0 1 0-16h10l4 4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          class="icon-btn"
          aria-label={t('set.delete')}
          title={t('set.delete')}
          onClick={() => {
            deleteSet(set.id);
            showToast(t('set.deleted'));
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
            <path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </article>
  );
}

export default function SetsHome() {
  const [tab, setTab] = useState<Tab>('list');
  const [sets, setSets] = useState<WorshipSet[]>([]);
  const [dialog, setDialog] = useState(false);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  useEffect(() => {
    hydrateSets();
    const refresh = () => setSets(getSets());
    refresh();
    return listenSetsChanged(refresh);
  }, []);

  const upcoming = useMemo(() => upcomingSets(), [sets]);
  const past = useMemo(() => pastSets(), [sets]);

  const useLastWeek = () => {
    const last = past[0];
    if (!last) {
      showToast(t('set.noPast'));
      return;
    }
    const copy = duplicateSet(last.id);
    if (copy) location.href = `/sets/edit/?id=${encodeURIComponent(copy.id)}`;
  };

  return (
    <div class="sets-home">
      <header class="sets-home__head">
        <h1>{t('sets.title')}</h1>
        <div class="sets-home__toolbar">
          <button type="button" class="btn btn--primary" onClick={() => setDialog(true)}>
            + {t('set.newSet')}
          </button>
          <button type="button" class="btn btn--secondary" onClick={useLastWeek}>
            {t('set.useLastWeek')}
          </button>
        </div>
        <div class="sets-home__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'list'}
            class={tab === 'list' ? 'is-active' : undefined}
            onClick={() => setTab('list')}
          >
            {t('sets.list')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'calendar'}
            class={tab === 'calendar' ? 'is-active' : undefined}
            onClick={() => setTab('calendar')}
          >
            {t('sets.calendar')}
          </button>
        </div>
      </header>

      {tab === 'calendar' ? (
        <SetsCalendar
          year={month.y}
          month={month.m}
          sets={sets}
          onMonthChange={(y, m) => setMonth({ y, m })}
        />
      ) : (
        <>
          <section class="sets-section">
            <h2>{t('sets.upcoming')}</h2>
            {upcoming.length === 0 ? (
              <p class="muted">{t('sets.emptyUpcoming')}</p>
            ) : (
              upcoming.map((s) => <SetCard key={s.id} set={s} />)
            )}
          </section>
          <section class="sets-section">
            <h2>{t('sets.past')}</h2>
            {past.length === 0 ? (
              <p class="muted">{t('sets.emptyPast')}</p>
            ) : (
              past.map((s) => <SetCard key={s.id} set={s} past />)
            )}
          </section>
        </>
      )}

      <NewSetDialog
        open={dialog}
        onClose={() => setDialog(false)}
        onCreated={(id) => {
          location.href = `/sets/edit/?id=${encodeURIComponent(id)}`;
        }}
      />
    </div>
  );
}
