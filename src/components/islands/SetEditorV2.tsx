import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { loadMeta, loadNumbers, type MetaRow, type NumbersMap } from '../../lib/search';
import {
  addHeading,
  addSongToSet,
  encodeForPresent,
  encodeWorshipSet,
  getSet,
  hydrateSets,
  listenSetsChanged,
  MAX_SHARE_URL,
  moveItemInSet,
  removeItem,
  setActive,
  setShareUrl,
  songInWorshipSetUrl,
  songItems,
  updateSet,
  type WorshipSet,
} from '../../lib/sets';
import { downloadIcs } from '../../lib/ics';
import { worshipSetWhatsAppText, whatsappShareUrl } from '../../lib/whatsapp-text';
import { showToast } from '../../lib/toast';
import { site } from '../../site.config';
import QrSheet from './QrSheet';
import SongsPicker from './SongsPicker';

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
  const presentCode = encodeForPresent(set);
  const startHref = songs[0] ? songInWorshipSetUrl(set, 0) : undefined;
  const presentHref = songs[0] ? `/present/?set=${encodeURIComponent(presentCode)}&i=0` : undefined;

  const badgeFor = (songId: string, book?: string) => {
    const row = meta?.[songId];
    if (!row) return book ?? '';
    if (book && numbers[book]) {
      const n = Object.keys(numbers[book]!).find((k) => numbers[book]![k] === songId);
      if (n) return `${book} ${n}`;
    }
    return row[3];
  };

  const resolveQuickAdd = () => {
    const raw = quick.trim();
    if (!raw) return;
    const book = site.defaultBookId;
    const map = numbers[book];
    let songId: string | undefined;
    if (/^\d+$/.test(raw) && map) songId = map[raw];
    else if (/^(en|hi|ta|te|pa)-[a-z0-9-]+$/.test(raw)) songId = raw;
    if (!songId) {
      showToast(t('set.songNotFound'));
      return;
    }
    if (!addSongToSet(set.id, { songId, book })) showToast(t('set.fullToast'));
    else {
      setQuick('');
      flashSaved();
    }
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
        </div>
      </header>

      <div class="set-editor-v2__add-block">
        <div class="set-editor-v2__quick">
          <input
            class="field__input"
            type="search"
            inputMode="numeric"
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
          <button type="button" class="btn btn--primary btn--icon" aria-label={t('set.add')} onClick={resolveQuickAdd}>
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
          if (it.kind === 'heading') {
            return (
              <li class="set-editor-v2__heading" key={it.uid}>
                <input
                  class="field__input"
                  type="text"
                  value={it.text}
                  maxLength={80}
                  aria-label={t('set.addHeading')}
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
          }
          const songIndex = songs.findIndex((s) => s.uid === it.uid);
          const title = meta?.[it.songId]?.[0] ?? it.songId;
          return (
            <li class="set-editor-v2__row" key={it.uid}>
              <span class="set-editor-v2__ord">{songIndex + 1}</span>
              <div class="set-editor-v2__body">
                <a class="set-editor-v2__song" href={songInWorshipSetUrl(set, songIndex)} data-astro-reload>
                  <span class="set-editor-v2__badge">{badgeFor(it.songId, it.book)}</span>
                  <span class="set-editor-v2__name">{title}</span>
                </a>
                <div class="set-editor-v2__fields">
                  <label class="field field--compact">
                    <span class="field__label">{t('set.key')}</span>
                    <input
                      class="field__input"
                      type="text"
                      maxLength={8}
                      value={it.key ?? ''}
                      onInput={(e) => {
                        const key = e.currentTarget.value.slice(0, 8);
                        patch(set.id, {
                          items: set.items.map((x) => {
                            if (x.uid !== it.uid || x.kind !== 'song') return x;
                            const next = { ...x };
                            if (key) next.key = key;
                            else delete next.key;
                            return next;
                          }),
                        });
                      }}
                    />
                  </label>
                  <label class="field field--compact field--grow">
                    <span class="field__label">{t('set.note')}</span>
                    <input
                      class="field__input"
                      type="text"
                      maxLength={200}
                      placeholder={t('set.notePlaceholder')}
                      value={it.note ?? ''}
                      onInput={(e) => {
                        const note = e.currentTarget.value.slice(0, 200);
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
        })}
      </ol>

      {set.items.length === 0 ? <p class="muted set-editor-v2__empty">{t('set.empty')}</p> : null}

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
          if (!addSongToSet(set.id, { songId: song.songId, book: song.book })) {
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
