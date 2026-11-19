import { Workbox } from 'workbox-window';
import { t } from '../i18n';

/** "A new version is ready · Update" bar; Update → skip waiting → reload once the new worker controls the page. */
function showUpdateToast(onUpdate: () => void): void {
  if (document.getElementById('update-toast')) return;
  const bar = document.createElement('div');
  bar.id = 'update-toast';
  bar.className = 'update-toast';
  bar.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.textContent = t('update.available');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn--small';
  btn.textContent = t('update.reload');
  btn.addEventListener('click', () => {
    btn.disabled = true;
    onUpdate();
  });
  bar.append(text, btn);
  document.body.appendChild(bar);
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  const wb = new Workbox('/sw.js');
  wb.addEventListener('waiting', () => {
    showUpdateToast(() => {
      wb.addEventListener('controlling', () => location.reload());
      wb.messageSkipWaiting();
    });
  });
  void wb.register();
}
