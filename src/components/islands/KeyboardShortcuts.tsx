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

      if (e.key === '/') {
        e.preventDefault();
        if (document.querySelector('.finder')) {
          const songsTab = [...document.querySelectorAll<HTMLButtonElement>('.finder__seg button')].find((b) =>
            /songs/i.test(b.textContent || ''),
          );
          songsTab?.click();
          queueMicrotask(() =>
            document.querySelector<HTMLInputElement>('.song-list-panel input')?.focus(),
          );
        } else if (location.pathname.startsWith('/search/')) {
          document.getElementById('tab-songs')?.click();
          queueMicrotask(() =>
            document.querySelector<HTMLInputElement>('#panel-songs input, .song-list-panel input')?.focus(),
          );
        } else location.assign('/search/?tab=songs');
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
          const numberTab = [...document.querySelectorAll<HTMLButtonElement>('.finder__seg button')].find((b) =>
            /number/i.test(b.textContent || ''),
          );
          const already = numberTab?.getAttribute('aria-selected') === 'true';
          if (!already) numberTab?.click();
          // Forward the digit into the keypad after the Number tab mounts.
          queueMicrotask(() => {
            document
              .querySelector<HTMLButtonElement>(`.finder .keypad button.key:not(.key--fn):not(.key--open)`)
              ?.parentElement?.querySelectorAll('button.key')
              .forEach((btn) => {
                if (btn.textContent?.trim() === e.key) (btn as HTMLButtonElement).click();
              });
          });
          e.preventDefault();
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
