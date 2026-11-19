import { useEffect } from 'preact/hooks';

function typingInField(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  if (node.closest?.('input, textarea, select, [contenteditable="true"]')) return true;
  const tag = node.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * Global shortcuts (ignored while typing in a field):
 *  - digit → number search with that digit
 *  - / → word search
 *  - ← / → → previous / next in a set
 *  - Esc → close an open sheet/dialog
 */
export default function KeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typingInField(e.target)) return;

      if (e.key === 'Escape') {
        const dlg = document.querySelector<HTMLDialogElement>('dialog[open]');
        if (dlg) {
          e.preventDefault();
          dlg.close();
        }
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const btn = document.querySelector<HTMLButtonElement | HTMLAnchorElement>(
          e.key === 'ArrowLeft' ? '[data-set-prev]' : '[data-set-next]',
        );
        if (btn && !btn.hasAttribute('disabled') && !btn.getAttribute('aria-disabled')) {
          e.preventDefault();
          btn.click();
        }
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        if (location.pathname.startsWith('/search/')) {
          document.getElementById('tab-words')?.click();
          queueMicrotask(() =>
            document.querySelector<HTMLInputElement>('#panel-words input, [data-word-search]')?.focus(),
          );
        } else {
          location.assign('/search/?tab=words');
        }
        return;
      }

      if (/^\d$/.test(e.key)) {
        // Keypad on /search/ already handles digits when the Number tab is active.
        if (
          location.pathname.startsWith('/search/') &&
          document.getElementById('panel-number')?.getAttribute('hidden') == null
        ) {
          return;
        }
        e.preventDefault();
        // Only `n` (no `book`) so SearchTabs seeds the keypad instead of auto-opening a song.
        location.assign(`/search/?n=${e.key}`);
      }
    };

    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  return null;
}
