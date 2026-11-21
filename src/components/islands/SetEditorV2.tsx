import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { loadMeta, loadNumbers, type MetaRow, type NumbersMap } from '../../lib/search';
import {
  addHeading,
  addSongToSet,
  encodeWorshipSet,
  getSet,
  hydrateSets,
  listenSetsChanged,
  MAX_SHARE_URL,
  moveItemInSet,
  removeItem,
  serviceLabel,
  setActive,
  setShareUrl,
  songInWorshipSetUrl,
  songItems,
  updateSet,
  type ServiceType,
  type WorshipSet,
} from '../../lib/sets';
import { isParseAddHit, parseAdd } from '../../lib/sets/parseAdd';
import { downloadIcs } from '../../lib/ics';
import { worshipSetWhatsAppText, whatsappShareUrl } from '../../lib/whatsapp-text';
import { showToast } from '../../lib/toast';
import { site } from '../../site.config';
import QrSheet from './QrSheet';
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
  const [qrOpen, setQrOpen] = useState(false);
  const [songsOpen, setSongsOpen] = useState(false);
  const [heading, setHeading] = useState('');
  const [missing, setMissing] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [targetHeading, setTargetHeading] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>();

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
      .catch(() => {});
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

  const code = encodeWorshipSet(set);
  const shareUrl = setShareUrl(code);
  const shareTooLong = shareUrl.length > MAX_SHARE_URL;
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

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast(t('qr.copy'));
    } catch {
      showToast(shareUrl);
    }
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
          <input
            class="field__input set-editor-v2__title-input"
            value={set.title}
            maxLength={80}
            onInput={(e) => patch(set.id, { title: e.currentTarget.value })}
          />
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
        <button type="button" class="btn btn--secondary set-editor-v2__songs-btn" onClick={() => setSongsOpen(true)}>
          <Icon>
            <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
          </Icon>
          <span>{t('set.songsBtn')}</span>
        </button>

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

      <ol class="set-editor-v2__list">
        {set.items.map((it, idx) => {
          const nextIsHeading =
            idx === set.items.length - 1 || set.items[idx + 1]?.kind === 'heading';
          if (it.kind === 'heading') {
            const isTarget = it.uid === effectiveTarget;
            const emptySection = nextIsHeading;
            const headingRow = (
              <li class={isTarget ? 'set-editor-v2__heading is-target' : 'set-editor-v2__heading'} key={it.uid}>
                <input
                  class="field__input"
                  type="text"
                  value={it.text}
                  maxLength={80}
                  aria-label={t('set.addHeading')}
                  onFocus={() => setTargetHeading(it.uid)}
                  onInput={(e) => {
                    const text = e.currentTarget.value;
                    patch(set.id, {
                      items: set.items.map((x) =>
                        x.uid === it.uid && x.kind === 'heading' ? { ...x, text } : x,
                      ),
                    });
                  }}
                />
                <button
                  type="button"
                  class="icon-btn"
                  aria-label={t('set.remove')}
                  onClick={() => {
                    removeItem(set.id, it.uid);
                    flashSaved();
                  }}
                >
                  <Icon>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </Icon>
                </button>
              </li>
            );
            if (!emptySection) return headingRow;
            return (
              <>
                {headingRow}
                <li class="set-editor-v2__add-here" key={`add-h-${it.uid}`}>
                  <button
                    type="button"
                    class="btn btn--ghost"
                    onClick={() => {
                      setTargetHeading(it.uid);
                      resolveQuickAdd(it.uid);
                    }}
                  >
                    {t('set.addSongHere')}
                  </button>
                </li>
              </>
            );
          }
          const songIndex = songs.findIndex((s) => s.uid === it.uid);
          const title = meta?.[it.songId]?.[0] ?? it.songId;
          const verseChips = [1, 2, 3, 4, 5, 6];
          const selectedVerses = new Set(it.verses ?? []);
          const row = (
            <li
              class="set-editor-v2__row"
              key={it.uid}
              onKeyDown={(e) => {
                if (!e.altKey) return;
                if (e.key === 'ArrowUp' && idx > 0) {
                  e.preventDefault();
                  moveItemInSet(set.id, idx, idx - 1);
                  flashSaved();
                } else if (e.key === 'ArrowDown' && idx < set.items.length - 1) {
                  e.preventDefault();
                  moveItemInSet(set.id, idx, idx + 1);
                  flashSaved();
                }
              }}
            >
              <span class="set-editor-v2__ord">{songIndex + 1}</span>
              <div class="set-editor-v2__body">
                <a class="set-editor-v2__song" href={songInWorshipSetUrl(set, songIndex)} data-astro-reload>
                  <span class="set-editor-v2__badge">{badgeFor(it.songId, it.book)}</span>
                  <span class="set-editor-v2__name">{title}</span>
                </a>
                <div class="set-editor-v2__keys" role="group" aria-label={t('set.key')}>
                  {KEY_CHIPS.map((k) => (
                    <button
                      type="button"
                      key={k}
                      class={it.key === k || it.key === `${k}m` ? 'chip is-on' : 'chip'}
                      onClick={() => {
                        patch(set.id, {
                          items: set.items.map((x) => {
                            if (x.uid !== it.uid || x.kind !== 'song') return x;
                            const next = { ...x };
                            if (next.key === k) delete next.key;
                            else next.key = k;
                            return next;
                          }),
                        });
                      }}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <div class="set-editor-v2__verses" role="group" aria-label={t('set.verses')}>
                  {verseChips.map((v) => {
                    const on = selectedVerses.has(v - 1);
                    return (
                      <button
                        type="button"
                        key={v}
                        class={on ? 'chip is-on' : 'chip'}
                        onClick={() => {
                          patch(set.id, {
                            items: set.items.map((x) => {
                              if (x.uid !== it.uid || x.kind !== 'song') return x;
                              const cur = new Set(x.verses ?? []);
                              if (cur.has(v - 1)) cur.delete(v - 1);
                              else cur.add(v - 1);
                              const verses = [...cur].sort((a, b) => a - b);
                              const next = { ...x };
                              if (verses.length) next.verses = verses;
                              else delete next.verses;
                              return next;
                            }),
                          });
                        }}
                      >
                        V{v}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    class={it.repeatChorus !== false ? 'chip is-on' : 'chip'}
                    onClick={() => {
                      patch(set.id, {
                        items: set.items.map((x) => {
                          if (x.uid !== it.uid || x.kind !== 'song') return x;
                          return { ...x, repeatChorus: x.repeatChorus === false };
                        }),
                      });
                    }}
                  >
                    C
                  </button>
                </div>
                <div class="set-editor-v2__fields">
                  <label class="field field--compact field--grow">
                    <span class="field__label">{t('set.note')}</span>
                    <input
                      class="field__input"
                      type="text"
                      maxLength={140}
                      placeholder={t('set.notePlaceholder')}
                      value={it.note ?? ''}
                      onInput={(e) => {
                        const note = e.currentTarget.value.slice(0, 140);
                        patch(set.id, {
                          items: set.items.map((x) => {
                            if (x.uid !== it.uid || x.kind !== 'song') return x;
                            const next = { ...x };
                            if (note) next.note = note;
                            else delete next.note;
                            return next;
                          }),
                        });
                      }}
                    />
                  </label>
                </div>
              </div>
              <div class="set-editor-v2__move">
                <button
                  type="button"
                  class="icon-btn"
                  aria-label={t('set.moveUp')}
                  disabled={idx === 0}
                  onClick={() => {
                    moveItemInSet(set.id, idx, idx - 1);
                    flashSaved();
                  }}
                >
                  <Icon>
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </Icon>
                </button>
                <button
                  type="button"
                  class="icon-btn"
                  aria-label={t('set.moveDown')}
                  disabled={idx === set.items.length - 1}
                  onClick={() => {
                    moveItemInSet(set.id, idx, idx + 1);
                    flashSaved();
                  }}
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
                    removeItem(set.id, it.uid);
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
          if (!nextIsHeading || it.kind !== 'song') return row;
          // Find owning heading for "Add song here"
          let owner: string | null = null;
          for (let i = idx; i >= 0; i--) {
            const x = set.items[i];
            if (x?.kind === 'heading') {
              owner = x.uid;
              break;
            }
          }
          return (
            <>
              {row}
              <li class="set-editor-v2__add-here" key={`add-${it.uid}`}>
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
          onClick={() => setQrOpen(true)}
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
          {shareTooLong ? <p class="notice">{t('set.tooLong')}</p> : null}
          <button type="button" class="btn btn--ghost" onClick={() => void copyShare()}>
            {t('qr.copy')}
          </button>
          <a
            class="btn btn--ghost"
            href={whatsappShareUrl(worshipSetWhatsAppText(set, { titles, url: shareUrl }))}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
          <button type="button" class="btn btn--ghost" onClick={() => downloadIcs(set, shareUrl)}>
            {t('set.calendarFile')}
          </button>
          <a class="btn btn--ghost" href={`/sets/print/?id=${encodeURIComponent(set.id)}`}>
            {t('set.print')}
          </a>
        </div>
      ) : null}

      {qrOpen ? (
        <QrSheet open={true} url={shareUrl} title={set.title} onClose={() => setQrOpen(false)} />
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
    </div>
  );
}
