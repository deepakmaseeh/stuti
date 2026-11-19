import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { storage } from '../../lib/storage';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
declare global {
  interface Window {
    __stutiInstall?: BeforeInstallPromptEvent | null;
  }
}

const DISMISS_DAYS = 14;

/** F5: only after ≥ 2 song opens or a saved favourite/set; never on the first visit; dismiss hides it for 14 days. */
export function shouldOffer(now = Date.now()): boolean {
  const nudge = storage.installNudge.get();
  if (nudge.dismissedAt && now - Date.parse(nudge.dismissedAt) < DISMISS_DAYS * 864e5) return false;
  const engaged =
    (nudge.songOpens ?? 0) >= 2 || storage.favs.get().items.length > 0 || storage.sets.get().items.length > 0;
  return engaged;
}

const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as { standalone?: boolean }).standalone === true;
const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

export default function InstallPrompt() {
  const [mode, setMode] = useState<'none' | 'prompt' | 'ios'>('none');

  useEffect(() => {
    if (isStandalone() || !shouldOffer()) return;
    if (window.__stutiInstall) setMode('prompt');
    else if (isIos()) setMode('ios');
    const onReady = () => shouldOffer() && setMode('prompt');
    addEventListener('stuti:installable', onReady);
    return () => removeEventListener('stuti:installable', onReady);
  }, []);

  if (mode === 'none') return null;

  const dismiss = () => {
    storage.installNudge.set({ ...storage.installNudge.get(), dismissedAt: new Date().toISOString() });
    setMode('none');
  };

  const install = async () => {
    const e = window.__stutiInstall;
    if (!e) return;
    await e.prompt();
    const { outcome } = await e.userChoice;
    window.__stutiInstall = null;
    if (outcome !== 'accepted') dismiss();
    else setMode('none');
  };

  return (
    <div class="install-card" role="region" aria-label={t('install.title')}>
      <div>
        <p class="install-card__title">{t('install.title')}</p>
        <p class="muted">{mode === 'ios' ? t('install.ios') : t('install.body')}</p>
      </div>
      <div class="form__actions">
        <button type="button" class="btn btn--small" onClick={dismiss}>
          {t('install.later')}
        </button>
        {mode === 'prompt' && (
          <button type="button" class="btn btn--primary" onClick={install}>
            {t('install.cta')}
          </button>
        )}
      </div>
    </div>
  );
}
