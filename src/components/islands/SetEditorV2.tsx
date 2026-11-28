import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { GripVertical, Pencil, Presentation, X } from 'lucide-preact';
import { t } from '../../i18n';
import { loadMeta, loadNumbers, type MetaRow, type NumbersMap } from '../../lib/search';
import {
  addHeading,
  addSongToSet,
  duplicateSet,
  getSet,
  hydrateSets,
  listenSetsChanged,
  moveRowInSet,
  removeItem,
  serviceLabel,
  setActive,
  songInWorshipSetUrl,
  songItems,
  updateSet,
  type ServiceType,
  type WorshipSet,
} from '../../lib/sets';
import type { SlideRow, SlideStyle, SongRow, VerseNote } from '../../lib/sets/schema';
import { isParseAddHit, parseAdd } from '../../lib/sets/parseAdd';
import { readPrefs } from '../../lib/prefs';
import { showToast } from '../../lib/toast';
import { site } from '../../site.config';
import ShareSheet from './ShareSheet';
import Sheet from './Sheet';
import SongsPicker from './SongsPicker';

const KEY_CHIPS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
const SERVICES: ServiceType[] = [
  'sunday_morning',
  'sunday_evening',
  'prayer',
  'youth',
  'christmas',
  'easter',
  'good_friday',
  'wedding',
  'funeral',
  'other',
];

function readId(): string | null {
  return new URLSearchParams(location.search).get('id');
}

function Icon({
  children,
  label,
  filled = false,
}: {
  children: ComponentChildren;
  label?: string;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden={label ? undefined : true}
      aria-label={label}
    >
      {children}
    </svg>
  );
}

export default function SetEditorV2() {
  const [set, setSet] = useState<WorshipSet | undefined>();
  const [meta, setMeta] = useState<Record<string, MetaRow> | null>(null);
  const [numbers, setNumbers] = useState<NumbersMap>({});
  const [quick, setQuick] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [songsOpen, setSongsOpen] = useState(false);
  const [heading, setHeading] = useState('');
  const [missing, setMissing] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [targetHeading, setTargetHeading] = useState<string | null>(null);
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [renamingUid, setRenamingUid] = useState<string | null>(null);
  const [musician, setMusician] = useState(false);
  const [slideOpen, setSlideOpen] = useState(false);
  const [slideAfterIdx, setSlideAfterIdx] = useState<number | null>(null);
  const [slideStyle, setSlideStyle] = useState<SlideStyle>('text');
  const [slideTitle, setSlideTitle] = useState('');
  const [slideBody, setSlideBody] = useState('');
  const [noteSt, setNoteSt] = useState('v1');
  const [noteText, setNoteText] = useState('');
  const [noteMode, setNoteMode] = useState<'inline' | 'slide'>('inline');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [liveMsg, setLiveMsg] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const syncPrefs = () => setMusician(Boolean(readPrefs().musician));
    syncPrefs();
    addEventListener('stuti:prefs', syncPrefs);
    return () => removeEventListener('stuti:prefs', syncPrefs);
  }, []);

  const flashSaved = () => {
    setSavedFlash(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedFlash(false), 1600);
  };

  const patch = (id: string, next: Parameters<typeof updateSet>[1]) => {
    updateSet(id, next);
    flashSaved();
  };

  useEffect(() => {
    hydrateSets();
    const refresh = (activate = false) => {
      const id = readId();
      if (!id) {
        setMissing(true);
        return;
      }
      const found = getSet(id);
      if (!found) {
        setMissing(true);
        return;
      }
      setMissing(false);
      setSet({ ...found });
      if (activate) setActive(id);
    };
    refresh(true);
    Promise.all([loadMeta(), loadNumbers()])
      .then(([m, n]) => {
        setMeta(m);
        setNumbers(n);
      })
      .catch(() => { });
    const onNav = () => refresh(true);
    document.addEventListener('astro:page-load', onNav);
    addEventListener('popstate', onNav);
    const off = listenSetsChanged(() => refresh(false));
    return () => {
      document.removeEventListener('astro:page-load', onNav);
      removeEventListener('popstate', onNav);
      off();
      clearTimeout(savedTimer.current);
    };
  }, []);

  const songs = useMemo(() => (set ? songItems(set) : []), [set]);
  const titles = useMemo(() => {
    const map: Record<string, string> = {};
    if (!meta) return map;
    for (const s of songs) map[s.songId] = meta[s.songId]?.[0] ?? s.songId;
    return map;
  }, [meta, songs]);

  if (missing) {
    return (
      <div class="notice">
        <p>{t('set.notFound')}</p>
        <a href="/sets/">{t('sets.back')}</a>
      </div>
    );
  }

  if (!set) return <div class="set-skeleton" aria-hidden="true" />;

  const startHref = songs[0] ? songInWorshipSetUrl(set, 0) : undefined;
  const presentHref = songs[0] ? `/present/?id=${encodeURIComponent(set.id)}&i=0` : undefined;

  const badgeFor = (songId: string, book?: string) => {
    const row = meta?.[songId];
    if (!row) return book ?? '';
    if (book && numbers[book]) {
      const n = Object.keys(numbers[book]!).find((k) => numbers[book]![k] === songId);
      if (n) return `${book} ${n}`;
    }
    return row[3];
  };

  const headings = useMemo(
    () => (set ? set.items.filter((x): x is Extract<typeof x, { kind: 'heading' }> => x.kind === 'heading') : []),
    [set],
  );
  const effectiveTarget =
    targetHeading && headings.some((h) => h.uid === targetHeading)
      ? targetHeading
      : (headings[0]?.uid ?? null);

  const resolveQuickAdd = (forceHeading?: string | null) => {
    if (!set) return;
    const raw = quick.trim();
    if (!raw) return;
    const defaultBook = site.defaultBookId;
    const tokens = parseAdd(raw, defaultBook);
    const misses: string[] = [];
    const kept: string[] = [];
    let added = 0;
    const section = forceHeading !== undefined ? forceHeading : effectiveTarget;

    for (const tok of tokens) {
      if (!isParseAddHit(tok)) {
        misses.push(tok.raw);
        kept.push(tok.raw);
        continue;
      }
      const map = numbers[tok.book] ?? numbers[tok.book.toUpperCase()];
      const songId = map?.[String(tok.no)] ?? map?.[tok.no];
      if (!songId) {
        misses.push(tok.raw);
        kept.push(tok.raw);
        continue;
      }
      if (!addSongToSet(set.id, { songId, book: tok.book }, { afterHeadingUid: section })) {
        showToast(t('set.fullToast'));
        kept.push(tok.raw);
        continue;
      }
      added++;
    }

    setQuick(kept.join(', '));
    if (added) flashSaved();
    if (misses.length && added) showToast(t('set.partialAdded', { n: added, list: misses.join(', ') }));
    else if (misses.length) showToast(t('set.songsNotFound', { list: misses.join(', ') }));
    else if (added) showToast(t('set.addedToast'));
  };

  return (
    <div class="set-editor-v2">
      <header class="set-editor-v2__head">
        <div class="set-editor-v2__nav">
          <a href="/sets/" class="set-editor-v2__back">
            <Icon>
              <path d="M15 18l-6-6 6-6" />
            </Icon>
            <span>{t('sets.back')}</span>
          </a>
          <span class={savedFlash ? 'set-editor-v2__saved is-on' : 'set-editor-v2__saved'} aria-live="polite">
            {savedFlash ? t('set.savedFlash') : t('set.autosave')}
          </span>
        </div>

        <label class="field">
          <span class="field__label">{t('set.titleLabel')}</span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
              ref={titleInputRef}
              class="field__input set-editor-v2__title-input"
              value={set.title}
              maxLength={80}
              onInput={(e) => patch(set.id, { title: e.currentTarget.value })}
            />
            <button
              type="button"
              class="ib ink"
              aria-label="Rename set"
              title="Rename set"
              onClick={() => {
                titleInputRef.current?.focus();
                titleInputRef.current?.select();
              }}
            >
              <Pencil size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </label>

        <div class="set-editor-v2__meta-row">
          <label class="field">
            <span class="field__label">{t('set.date')}</span>
            <input
              class="field__input"
              type="date"
              value={set.date}
              lang="en-IN"
              onClick={(e) => {
                try {
                  (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
                } catch {
                  /* unsupported */
                }
              }}
              onInput={(e) => patch(set.id, { date: e.currentTarget.value })}
            />
          </label>
          <label class="field">
            <span class="field__label">{t('set.time')}</span>
            <input
              class="field__input"
              type="time"
              value={set.time ?? ''}
              onInput={(e) => patch(set.id, { time: e.currentTarget.value || undefined })}
            />
          </label>
          <label class="field">
            <span class="field__label">{t('set.service')}</span>
            <select
              class="field__input"
              value={set.service}
              onChange={(e) => patch(set.id, { service: e.currentTarget.value as ServiceType })}
            >
              {SERVICES.map((s) => (
                <option value={s} key={s}>
                  {serviceLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label class="field">
            <span class="field__label">{t('set.leader')}</span>
            <input
              class="field__input"
              type="text"
              maxLength={80}
              value={set.leader ?? ''}
              onInput={(e) => {
                const leader = e.currentTarget.value.slice(0, 80);
                patch(set.id, { leader: leader || undefined });
              }}
            />
          </label>
        </div>
      </header>

      <div class="set-editor-v2__add-block">
        {headings.length ? (
          <label class="field set-editor-v2__target">
            <span class="field__label">{t('set.targetSection')}</span>
            <select
              class="field__input"
              value={effectiveTarget ?? ''}
              onChange={(e) => setTargetHeading(e.currentTarget.value || null)}
            >
              {headings.map((h) => (
                <option value={h.uid} key={h.uid}>
                  {h.text || 'Section'}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div class="set-editor-v2__quick">
          <input
            class="field__input"
            type="search"
            inputMode="text"
            enterkeyhint="done"
            placeholder={t('set.quickAdd')}
            aria-label={t('set.quickAdd')}
            value={quick}
            onInput={(e) => setQuick(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                resolveQuickAdd();
              }
            }}
          />
          <button
            type="button"
            class="btn btn--primary btn--icon"
            aria-label={t('set.add')}
            onClick={() => resolveQuickAdd()}
          >
            <Icon>
              <path d="M12 5v14M5 12h14" />
            </Icon>
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" class="btn btn--secondary set-editor-v2__songs-btn" onClick={() => setSongsOpen(true)}>
            <Icon>
              <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
            </Icon>
            <span>{t('set.songsBtn')}</span>
          </button>
          <button
            type="button"
            class="btn btn--secondary"
            onClick={() => {
              setSlideAfterIdx(null);
              setSlideStyle('text');
              setSlideTitle('');
              setSlideBody('');
              setSlideOpen(true);
            }}
          >
            <Presentation size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>New slide</span>
          </button>
        </div>

        <div class="set-editor-v2__heading-add">
          <input
            class="field__input"
            type="text"
            maxLength={80}
            placeholder={t('set.addHeading')}
            aria-label={t('set.addHeading')}
            value={heading}
            onInput={(e) => setHeading(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && heading.trim()) {
                e.preventDefault();
                addHeading(set.id, heading.trim());
                setHeading('');
                flashSaved();
              }
            }}
          />
          <button
            type="button"
            class="btn btn--secondary btn--icon"
            aria-label={t('set.addHeading')}
            disabled={!heading.trim()}
            onClick={() => {
              if (!heading.trim()) return;
              addHeading(set.id, heading.trim());
              setHeading('');
              flashSaved();
            }}
          >
            <Icon>
              <path d="M4 6h16M4 12h10M4 18h16" />
            </Icon>
          </button>
        </div>
      </div>

      <div class="visually-hidden" aria-live="polite">
        {liveMsg}
      </div>
      <ol class="set-editor-v2__list">
        {set.rows.map((r, idx) => {
          const nextIsHeading =
            idx === set.rows.length - 1 || set.rows[idx + 1]?.k === 'h';
          const doMove = (from: number, to: number) => {
            moveRowInSet(set.id, from, to);
            flashSaved();
            setLiveMsg(`Moved to position ${to + 1}`);
          };

          if (r.k === 'h') {
            const isTarget = r.id === effectiveTarget;
            const emptySection = nextIsHeading;
            const isRenaming = renamingUid === r.id;
            return (
              <li
                class={`shead${isTarget ? ' target' : ''}`}
                key={r.id}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIdx !== null && dragIdx !== idx) doMove(dragIdx, idx);
                  setDragIdx(null);
                }}
              >
                {isRenaming ? (
                  <input
                    class="field__input"
                    type="text"
                    value={r.label}
                    maxLength={40}
                    autoFocus
                    aria-label={t('set.addHeading')}
                    onBlur={() => setRenamingUid(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') setRenamingUid(null);
                    }}
                    onInput={(e) => {
                      const label = e.currentTarget.value;
                      patch(set.id, {
                        rows: set.rows.map((x) =>
                          x.id === r.id && x.k === 'h' ? { ...x, label } : x,
                        ),
                      });
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    class="nm"
                    style={{ background: 'none', border: 0, padding: 0 }}
                    onClick={() => setRenamingUid(r.id)}
                    title="Click to rename section"
                  >
                    {r.label}
                    {emptySection ? <span class="em"> · empty</span> : null}
                  </button>
                )}
                <span class="rule" aria-hidden="true" />
                <button
                  type="button"
                  class="ib ink"
                  aria-label={t('set.addSongHere')}
                  title={t('set.addSongHere')}
                  onClick={() => {
                    setTargetHeading(r.id);
                    const inp = document.querySelector<HTMLInputElement>('.set-editor-v2__quick input');
                    inp?.focus();
                  }}
                >
                  <Icon>
                    <path d="M12 5v14M5 12h14" />
                  </Icon>
                </button>
                <button
                  type="button"
                  class="ib ink"
                  aria-label={t('set.remove')}
                  onClick={() => {
                    removeItem(set.id, r.id);
                    flashSaved();
                  }}
                >
                  <Icon>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </Icon>
                </button>
              </li>
            );
          }

          if (r.k === 'slide') {
            const isExpanded = expandedUid === r.id;
            return (
              <li
                class="set-editor-v2__row-wrap"
                key={r.id}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIdx !== null && dragIdx !== idx) doMove(dragIdx, idx);
                  setDragIdx(null);
                }}
              >
                <div
                  class="srow"
                  onClick={(e) => {
                    if ((e.target as Element).closest('a,button')) return;
                    setExpandedUid(isExpanded ? null : r.id);
                  }}
                >
                  <span class="drag-handle" aria-hidden="true" style={{ cursor: 'grab', color: 'var(--muted)' }}>
                    <GripVertical size={16} strokeWidth={1.75} />
                  </span>
                  <span class="set-editor-v2__badge">SLIDE</span>
                  <span class="set-editor-v2__name" style={{ flex: 1 }}>
                    {r.title || (r.style === 'blank' ? 'Blank slide' : 'Custom slide')}
                  </span>
                  <span class="sum">{r.style}</span>
                  <button
                    type="button"
                    class="ib ink"
                    aria-label={isExpanded ? 'Collapse slide options' : 'Edit slide'}
                    onClick={() => setExpandedUid(isExpanded ? null : r.id)}
                  >
                    <Icon>
                      <path d="M12 12h.01M12 5h.01M12 19h.01" />
                    </Icon>
                  </button>
                </div>
                {isExpanded ? (
                  <div class="exp">
                    <div class="set-editor-v2__move">
                      <button
                        type="button"
                        class="icon-btn"
                        aria-label={t('set.moveUp')}
                        disabled={idx === 0}
                        onClick={() => doMove(idx, idx - 1)}
                      >
                        <Icon>
                          <path d="M12 19V5M5 12l7-7 7 7" />
                        </Icon>
                      </button>
                      <button
                        type="button"
                        class="icon-btn"
                        aria-label={t('set.moveDown')}
                        disabled={idx === set.rows.length - 1}
                        onClick={() => doMove(idx, idx + 1)}
                      >
                        <Icon>
                          <path d="M12 5v14M19 12l-7 7-7-7" />
                        </Icon>
                      </button>
                      <button
                        type="button"
                        class="icon-btn"
                        aria-label={t('set.remove')}
                        onClick={() => {
                          removeItem(set.id, r.id);
                          flashSaved();
                        }}
                      >
                        <Icon>
                          <path d="M6 6l12 12M18 6L6 18" />
                        </Icon>
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          }

          if (r.k !== 's') return null;
          const songIndex = songs.findIndex((s) => s.uid === r.id);
          const title = meta?.[r.song]?.[0] ?? r.song;
          const verseChips = [1, 2, 3, 4, 5, 6];
          const selectedVerses = new Set(
            (r.seq ?? []).filter((x) => /^v\d+$/i.test(x)).map((x) => Number(x.slice(1)) - 1),
          );
          const isExpanded = expandedUid === r.id;
          const verseSum = selectedVerses.size
            ? [...selectedVerses].map((v) => v + 1).join(' ')
            : 'All';
          const noteCount = r.notes?.length ?? 0;

          const updateSongRow = (fn: (row: SongRow) => SongRow) => {
            patch(set.id, {
              rows: set.rows.map((x) => (x.id === r.id && x.k === 's' ? fn(x) : x)),
            });
          };

          const row = (
            <li
              class="set-editor-v2__row-wrap"
              key={r.id}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIdx !== null && dragIdx !== idx) doMove(dragIdx, idx);
                setDragIdx(null);
              }}
              onKeyDown={(e) => {
                if (!e.altKey) return;
                if (e.key === 'ArrowUp' && idx > 0) {
                  e.preventDefault();
                  doMove(idx, idx - 1);
                } else if (e.key === 'ArrowDown' && idx < set.rows.length - 1) {
                  e.preventDefault();
                  doMove(idx, idx + 1);
                }
              }}
            >
              <div
                class="srow"
                onClick={(e) => {
                  if ((e.target as Element).closest('a,button')) return;
                  setExpandedUid(isExpanded ? null : r.id);
                }}
              >
                <span class="drag-handle" aria-hidden="true" style={{ cursor: 'grab', color: 'var(--muted)' }}>
                  <GripVertical size={16} strokeWidth={1.75} />
                </span>
                <span class="set-editor-v2__ord">{songIndex >= 0 ? songIndex + 1 : '·'}</span>
                <a class="set-editor-v2__song" href={songInWorshipSetUrl(set, Math.max(0, songIndex))} data-astro-reload>
                  <span class="set-editor-v2__badge">{badgeFor(r.song, r.book)}</span>
                  <span class="set-editor-v2__name">{title}</span>
                </a>
                <span class="sum">
                  {musician && r.key ? <span class="k">{r.key}</span> : null}
                  {verseSum}
                  {noteCount > 0 ? ` · ${noteCount} note${noteCount > 1 ? 's' : ''}` : ''}
                </span>
                <button
                  type="button"
                  class="ib ink"
                  aria-label={isExpanded ? 'Collapse options' : 'Edit key and verses'}
                  onClick={() => setExpandedUid(isExpanded ? null : r.id)}
                >
                  <Icon>
                    <path d="M12 12h.01M12 5h.01M12 19h.01" />
                  </Icon>
                </button>
              </div>
              {isExpanded ? (
                <div class="exp">
                  {musician ? (
                    <div class="chips" role="group" aria-label={t('set.key')} style={{ marginBottom: 8 }}>
                      {KEY_CHIPS.map((k) => (
                        <button
                          type="button"
                          key={k}
                          class={r.key === k || r.key === `${k}m` ? 'chip on' : 'chip'}
                          onClick={() =>
                            updateSongRow((x) => {
                              const next = { ...x };
                              if (next.key === k) delete next.key;
                              else next.key = k;
                              return next;
                            })
                          }
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div class="chips" role="group" aria-label={t('set.verses')}>
                    {verseChips.map((v) => {
                      const on = selectedVerses.has(v - 1);
                      return (
                        <button
                          type="button"
                          key={v}
                          class={on ? 'chip v on' : 'chip v'}
                          onClick={() =>
                            updateSongRow((x) => {
                              const cur = new Set(
                                (x.seq ?? [])
                                  .filter((s) => /^v\d+$/i.test(s))
                                  .map((s) => Number(s.slice(1)) - 1),
                              );
                              if (cur.has(v - 1)) cur.delete(v - 1);
                              else cur.add(v - 1);
                              const verses = [...cur].sort((a, b) => a - b);
                              const hasC = x.seq ? x.seq.includes('c') : true;
                              const nextSeq = verses.flatMap((vi) =>
                                hasC ? [`v${vi + 1}`, 'c'] : [`v${vi + 1}`],
                              );
                              const next = { ...x };
                              if (nextSeq.length) next.seq = nextSeq;
                              else delete next.seq;
                              return next;
                            })
                          }
                        >
                          V{v}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      class={!r.seq || r.seq.includes('c') ? 'chip v on' : 'chip v'}
                      onClick={() =>
                        updateSongRow((x) => {
                          const hasC = !x.seq || x.seq.includes('c');
                          const verses = (x.seq ?? [])
                            .filter((s) => /^v\d+$/i.test(s));
                          if (!verses.length) return x;
                          const nextSeq = hasC
                            ? verses
                            : verses.flatMap((v) => [v, 'c']);
                          return { ...x, seq: nextSeq };
                        })
                      }
                    >
                      C
                    </button>
                  </div>
                  <div class="set-editor-v2__fields" style={{ marginTop: 8 }}>
                    <label class="field field--compact field--grow">
                      <span class="field__label">{t('set.note')}</span>
                      <input
                        class="field__input"
                        type="text"
                        maxLength={140}
                        placeholder={t('set.notePlaceholder')}
                        value={r.note ?? ''}
                        onInput={(e) => {
                          const note = e.currentTarget.value.slice(0, 140);
                          updateSongRow((x) => {
                            const next = { ...x };
                            if (note) next.note = note;
                            else delete next.note;
                            return next;
                          });
                        }}
                      />
                    </label>
                  </div>

                  <div class="verse-notes" style={{ marginTop: 10 }}>
                    <span class="field__label">Notes on verses</span>
                    {(r.notes ?? []).map((vn, vi) => (
                      <div key={vi} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px', fontSize: '13px' }}>
                        <span class="badge">{vn.st.toUpperCase()}</span>
                        <span style={{ flex: 1 }}>{vn.text}</span>
                        <span class="muted">{vn.mode === 'slide' ? 'Own slide' : 'On slide'}</span>
                        <button
                          type="button"
                          class="ib ink"
                          aria-label="Remove verse note"
                          onClick={() =>
                            updateSongRow((x) => ({
                              ...x,
                              notes: (x.notes ?? []).filter((_, i2) => i2 !== vi),
                            }))
                          }
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <select
                        class="field__input"
                        style={{ width: 'auto', minWidth: '72px' }}
                        value={noteSt}
                        onChange={(e) => setNoteSt(e.currentTarget.value)}
                        aria-label="Stanza"
                      >
                        <option value="v1">V1</option>
                        <option value="v2">V2</option>
                        <option value="v3">V3</option>
                        <option value="v4">V4</option>
                        <option value="c">Chorus</option>
                      </select>
                      <input
                        class="field__input"
                        type="text"
                        placeholder="Verse note…"
                        maxLength={200}
                        style={{ flex: 1, minWidth: '140px' }}
                        value={noteText}
                        onInput={(e) => setNoteText(e.currentTarget.value)}
                      />
                      <select
                        class="field__input"
                        style={{ width: 'auto' }}
                        value={noteMode}
                        onChange={(e) => setNoteMode(e.currentTarget.value as 'inline' | 'slide')}
                        aria-label="Note display"
                      >
                        <option value="inline">On slide</option>
                        <option value="slide">Own slide</option>
                      </select>
                      <button
                        type="button"
                        class="btn btn--secondary"
                        onClick={() => {
                          const txt = noteText.trim();
                          if (!txt) return;
                          const entry: VerseNote = { st: noteSt, text: txt, mode: noteMode };
                          updateSongRow((x) => ({
                            ...x,
                            notes: [...(x.notes ?? []), entry],
                          }));
                          setNoteText('');
                          flashSaved();
                        }}
                      >
                        Add note
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      class="btn btn--ghost"
                      onClick={() => {
                        setSlideAfterIdx(idx);
                        setSlideStyle('text');
                        setSlideTitle('');
                        setSlideBody('');
                        setSlideOpen(true);
                      }}
                    >
                      Insert slide after
                    </button>
                  </div>
                </div>
              ) : null}
              <div class="set-editor-v2__move" style={{ display: isExpanded ? undefined : 'none' }}>
                <button
                  type="button"
                  class="icon-btn"
                  aria-label={t('set.moveUp')}
                  disabled={idx === 0}
                  onClick={() => doMove(idx, idx - 1)}
                >
                  <Icon>
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </Icon>
                </button>
                <button
                  type="button"
                  class="icon-btn"
                  aria-label={t('set.moveDown')}
                  disabled={idx === set.rows.length - 1}
                  onClick={() => doMove(idx, idx + 1)}
                >
                  <Icon>
                    <path d="M12 5v14M19 12l-7 7-7-7" />
                  </Icon>
                </button>
                <button
                  type="button"
                  class="icon-btn"
                  aria-label={t('set.remove')}
                  onClick={() => {
                    removeItem(set.id, r.id);
                    flashSaved();
                  }}
                >
                  <Icon>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </Icon>
                </button>
              </div>
            </li>
          );
          if (!nextIsHeading) return row;
          let owner: string | null = null;
          for (let i = idx; i >= 0; i--) {
            const x = set.rows[i];
            if (x?.k === 'h') {
              owner = x.id;
              break;
            }
          }
          return (
            <>
              {row}
              <li class="set-editor-v2__add-here" key={`add-${r.id}`}>
                <button
                  type="button"
                  class="btn btn--ghost"
                  onClick={() => {
                    setTargetHeading(owner);
                    resolveQuickAdd(owner);
                  }}
                >
                  {t('set.addSongHere')}
                </button>
              </li>
            </>
          );
        })}
      </ol>

      {set.items.length === 0 ? <p class="muted set-editor-v2__empty">{t('set.empty')}</p> : null}

      <div class="set-editor-v2__spacer" aria-hidden="true" />

      <div class="set-editor-v2__bar" role="toolbar" aria-label={t('set.editSet')}>
        <a
          class={startHref ? 'btn btn--primary set-editor-v2__bar-main' : 'btn btn--primary set-editor-v2__bar-main is-disabled'}
          href={startHref}
          data-astro-reload
          aria-disabled={!startHref}
        >
          <Icon filled>
            <path d="M8 5v14l11-7z" />
          </Icon>
          <span>{t('set.start')}</span>
        </a>
        <a
          class={presentHref ? 'btn btn--secondary btn--icon' : 'btn btn--secondary btn--icon is-disabled'}
          href={presentHref}
          aria-label={t('desktop.presentSet')}
          aria-disabled={!presentHref}
          title={t('desktop.presentSet')}
        >
          <Icon>
            <rect x="3" y="5" width="18" height="12" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </Icon>
        </a>
        <button
          type="button"
          class="btn btn--secondary btn--icon"
          aria-label={t('set.share')}
          title={t('set.share')}
          onClick={() => setShareOpen(true)}
          data-feature="share"
        >
          <Icon>
            <circle cx="18" cy="5" r="2.5" />
            <circle cx="6" cy="12" r="2.5" />
            <circle cx="18" cy="19" r="2.5" />
            <path d="m8.6 13.4 6.7 3.9M15.3 6.7l-6.7 3.9" />
          </Icon>
        </button>
        <button
          type="button"
          class={moreOpen ? 'btn btn--secondary btn--icon is-on' : 'btn btn--secondary btn--icon'}
          aria-label={t('set.more')}
          aria-expanded={moreOpen}
          title={t('set.more')}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <Icon>
            <circle cx="12" cy="6" r="1.25" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
            <circle cx="12" cy="18" r="1.25" fill="currentColor" stroke="none" />
          </Icon>
        </button>
      </div>

      {moreOpen ? (
        <div class="set-editor-v2__more">
          <button
            type="button"
            class="btn btn--ghost"
            onClick={() => {
              const copy = duplicateSet(set.id);
              setMoreOpen(false);
              if (copy) location.href = `/sets/edit/?id=${encodeURIComponent(copy.id)}`;
            }}
          >
            Duplicate
          </button>
          <label class="btn btn--ghost">
            Change date
            <input
              type="date"
              class="visually-hidden"
              value={set.date}
              onChange={(e) => {
                patch(set.id, { date: e.currentTarget.value });
                setMoreOpen(false);
              }}
            />
          </label>
        </div>
      ) : null}

      {shareOpen ? (
        <ShareSheet open set={set} titles={titles} onClose={() => setShareOpen(false)} />
      ) : null}

      <SongsPicker
        open={songsOpen}
        onClose={() => setSongsOpen(false)}
        excludeIds={songs.map((s) => s.songId)}
        onPick={(song) => {
          if (!addSongToSet(set.id, { songId: song.songId, book: song.book }, { afterHeadingUid: effectiveTarget })) {
            showToast(t('set.fullToast'));
            return;
          }
          flashSaved();
          showToast(t('set.addedToast'));
        }}
      />

      <Sheet open={slideOpen} onClose={() => setSlideOpen(false)} title="New slide" id="new-slide">
        <div class="form">
          <div class="chips" role="group" aria-label="Slide style">
            {(
              [
                ['text', 'Text'],
                ['verse', 'Bible verse'],
                ['announce', 'Announcement'],
                ['blank', 'Blank'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                class={slideStyle === id ? 'chip on' : 'chip'}
                onClick={() => setSlideStyle(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {slideStyle !== 'blank' ? (
            <>
              <label class="field">
                <span class="field__label">{slideStyle === 'verse' ? 'Reference' : 'Title'}</span>
                <input
                  class="field__input"
                  type="text"
                  maxLength={120}
                  value={slideTitle}
                  onInput={(e) => setSlideTitle(e.currentTarget.value)}
                />
              </label>
              <label class="field">
                <span class="field__label">{slideStyle === 'verse' ? 'Verse text' : 'Body'}</span>
                <textarea
                  class="field__input"
                  rows={4}
                  maxLength={1200}
                  value={slideBody}
                  onInput={(e) => setSlideBody(e.currentTarget.value)}
                />
              </label>
            </>
          ) : null}
          <div class="form__actions">
            <button
              type="button"
              class="btn btn--primary"
              onClick={() => {
                const newSlide: SlideRow = {
                  k: 'slide',
                  id: `sl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                  style: slideStyle,
                  ...(slideTitle.trim() ? { title: slideTitle.trim() } : {}),
                  ...(slideBody.trim() ? { body: slideBody.trim() } : {}),
                };
                const rows = [...set.rows];
                if (slideAfterIdx !== null && slideAfterIdx >= 0 && slideAfterIdx < rows.length) {
                  rows.splice(slideAfterIdx + 1, 0, newSlide);
                } else {
                  rows.push(newSlide);
                }
                patch(set.id, { rows });
                setSlideOpen(false);
                flashSaved();
              }}
            >
              Add slide
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
