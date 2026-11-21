import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { storage } from '../../lib/storage';

const STEPS = [
  { titleKey: 'tour.step1Title', bodyKey: 'tour.step1Body', href: '/search/?tab=browse' },
  { titleKey: 'tour.step2Title', bodyKey: 'tour.step2Body', href: '/sets/' },
  { titleKey: 'tour.step3Title', bodyKey: 'tour.step3Body', href: '/downloads/' },
] as const;

/** One-time home tip sheet; does not run on the same first paint as InstallPrompt engagement rules. */
export default function FirstVisitTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const tour = storage.tour.get();
    if (tour.dismissedAt) return;
    // Defer one tick so InstallPrompt's first-visit gate stays quiet.
    const id = window.setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(id);
  }, []);

  if (!open) return null;

  const cur = STEPS[step]!;
  const last = step >= STEPS.length - 1;

  const dismiss = () => {
    storage.tour.set({ dismissedAt: new Date().toISOString() });
    setOpen(false);
  };

  return (
    <div class="tour-sheet" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div class="tour-sheet__card">
        <p class="eyebrow">{t('tour.badge', { n: step + 1, total: STEPS.length })}</p>
        <h2 id="tour-title" class="tour-sheet__title">
          {t(cur.titleKey)}
        </h2>
        <p class="tour-sheet__body">{t(cur.bodyKey)}</p>
        <div class="form__actions">
          {!last ? (
            <button type="button" class="btn btn--primary" onClick={() => setStep((s) => s + 1)}>
              {t('tour.next')}
            </button>
          ) : (
            <a class="btn btn--primary" href={cur.href} onClick={dismiss}>
              {t('tour.done')}
            </a>
          )}
          <button type="button" class="btn btn--ghost" onClick={dismiss}>
            {t('tour.skip')}
          </button>
        </div>
      </div>
    </div>
  );
}
