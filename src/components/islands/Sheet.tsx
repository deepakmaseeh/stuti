import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { t } from '../../i18n';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  id: string;
  children: ComponentChildren;
};

/**
 * Bottom sheet on the native <dialog>: showModal() gives role=dialog + aria-modal,
 * makes the page behind inert (focus trap) and closes on Escape. Focus goes back to the opener.
 */
export default function Sheet({ open, onClose, title, id, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement as HTMLElement | null;
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  const handleClose = () => {
    onClose();
    opener.current?.focus();
  };

  return (
    <dialog
      ref={ref}
      class="sheet"
      aria-labelledby={`${id}-title`}
      onClose={handleClose}
      // Tap on the backdrop (the dialog element itself, outside the panel) closes.
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      <div class="sheet__panel">
        <div class="sheet__head">
          <h2 class="sheet__title" id={`${id}-title`}>
            {title}
          </h2>
          <button
            type="button"
            class="icon-btn"
            aria-label={t('sheet.close')}
            onClick={() => ref.current?.close()}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
