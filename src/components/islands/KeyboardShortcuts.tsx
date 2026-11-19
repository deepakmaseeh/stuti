import { useEffect } from 'preact/hooks';

function typingInField(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  if (node.closest?.('input, textarea, select, [contenteditable="true"]')) return true;
  const tag = node.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export default function KeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typingInField(e.target)) return;

      if (e.key === 'Escape') {
        const dlg = document.querySelector<HTMLDialogElement>('dialog[open]');
        if (dlg) {
          e.preventDefault();
          dlg.close();
          return;
        }
        const drawer = document.querySelector('.desktop-set.is-open');
        if (drawer) {
          e.preventDefault();
          drawer.classList.remove('is-open');
          document.querySelector('.desktop-set-drawer-backdrop')?.classList.remove('is-open');
        }
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === '[' || e.key === ']') {
        const prev = e.key === 'ArrowLeft' || e.key === '[';
        const btn = document.querySelector<HTMLAnchorElement>(prev ? '[data-set-prev]' : '[data-set-next]');
        if (btn) {
          e.preventDefault();
          btn.click();
        }
        return;
      }

      if (e.key === '/' ) {
        e.preventDefault();
        if (document.querySelector('.finder')) {
          document.querySelector<HTMLButtonElement>('.finder__seg button:nth-child(2)')?.click();
          queueMicrotask(() => document.querySelector<HTMLInputElement>('[data-word-search]')?.focus());
        } else if (location.pathname.startsWith('/search/')) {
          document.getElementById('tab-words')?.click();
          queueMicrotask(() =>
            document.querySelector<HTMLInputElement>('#panel-words input, [data-word-search]')?.focus(),
          );
        } else location.assign('/search/?tab=words');
        return;
      }

      if (e.key === 'p' || e.key === 'P') {
        const present = document.querySelector<HTMLAnchorElement>('.song-present, a[href^="/present/"]');
        if (present) {
          e.preventDefault();
          location.assign(present.href);
        }
        return;
      }

      if (e.key === 's' || e.key === 'S') {
        const add = document.querySelector<HTMLButtonElement>('.toolbar .tool[aria-pressed]');
        // Prefer the + Set button by scanning tools for set labels after hydrate.
        const setBtn = [...document.querySelectorAll<HTMLButtonElement>('.toolbar .tool')].find((b) =>
          /set|In set/i.test(b.textContent || ''),
        );
        if (setBtn) {
          e.preventDefault();
          setBtn.click();
        }
        void add;
        return;
      }

      if (/^\d$/.test(e.key)) {
        if (document.querySelector('.finder')) {
          // Let Keypad inside Finder handle digits when Number tab is active.
          document.querySelector<HTMLButtonElement>('.finder__seg button:nth-child(1)')?.click();
          return;
        }
        if (
          location.pathname.startsWith('/search/') &&
          document.getElementById('panel-number')?.getAttribute('hidden') == null
        ) {
          return;
        }
        e.preventDefault();
        location.assign(`/search/?n=${e.key}`);
      }
    };

    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  return null;
}
