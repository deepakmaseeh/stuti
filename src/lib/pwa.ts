import { Workbox } from 'workbox-window';

/**
 * Register the service worker and auto-activate updates.
 * Waiting for a manual "Update" toast left users on yesterday's HTML (missing
 * toolbar icons / old Browse) until they hard-refreshed.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  const wb = new Workbox('/sw.js');

  const activateWaiting = () => {
    wb.addEventListener('controlling', () => {
      // One clean reload once the new worker owns the page.
      location.reload();
    });
    void wb.messageSkipWaiting();
  };

  wb.addEventListener('waiting', activateWaiting);
  wb.addEventListener('externalwaiting', activateWaiting);

  void wb.register().then((reg) => {
    // Already waiting from a previous visit (toast never clicked).
    if (reg?.waiting) activateWaiting();
    // Check for a new SW when the tab becomes visible again.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void reg?.update();
    });
  });
}
