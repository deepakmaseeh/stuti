import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { loadMeta, loadNumbers, type Hit, type MetaRow, type NumbersMap } from '../../lib/search';
import {
  encodeSet,
  formatSetDate,
  getDraft,
  moveItem,
  saveDraft,
  setShareUrl,
  songInSetUrl,
  type SetItem,
  type SetList,
} from '../../lib/setlist';
import type { BookBundle } from '../../lib/book-bundle';
import { downloadPptx } from '../../lib/pptx-export';
import { showToast } from '../../lib/toast';
import { site } from '../../site.config';
import SongHitRow from './SongHitRow';
import QrSheet from './QrSheet';

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

function nextSunday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

export default function SetPanel({ currentId = '' }: { currentId?: string }) {
  const [desktop, setDesktop] = useState(false);
  const [draft, setDraft] = useState<SetList>(() => getDraft());
  const [meta, setMeta] = useState<Record<string, MetaRow> | null>(null);
  const [numbers, setNumbers] = useState<NumbersMap>({});
  const [qrOpen, setQrOpen] = useState(false);

  const refresh = () => setDraft(getDraft());

  useEffect(() => {
    const mq = matchMedia(`(min-width: ${site.layout.desktopMin}px)`);
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!desktop) return;
    refresh();
    Promise.all([loadMeta(), loadNumbers()])
      .then(([m, n]) => {
        setMeta(m);
        setNumbers(n);
      })
      .catch(() => {});
    const onChange = () => refresh();
    addEventListener('stuti:set-changed', onChange);
    addEventListener('storage', onChange);
    return () => {
      removeEventListener('stuti:set-changed', onChange);
      removeEventListener('storage', onChange);
    };
  }, [desktop]);

  const update = (next: SetList) => {
    setDraft(saveDraft(next));
    dispatchEvent(new Event('stuti:set-changed'));
  };

  const code = encodeSet(draft);
  const shareUrl = setShareUrl(code);
  const date = draft.d || nextSunday();

  if (!desktop) return null;

  return (
    <div class="set-panel">
      <div class="set-panel__ribbon">
        <div class="set-panel__ribbon-label">{t('desktop.thisSunday')}</div>
        <input
          class="set-panel__title"
          aria-label={t('set.titleLabel')}
          value={draft.t}
          maxLength={80}
          onInput={(e) => update({ ...draft, t: e.currentTarget.value })}
        />
        <div class="set-panel__meta">
          {draft.s.length === 1
            ? t('desktop.songCount.one')
            : t('desktop.songCount', { n: draft.s.length })}
          {' · '}
          {formatSetDate(date)}
        </div>
      </div>

      {draft.s.length === 0 ? (
        <p class="muted">{t('desktop.setEmpty')}</p>
      ) : (
        <ol class="set-rows">
          {draft.s.map((item, i) => {
            const hit = meta ? hitFor(item, meta, numbers) : null;
            return (
              <li class={`set-row${item.id === currentId ? ' is-current' : ''}`} key={`${item.id}-${i}`}>
                <span class="set-row__num" aria-hidden="true">
                  {i + 1}
                </span>
                <div class="set-row__main">
                  {hit ? (
                    <SongHitRow hit={hit} href={songInSetUrl(draft, code, i)} />
                  ) : (
                    <p class="muted">{item.id}</p>
                  )}
                </div>
                <div class="set-row__ctrl">
                  <button
                    type="button"
                    class="mini-btn"
                    aria-label={t('set.moveUp')}
                    disabled={i === 0}
                    onClick={() => update({ ...draft, s: moveItem(draft.s, i, i - 1) })}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    class="mini-btn"
                    aria-label={t('set.moveDown')}
                    disabled={i === draft.s.length - 1}
                    onClick={() => update({ ...draft, s: moveItem(draft.s, i, i + 1) })}
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    class="mini-btn"
                    aria-label={t('set.remove')}
                    onClick={() => update({ ...draft, s: draft.s.filter((_, k) => k !== i) })}
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {draft.s.length > 0 && (
        <div class="action-bar" style={{ marginTop: '1rem' }}>
          <a class="btn btn--primary" href={`/present/?set=${encodeURIComponent(code)}&i=0`}>
            {t('desktop.presentSet')}
          </a>
          <button type="button" class="btn btn--secondary" onClick={() => setQrOpen(true)}>
            {t('desktop.qrCong')}
          </button>
          <button
            type="button"
            class="btn btn--secondary"
            onClick={() => {
              void (async () => {
                showToast(t('desktop.preparingPpt'));
                try {
                  const books = new Set(draft.s.map((s) => (meta?.[s.id]?.[3] ?? '').split(' ')[0]).filter(Boolean));
                  const bundles = await Promise.all(
                    [...books].map((b) =>
                      fetch(`/data/books/${b}.json`).then((r) =>
                        r.ok ? (r.json() as Promise<BookBundle>) : null,
                      ),
                    ),
                  );
                  const byId = new Map(bundles.flatMap((b) => (b ? Object.entries(b.songs) : [])));
                  const songs = draft.s
                    .map((item) => {
                      const song = byId.get(item.id);
                      return song ? { id: item.id, song } : null;
                    })
                    .filter((x): x is { id: string; song: NonNullable<typeof x>['song'] } => !!x);
                  if (!songs.length) throw new Error('empty');
                  await downloadPptx(songs, {
                    fileName: `Stuti-Set-${date}.pptx`,
                  });
                } catch {
                  showToast(t('desktop.previewError'));
                }
              })();
            }}
          >
            {t('desktop.ppt')}
          </button>
          <a class="btn btn--secondary" href={`/print/?set=${encodeURIComponent(code)}`}>
            {t('desktop.pdf')}
          </a>
        </div>
      )}

      <QrSheet open={qrOpen} onClose={() => setQrOpen(false)} url={shareUrl} title={draft.t} />

      <div class="set-panel__shortcuts">
        <strong>{t('desktop.shortcuts')}</strong>
        <p>
          <kbd>0</kbd>–<kbd>9</kbd> number · <kbd>/</kbd> words · <kbd>P</kbd> present · <kbd>S</kbd> set ·{' '}
          <kbd>?</kbd> help
        </p>
      </div>
    </div>
  );
}
