import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { storage } from '../../lib/storage';

const STEPS = [
  { titleKey: 'tour.step1Title', bodyKey: 'tour.step1Body', href: '/search/?tab=number' },
  { titleKey: 'tour.step2Title', bodyKey: 'tour.step2Body', href: '/sets/' },
  { titleKey: 'tour.step3Title', bodyKey: 'tour.step3Body', href: '/downloads/' },
] as const;

function dismissTour(setOpen: (v: boolean) => void) {
  storage.tour.set({ dismissedAt: new Date().toISOString() });
  setOpen(false);
}

/** One-time home tip dialog (C04): 24px padding, Esc, basic focus trap. */
export default function FirstVisitTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tips') === '1' || params.get('tour') === '1') {
      storage.tour.set({});
    }
    const tour = storage.tour.get();
    if (tour.dismissedAt) return;
    // Defer so InstallPrompt's first-visit gate stays quiet.
    const id = window.setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add('modal-open');
    const tId = window.setTimeout(() => primaryRef.current?.focus(), 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismissTour(setOpen);
        return;
      }
      if (e.key !== 'Tab' || !cardRef.current) return;
      const focusable = [
        ...cardRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (focusable.length < 2) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    addEventListener('keydown', onKey);
    return () => {
      clearTimeout(tId);
      document.body.classList.remove('modal-open');
      removeEventListener('keydown', onKey);
    };
  }, [open, step]);

  if (!open) return null;

  const cur = STEPS[step]!;
  const last = step >= STEPS.length - 1;

  return (
    <div class="modal modal--center" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div class="modal__backdrop" onClick={() => dismissTour(setOpen)} />
      <div class="modal__card tour-dialog" ref={cardRef}>
        <header class="modal__head">
          <p class="eyebrow tour-dialog__badge">{t('tour.badge', { n: step + 1, total: STEPS.length })}</p>
          <h2 id="tour-title">{t(cur.titleKey)}</h2>
        </header>
        <div class="modal__body">
          <p class="modal__sub">{t(cur.bodyKey)}</p>
        </div>
        <div class="modal__actions tour-dialog__actions">
          <button type="button" class="btn btn--ghost" onClick={() => dismissTour(setOpen)}>
            {t('tour.skip')}
          </button>
          {!last ? (
            <button
              type="button"
              class="btn btn--primary"
              ref={(el) => {
                primaryRef.current = el;
              }}
              onClick={() => setStep((s) => s + 1)}
            >
              {t('tour.next')}
            </button>
          ) : (
            <a
              class="btn btn--primary"
              href={cur.href}
              ref={(el) => {
                primaryRef.current = el;
              }}
              onClick={() => dismissTour(setOpen)}
            >
              {t('tour.done')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
