import { useEffect, useState } from 'preact/hooks';
import { Flag } from 'lucide-preact';
import { t } from '../../i18n';
import { submitReport, flushReportQueue, type MistakeReport } from '../../lib/report-queue';
import { showToast } from '../../lib/toast';
import Sheet from './Sheet';

type Props = {
  songId: string;
  title: string;
  fallbackHref?: string;
  book?: string;
  no?: number;
  appVersion?: string;
  dataVersion?: string;
};
type Option = { value: string; label: string; lang?: string; stanza?: string; index?: number };

const KINDS: { id: MistakeReport['kind']; label: string }[] = [
  { id: 'spelling', label: 'Spelling' },
  { id: 'words', label: 'Wrong words' },
  { id: 'missing', label: 'Missing line or verse' },
  { id: 'order', label: 'Wrong order' },
  { id: 'number', label: 'Wrong hymn number' },
  { id: 'roman', label: 'Roman' },
  { id: 'english', label: 'English' },
  { id: 'other', label: 'Other' },
];

function readLines(): Option[] {
  const out: Option[] = [];
  document.querySelectorAll<HTMLElement>('.lyrics .sec').forEach((sec) => {
    const label = sec.querySelector('.sec__label')?.textContent?.trim() ?? '';
    sec.querySelectorAll<HTMLElement>('.line .n').forEach((n, index) => {
      const text = n.textContent?.trim() ?? '';
      const short = text.length > 40 ? `${text.slice(0, 40)}…` : text;
      out.push({
        value: `${label}|${index}|${text}`,
        label: `${label}: ${short}`,
        lang: n.lang,
        stanza: label,
        index,
      });
    });
  });
  return out;
}

function newId(): string {
  return crypto.randomUUID?.() ?? `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ReportSheet({
  songId,
  title,
  book,
  no,
  appVersion = '0.1.0',
  dataVersion = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Option[]>([]);
  const [lineKey, setLineKey] = useState('');
  const [kind, setKind] = useState<MistakeReport['kind']>('spelling');
  const [correction, setCorrection] = useState('');
  const [note, setNote] = useState('');
  const [name, setName] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('stuti:reportName');
      if (saved) setName(saved);
    } catch {
      /* */
    }
    const flush = () => void flushReportQueue();
    flush();
    addEventListener('online', flush);
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ stanza?: string; index?: number; text?: string }>).detail;
      start(undefined, detail);
    };
    addEventListener('stuti:open-report', onOpen);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const onDown = (e: PointerEvent) => {
      const lineEl = (e.target as Element | null)?.closest?.('.lyrics .line');
      if (!lineEl) return;
      timer = setTimeout(() => {
        const sec = lineEl.closest('.sec');
        const stanza = sec?.querySelector('.sec__label')?.textContent?.trim() ?? '';
        const allLines = sec ? [...sec.querySelectorAll('.line')] : [];
        const index = allLines.indexOf(lineEl);
        const text = lineEl.querySelector('.n')?.textContent?.trim() ?? '';
        start(undefined, { stanza, index, text });
      }, 550);
    };
    const cancel = () => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('pointerup', cancel);
    document.addEventListener('pointercancel', cancel);
    document.addEventListener('pointermove', cancel);
    return () => {
      removeEventListener('online', flush);
      removeEventListener('stuti:open-report', onOpen);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerup', cancel);
      document.removeEventListener('pointercancel', cancel);
      document.removeEventListener('pointermove', cancel);
    };
  }, []);

  const start = (e?: Event, pre?: { stanza?: string; index?: number; text?: string }) => {
    e?.preventDefault();
    const found = readLines();
    setLines(found);
    const matched = pre
      ? found.find((o) => o.stanza === pre.stanza && o.index === pre.index) ??
        found.find((o) => pre.text && o.value.endsWith(`|${pre.text}`))
      : undefined;
    const pick = matched ?? found[0];
    setLineKey(pick?.value ?? '');
    setCorrection(pick?.value?.split('|').slice(2).join('|') ?? '');
    setOpen(true);
  };

  const onLineChange = (value: string) => {
    setLineKey(value);
    if (!value) {
      setCorrection('');
      return;
    }
    const parts = value.split('|');
    setCorrection(parts.slice(2).join('|'));
  };

  const original = lineKey ? lineKey.split('|').slice(2).join('|') : '';
  const canSend =
    (correction.trim() && correction.trim() !== original.trim()) || note.trim().length > 0;

  const send = async (e: Event) => {
    e.preventDefault();
    if (!canSend || sending) return;
    setSending(true);
    const opt = lines.find((o) => o.value === lineKey);
    const report: MistakeReport = {
      id: newId(),
      createdAt: new Date().toISOString(),
      songId,
      book,
      no,
      title,
      layer: 'n',
      stanzaLabel: opt?.stanza,
      lineIndex: opt?.index,
      kind,
      current: original || undefined,
      suggested: correction.trim() || undefined,
      note: note.trim() || undefined,
      name: name.trim() || undefined,
      appVersion,
      dataVersion,
      url: new URL(location.pathname, location.origin).href,
      website: honeypot || undefined,
    };
    const result = await submitReport(report);
    setSending(false);
    setOpen(false);
    setCorrection('');
    setNote('');
    if (result === 'ok') showToast('Thanks, sent to the Stuti editors');
    else if (result === 'queued') showToast("Saved. It'll send when you're back online.");
    else showToast('Could not send — saved for later');
  };

  return (
    <>
      <button type="button" class="report-link" data-feature="report" onClick={() => start()}>
        <Flag size={16} strokeWidth={1.75} aria-hidden="true" />
        <span>{t('song.report')}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('report.title')} id="report">
        <form class="form" onSubmit={(e) => void send(e)}>
          <p class="muted">
            {book && no != null ? `${book} ${no} · ` : ''}
            {title}
          </p>
          <label class="field">
            <span class="field__label">What's wrong</span>
            <select
              class="field__input"
              value={kind}
              onChange={(e) => setKind(e.currentTarget.value as MistakeReport['kind'])}
            >
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label class="field">
            <span class="field__label">{t('report.line')}</span>
            <select
              class="field__input"
              value={lineKey}
              onChange={(e) => onLineChange(e.currentTarget.value)}
            >
              {lines.map((o) => (
                <option key={o.value} value={o.value} lang={o.lang}>
                  {o.label}
                </option>
              ))}
              <option value="">{t('report.whole')}</option>
            </select>
          </label>
          <label class="field">
            <span class="field__label">{t('report.correction')}</span>
            <textarea
              class="field__input"
              rows={4}
              maxLength={2000}
              value={correction}
              onInput={(e) => setCorrection(e.currentTarget.value)}
            />
          </label>
          <label class="field">
            <span class="field__label">Note (optional)</span>
            <textarea
              class="field__input"
              rows={2}
              maxLength={280}
              value={note}
              onInput={(e) => setNote(e.currentTarget.value)}
            />
          </label>
          <label class="field">
            <span class="field__label">Your name (optional)</span>
            <input
              type="text"
              class="field__input"
              placeholder="Saved on this phone for next time"
              value={name}
              onInput={(e) => {
                const v = e.currentTarget.value;
                setName(v);
                try {
                  localStorage.setItem('stuti:reportName', v);
                } catch {
                  /* */
                }
              }}
            />
          </label>
          {/* honeypot */}
          <label class="visually-hidden" aria-hidden="true">
            Website
            <input tabIndex={-1} autocomplete="off" value={honeypot} onInput={(e) => setHoneypot(e.currentTarget.value)} />
          </label>
          <div class="form__actions">
            <button type="submit" class="btn btn--primary" disabled={!canSend || sending}>
              Send
            </button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
