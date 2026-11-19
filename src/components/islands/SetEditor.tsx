import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { loadMeta, loadNumbers, type Hit, type MetaRow, type NumbersMap } from '../../lib/search';
import {
  MAX_SHARE_URL,
  decodeSet,
  deleteSavedSet,
  encodeSet,
  formatSetDate,
  getDraft,
  getSavedSets,
  isSavedCode,
  moveItem,
  newDraft,
  restoreSavedSet,
  saveDraft,
  saveSet,
  setShareUrl,
  songInSetUrl,
  type SavedSet,
  type SetItem,
  type SetList,
} from '../../lib/setlist';
import { showToast } from '../../lib/toast';
import QrSheet from './QrSheet';
import SongHitRow from './SongHitRow';

type Mode = { kind: 'draft' } | { kind: 'view'; code: string; set: SetList } | { kind: 'invalid' };

function readHash(): Mode {
  const code = new URLSearchParams(location.hash.slice(1)).get('s');
  if (!code) return { kind: 'draft' };
  const set = decodeSet(code);
  return set ? { kind: 'view', code, set } : { kind: 'invalid' };
}

/** Badge for a set item: the number in the book the set chose, else the song's first number. */
function hitFor(item: SetItem, meta: Record<string, MetaRow>, numbers: NumbersMap): Hit | null {
  const row = meta[item.id];
  if (!row) return null;
  let badge = row[3];
  if (item.book) {
    const nums = numbers[item.book];
    const n = nums && Object.keys(nums).find((k) => nums[k] === item.id);
    if (n) badge = `${item.book} ${n}`;
  }
  return { id: item.id, title: row[0], roman: row[1], lang: row[2], badge, score: 0 };
}

export default function SetEditor() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [draft, setDraftState] = useState<SetList>(() => newDraft());
  const [saved, setSaved] = useState<SavedSet[]>([]);
  const [meta, setMeta] = useState<Record<string, MetaRow> | null>(null);
  const [numbers, setNumbers] = useState<NumbersMap>({});
  const [failed, setFailed] = useState(false);
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [undo, setUndo] = useState<SavedSet | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>();

  const loadData = () => {
    setFailed(false);
    Promise.all([loadMeta(), loadNumbers()])
      .then(([m, n]) => {
        setMeta(m);
        setNumbers(n);
      })
      .catch(() => setFailed(true));
  };

  useEffect(() => {
    setDraftState(getDraft());
    setSaved(getSavedSets());
    setMode(readHash());
    const onHash = () => {
      setMode(readHash());
      setSaved(getSavedSets());
      scrollTo(0, 0);
    };
    addEventListener('hashchange', onHash);
    loadData();
    return () => removeEventListener('hashchange', onHash);
  }, []);

  if (!mode) return <div class="set-skeleton" aria-hidden="true" />;

  const editing = mode.kind === 'draft';
  const set = mode.kind === 'view' ? mode.set : draft;
  const code = mode.kind === 'view' ? mode.code : encodeSet(draft);
  const shareUrl = setShareUrl(code);
  const mine = mode.kind === 'view' ? isSavedCode(mode.code) : true;

  const update = (next: SetList) => setDraftState(saveDraft(next));
  const move = (from: number, to: number) => update({ ...draft, s: moveItem(draft.s, from, to) });
  const remove = (i: number) => update({ ...draft, s: draft.s.filter((_, k) => k !== i) });
  const setNote = (i: number, note: string) =>
    update({
      ...draft,
      s: draft.s.map((x, k) => {
        if (k !== i) return x;
        const rest: SetItem = { id: x.id, ...(x.book ? { book: x.book } : {}) };
        return note.trim() ? { ...rest, note: note.slice(0, 200) } : rest;
      }),
    });

  const saveCurrent = () => {
    saveSet(set);
    setSaved(getSavedSets());
    showToast(t('set.saved'));
  };

  const editCopy = () => {
    if (mode.kind !== 'view') return;
    if (draft.s.length && !isSavedCode(encodeSet(draft))) saveSet(draft);
    update(mode.set);
    setSaved(getSavedSets());
    history.replaceState(null, '', '/set/');
    setMode({ kind: 'draft' });
    showToast(t('set.editedToast'));
  };

  const startNew = () => {
    if (draft.s.length && !isSavedCode(encodeSet(draft))) saveSet(draft);
    update(newDraft());
    setSaved(getSavedSets());
  };

  const del = (c: string) => {
    const gone = deleteSavedSet(c);
    setSaved(getSavedSets());
    if (!gone) return;
    setUndo(gone);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  };

  const undoDelete = () => {
    if (undo) restoreSavedSet(undo);
    setUndo(null);
    setSaved(getSavedSets());
  };

  /* Pointer drag on the handle; ▲▼ buttons are the accessible alternative. */
  const onDragStart = (i: number) => (e: PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragFrom(i);
  };
  const onDragMove = (e: PointerEvent) => {
    if (dragFrom === null || !listRef.current) return;
    const rows = [...listRef.current.querySelectorAll<HTMLElement>(':scope > li')];
    const to = rows.findIndex((r) => {
      const b = r.getBoundingClientRect();
      return e.clientY >= b.top && e.clientY <= b.bottom;
    });
    if (to >= 0 && to !== dragFrom) {
      move(dragFrom, to);
      setDragFrom(to);
    }
  };
  const onDragEnd = () => setDragFrom(null);

  return (
    <div class="setlist">
      {mode.kind === 'invalid' && (
        <p class="notice" role="alert">
          {t('set.invalid')}
        </p>
      )}

      {mode.kind === 'view' && !mine && (
        <div class="banner" role="status">
          <span>{t('set.sharedFrom', { title: set.t })}</span>
          <button type="button" class="btn btn--small" onClick={saveCurrent}>
            {t('set.save')}
          </button>
        </div>
      )}

      {editing ? (
        <input
          class="set-title set-title--input"
          aria-label={t('set.titleLabel')}
          value={draft.t}
          maxLength={80}
          onInput={(e) => update({ ...draft, t: e.currentTarget.value })}
        />
      ) : (
        <h2 class="set-title">{set.t}</h2>
      )}
      {set.d && <span class="date-chip">{formatSetDate(set.d)}</span>}

      {failed && (
        <p class="notice">
          {t('search.loadError')}{' '}
          <button type="button" class="btn btn--small" onClick={loadData}>
            {t('error.retry')}
          </button>
        </p>
      )}

      {set.s.length === 0 ? (
        <div class="empty">
          <p>{t('set.empty')}</p>
          <a class="btn btn--secondary" href="/search/">
            {t('set.searchSongs')}
          </a>
        </div>
      ) : (
        <ol class="set-rows" ref={listRef} data-testid="set-rows">
          {set.s.map((item, i) => {
            const hit = meta ? hitFor(item, meta, numbers) : null;
            return (
              <li class={`set-row${dragFrom === i ? ' is-dragging' : ''}`} key={`${item.id}-${i}`}>
                <span class="set-row__num" aria-hidden="true">
                  {i + 1}
                </span>
                <div class="set-row__main">
                  {hit ? (
                    <SongHitRow hit={hit} href={songInSetUrl(set, code, i)} />
                  ) : meta ? (
                    <p class="set-row__gone">{t('set.unavailable')}</p>
                  ) : (
                    <div class="row-skeleton" aria-hidden="true" />
                  )}
                  {editing && editingNote === i ? (
                    <input
                      class="set-row__note-input"
                      aria-label={t('set.note')}
                      placeholder={t('set.notePlaceholder')}
                      maxLength={200}
                      value={item.note ?? ''}
                      ref={(el) => el?.focus()}
                      onInput={(e) => setNote(i, e.currentTarget.value)}
                      onBlur={() => setEditingNote(null)}
                      onKeyDown={(e) => e.key === 'Enter' && setEditingNote(null)}
                    />
                  ) : editing ? (
                    <button type="button" class="set-row__note" onClick={() => setEditingNote(i)}>
                      {item.note || t('set.notePlaceholder')}
                    </button>
                  ) : (
                    item.note && <p class="set-row__note set-row__note--ro">{item.note}</p>
                  )}
                </div>
                {editing && (
                  <div class="set-row__ctrl">
                    <span
                      class="drag-handle"
                      title={t('set.drag')}
                      aria-hidden="true"
                      onPointerDown={onDragStart(i)}
                      onPointerMove={onDragMove}
                      onPointerUp={onDragEnd}
                      onPointerCancel={onDragEnd}
                    >
                      ⠿
                    </span>
                    <button
                      type="button"
                      class="mini-btn"
                      aria-label={`${t('set.moveUp')}: ${hit?.title ?? item.id}`}
                      disabled={i === 0}
                      onClick={() => move(i, i - 1)}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      class="mini-btn"
                      aria-label={`${t('set.moveDown')}: ${hit?.title ?? item.id}`}
                      disabled={i === set.s.length - 1}
                      onClick={() => move(i, i + 1)}
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      class="mini-btn"
                      aria-label={`${t('set.remove')}: ${hit?.title ?? item.id}`}
                      onClick={() => remove(i)}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {shareUrl.length > MAX_SHARE_URL && <p class="notice">{t('set.tooLong')}</p>}

      {set.s.length > 0 && (
        <div class="action-bar">
          <a class="btn btn--primary" href={songInSetUrl(set, code, 0)}>
            {t('set.start')}
          </a>
          <button type="button" class="btn btn--secondary" onClick={() => setQrOpen(true)}>
            {t('set.share')}
          </button>
          {editing ? (
            <button type="button" class="btn btn--secondary" onClick={saveCurrent}>
              {t('set.save')}
            </button>
          ) : (
            <button type="button" class="btn btn--secondary" onClick={editCopy}>
              {t('set.edit')}
            </button>
          )}
        </div>
      )}

      <QrSheet open={qrOpen} onClose={() => setQrOpen(false)} url={shareUrl} title={set.t} />

      <section class="my-sets" aria-labelledby="my-sets-title">
        <div class="my-sets__head">
          <h2 class="group-title" id="my-sets-title">
            {t('set.mySets')}
          </h2>
          {editing ? (
            draft.s.length > 0 && (
              <button type="button" class="btn btn--small" onClick={startNew}>
                {t('set.newSet')}
              </button>
            )
          ) : (
            <a class="btn btn--small" href="/set/">
              {t('home.sunday')}
            </a>
          )}
        </div>
        {undo && (
          <p class="undo-bar" role="status">
            {t('set.deleted')}
            <button type="button" class="btn btn--small" onClick={undoDelete}>
              {t('set.undo')}
            </button>
          </p>
        )}
        <ul class="my-sets__list">
          {saved.map((s) => (
            <li class="my-set" key={s.code}>
              <a class="my-set__link" href={`/set/#s=${s.code}`}>
                <span class="my-set__title">{s.t}</span>
                <span class="muted">
                  {t('set.songs', { n: s.s.length })}
                  {s.d ? ` · ${formatSetDate(s.d)}` : ''}
                </span>
              </a>
              <button
                type="button"
                class="mini-btn"
                aria-label={`${t('set.delete')}: ${s.t}`}
                onClick={() => del(s.code)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
