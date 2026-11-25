import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { loadMeta, type MetaRow } from '../../lib/search';
import { getSet, hydrateSets, type WorshipSet } from '../../lib/sets';
import OrderOfService, { type OosCopy } from '../OrderOfService';

function readCopy(): OosCopy {
  const c = new URLSearchParams(location.search).get('copy');
  if (c === 'cong' || c === 'mus' || c === 'lead') return c;
  return 'lead';
}

export default function SetsPrint() {
  const [set, setSet] = useState<WorshipSet | null | undefined>(undefined);
  const [meta, setMeta] = useState<Record<string, MetaRow> | null>(null);
  const [copy, setCopy] = useState<OosCopy>('lead');
  const [lyrics, setLyrics] = useState(false);

  useEffect(() => {
    hydrateSets();
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    setSet(id ? (getSet(id) ?? null) : null);
    setCopy(readCopy());
    setLyrics(params.get('lyrics') === '1');
    loadMeta()
      .then(setMeta)
      .catch(() => {});
  }, []);

  // Scale A4 sheet to viewport width (MASTER §13.1)
  useEffect(() => {
    const fit = () => {
      const sheet = document.querySelector<HTMLElement>('.a4, .oos-sheet, .order-of-service');
      const wrap = document.querySelector<HTMLElement>('.sets-print__sheet, .sets-print');
      if (!sheet || !wrap) return;
      const w = Math.min(innerWidth - 32, 794);
      const s = w / 794;
      sheet.style.transform = `scale(${s})`;
      sheet.style.transformOrigin = 'top left';
      wrap.style.width = `${w}px`;
      wrap.style.height = `${sheet.offsetHeight * s}px`;
    };
    fit();
    addEventListener('resize', fit);
    const t = setTimeout(fit, 100);
    return () => {
      removeEventListener('resize', fit);
      clearTimeout(t);
    };
  }, [set, copy, lyrics, meta]);

  const doPrint = () => {
    if (!set) return;
    document.title = `Order of Service – ${set.title} – ${set.date}`;
    document.body.classList.add('print-oos');
    const cleanup = () => {
      document.body.classList.remove('print-oos');
      removeEventListener('afterprint', cleanup);
    };
    addEventListener('afterprint', cleanup);
    print();
  };

  if (set === undefined) return <div class="set-skeleton" aria-hidden="true" />;
  if (!set) {
    return (
      <div class="notice">
        <p>{t('set.notFound')}</p>
        <a href="/sets/">{t('sets.back')}</a>
      </div>
    );
  }

  const syncUrl = (next: { copy?: OosCopy; lyrics?: boolean }) => {
    const params = new URLSearchParams(location.search);
    params.set('id', set.id);
    const c = next.copy ?? copy;
    const l = next.lyrics ?? lyrics;
    params.set('copy', c);
    params.set('lyrics', l ? '1' : '0');
    history.replaceState(null, '', `${location.pathname}?${params}`);
  };

  return (
    <div class="sets-print">
      <div class="sets-print__toggles no-print">
        <label>
          <input
            type="radio"
            name="copy"
            checked={copy === 'lead'}
            onChange={() => {
              setCopy('lead');
              syncUrl({ copy: 'lead' });
            }}
          />{' '}
          Leader
        </label>
        <label>
          <input
            type="radio"
            name="copy"
            checked={copy === 'cong'}
            onChange={() => {
              setCopy('cong');
              syncUrl({ copy: 'cong' });
            }}
          />{' '}
          Congregation
        </label>
        <label>
          <input
            type="radio"
            name="copy"
            checked={copy === 'mus'}
            onChange={() => {
              setCopy('mus');
              syncUrl({ copy: 'mus' });
            }}
          />{' '}
          Musicians
        </label>
        <label>
          <input
            type="checkbox"
            checked={lyrics}
            onChange={(e) => {
              const on = e.currentTarget.checked;
              setLyrics(on);
              syncUrl({ lyrics: on });
            }}
          />{' '}
          Lyrics appendix
        </label>
      </div>

      <OrderOfService set={set} meta={meta} copy={copy} showLyrics={lyrics} />

      <div class="sets-print__actions no-print">
        <button type="button" class="btn btn--primary" onClick={doPrint}>
          Print / Save as PDF
        </button>
        <a class="btn btn--ghost" href={`/sets/edit/?id=${encodeURIComponent(set.id)}`}>
          {t('sets.back')}
        </a>
      </div>
    </div>
  );
}
