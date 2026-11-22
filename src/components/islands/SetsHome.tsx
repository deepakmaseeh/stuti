import { useEffect, useMemo, useState } from 'preact/hooks';
import { Pencil, Play, Plus, Trash2 } from 'lucide-preact';
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
  undoDeleteSet,
  upcomingSets,
  type WorshipSet,
} from '../../lib/sets';
import { loadMeta, type MetaRow } from '../../lib/search';
import { showToast } from '../../lib/toast';
import NewSetDialog from './NewSetDialog';
import SetsCalendar from './SetsCalendar';

type Tab = 'list' | 'calendar';

function dateParts(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  const weekday = new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(dt).toUpperCase();
  const month = new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(dt).toUpperCase();
  return { weekday, day: String(d).padStart(2, '0'), month };
}

function SetCard({
  set,
  past,
  next,
  meta,
  onAskDelete,
}: {
  set: WorshipSet;
  past?: boolean;
  next?: boolean;
  meta: Record<string, MetaRow> | null;
  onAskDelete: (set: WorshipSet) => void;
}) {
  const songs = songItems(set);
  const n = songs.length;
  const parts = dateParts(set.date);
  const preview = songs
    .slice(0, 4)
    .map((s) => {
      const title = meta?.[s.songId]?.[0] ?? s.songId;
      const badge = meta?.[s.songId]?.[3] ?? s.book ?? '';
      const short = title.length > 18 ? `${title.slice(0, 16)}…` : title;
      return badge ? `${badge.split(/\s+/).pop()} ${short}` : short;
    })
    .join(' · ');
  const today = new Date().toISOString().slice(0, 10);
  const isThisSunday = !past && set.date >= today && set.date <= addDays(today, 6);

  const editHref = `/sets/edit/?id=${encodeURIComponent(set.id)}`;
  const singHref = songs[0] ? `/song/${songs[0].songId}/?set=${encodeURIComponent(set.id)}&i=0` : editHref;

  return (
    <article class={['scard', next ? 'scard--next' : '', past ? 'scard--past' : ''].filter(Boolean).join(' ')}>
      <a class="scard__date" href={editHref} aria-label={set.date}>
        <i>{parts.weekday}</i>
        <b>{parts.day}</b>
        <i>{parts.month}</i>
      </a>
      <a class="scard__body" href={editHref}>
        <h3>{set.title}</h3>
        <div class="scard__meta">
          {isThisSunday ? <span class="pill pill--red">This Sunday</span> : null}
          <span class="pill">{serviceLabel(set.service)}</span>
          {set.time ? `${set.time} · ` : ''}
          {set.leader ? `${set.leader} · ` : ''}
          {n === 1 ? t('set.songs.one') : t('set.songs', { n })}
        </div>
        {preview ? <div class="scard__songs hi">{preview}{n > 4 ? ` · +${n - 4}` : ''}</div> : null}
      </a>
      <div class="scard__acts">
        {!past && songs[0] ? (
          <a class="btn btn--primary btn--small" href={singHref} data-astro-reload>
            <Play size={16} strokeWidth={1.75} aria-hidden="true" /> Sing
          </a>
        ) : null}
        <a class="btn btn--secondary btn--small btn--icon" href={editHref} aria-label="Edit" title="Edit">
          <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
        </a>
        <button
          type="button"
          class="btn btn--secondary btn--small btn--icon"
          aria-label={t('set.delete')}
          title={t('set.delete')}
          onClick={() => onAskDelete(set)}
        >
          <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function DeleteSetDialog({
  set,
  onClose,
  onConfirm,
}: {
  set: WorshipSet;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    document.body.classList.add('modal-open');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('modal-open');
      removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div class="modal modal--center" role="dialog" aria-modal="true" aria-labelledby="delete-set-title">
      <div class="modal__backdrop" onClick={onClose} />
      <div class="modal__card">
        <header class="modal__head">
          <h2 id="delete-set-title">{t('set.deleteTitle')}</h2>
        </header>
        <div class="modal__body">
          <p class="modal__sub">{t('set.deleteBody', { title: set.title })}</p>
        </div>
        <div class="modal__actions">
          <button type="button" class="btn btn--ghost" onClick={onClose}>
            {t('set.cancel')}
          </button>
          <button type="button" class="btn btn--primary" onClick={onConfirm}>
            {t('set.deleteConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function toastWithUndo() {
  showToast(`${t('set.deleted')} · ${t('set.undo')}`);
  const undo = () => {
    undoDeleteSet();
    removeEventListener('click', onToast);
  };
  const onToast = (e: Event) => {
    const el = e.target as HTMLElement;
    if (el.closest('#toast')) undo();
  };
  addEventListener('click', onToast, { once: true });
  setTimeout(() => removeEventListener('click', onToast), 4000);
}

export default function SetsHome() {
  const [tab, setTab] = useState<Tab>('list');
  const [sets, setSets] = useState<WorshipSet[]>([]);
  const [dialog, setDialog] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<WorshipSet | null>(null);
  const [meta, setMeta] = useState<Record<string, MetaRow> | null>(null);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  useEffect(() => {
    hydrateSets();
    const refresh = () => setSets(getSets());
    refresh();
    loadMeta().then(setMeta).catch(() => {});
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

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteSet(pendingDelete.id);
    setPendingDelete(null);
    toastWithUndo();
  };

  return (
    <div class="sets-home">
      <header class="sets-home__head">
        <h1>{t('sets.title')}</h1>
        <div class="sets-home__toolbar">
          <button type="button" class="btn btn--primary" onClick={() => setDialog(true)}>
            <Plus size={18} strokeWidth={1.75} aria-hidden="true" /> {t('set.newSet')}
          </button>
          <button
            type="button"
            class="btn btn--secondary"
            onClick={useLastWeek}
            disabled={!past.length}
            title={!past.length ? t('set.noPast') : undefined}
          >
            {t('set.copyLastSunday')}
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
            <div class="sets-section__head">
              <h2>{t('sets.upcoming')}</h2>
              <span>{upcoming.length}</span>
            </div>
            {upcoming.length === 0 ? (
              <div class="sets-empty">{t('sets.emptyUpcoming')}</div>
            ) : (
              <div class="slist">
                {upcoming.map((s, i) => (
                  <SetCard key={s.id} set={s} next={i === 0} meta={meta} onAskDelete={setPendingDelete} />
                ))}
              </div>
            )}
          </section>
          <section class="sets-section">
            <div class="sets-section__head">
              <h2>{t('sets.past')}</h2>
              <span>{past.length}</span>
            </div>
            {past.length === 0 ? (
              <div class="sets-empty">{t('sets.emptyPast')}</div>
            ) : (
              <div class="slist">
                {past.map((s) => (
                  <SetCard key={s.id} set={s} past meta={meta} onAskDelete={setPendingDelete} />
                ))}
              </div>
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

      {pendingDelete ? (
        <DeleteSetDialog
          set={pendingDelete}
          onClose={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
