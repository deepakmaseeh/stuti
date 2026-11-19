import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { MAX_CORRECTION, reportText, reportUrl } from '../../lib/report';
import { copyText } from '../../lib/share';
import Sheet from './Sheet';

type Props = { songId: string; title: string; fallbackHref: string };
type Option = { value: string; label: string; lang?: string };

/** Lines come from the rendered lyrics so they are not shipped twice in the HTML. */
function readLines(): Option[] {
  const out: Option[] = [];
  document.querySelectorAll<HTMLElement>('.lyrics .sec').forEach((sec) => {
    const label = sec.querySelector('.sec__label')?.textContent?.trim() ?? '';
    sec.querySelectorAll<HTMLElement>('.line .n').forEach((n) => {
      const text = n.textContent?.trim() ?? '';
      out.push({ value: `${label}: ${text}`, label: `${label}: ${text}`, lang: n.lang });
    });
  });
  return out;
}

export default function ReportSheet({ songId, title, fallbackHref }: Props) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Option[]>([]);
  const [line, setLine] = useState('');
  const [correction, setCorrection] = useState('');
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    addEventListener('online', update);
    addEventListener('offline', update);
    return () => {
      removeEventListener('online', update);
      removeEventListener('offline', update);
    };
  }, []);

  const start = (e: MouseEvent) => {
    e.preventDefault();
    const found = readLines();
    setLines(found);
    setLine((cur) => cur || found[0]?.value || t('report.whole'));
    setOpen(true);
  };

  const data = () => ({
    songId,
    title,
    line: line || t('report.whole'),
    correction: correction.trim(),
    pageUrl: new URL(location.pathname, location.origin).href,
  });

  const send = (e: Event) => {
    e.preventDefault();
    if (!correction.trim()) return;
    window.open(reportUrl(data()), '_blank', 'noopener');
    setOpen(false);
  };

  return (
    <>
      <a class="report-btn" href={fallbackHref} target="_blank" rel="noopener" onClick={start}>
        {t('song.report')}
      </a>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('report.title')} id="report">
        <form class="form" onSubmit={send}>
          <label class="field">
            <span class="field__label">{t('report.line')}</span>
            <select class="field__input" value={line} onChange={(e) => setLine(e.currentTarget.value)}>
              {lines.map((o) => (
                <option value={o.value} lang={o.lang}>
                  {o.label}
                </option>
              ))}
              <option value={t('report.whole')}>{t('report.whole')}</option>
            </select>
          </label>
          <label class="field">
            <span class="field__label">{t('report.correction')}</span>
            <textarea
              class="field__input"
              rows={4}
              maxLength={MAX_CORRECTION}
              required
              value={correction}
              onInput={(e) => setCorrection(e.currentTarget.value)}
            />
          </label>
          <p class="muted">{t('report.hint')}</p>
          {!online && (
            <p class="notice" role="status">
              {t('report.offline')}
            </p>
          )}
          <div class="form__actions">
            {!online && (
              <button
                type="button"
                class="btn btn--secondary"
                disabled={!correction.trim()}
                onClick={() => copyText(reportText(data()), t('report.copied'))}
              >
                {t('report.copy')}
              </button>
            )}
            <button type="submit" class="btn btn--primary" disabled={!online || !correction.trim()}>
              {t('report.send')}
            </button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
