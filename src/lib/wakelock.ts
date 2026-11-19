type Listener = (on: boolean) => void;
let sentinel: WakeLockSentinel | null = null;
let wanted = false;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l(!!sentinel));

export const wakeLockSupported = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator;

async function acquire() {
  if (!wakeLockSupported()) throw new Error('unsupported');
  sentinel = await navigator.wakeLock.request('screen');
  sentinel.addEventListener('release', () => {
    sentinel = null;
    notify();
  });
  notify();
}

export async function setKeepAwake(on: boolean) {
  wanted = on;
  if (on) await acquire();
  else {
    await sentinel?.release();
    sentinel = null;
    notify();
  }
}

export const isAwake = () => !!sentinel;

export function onWakeChange(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Re-acquire after the user comes back to the app (the browser releases the lock when hidden). */
export function handleVisibilityChange() {
  if (wanted && document.visibilityState === 'visible' && !sentinel) acquire().catch(() => {});
}

if (typeof document !== 'undefined') document.addEventListener('visibilitychange', handleVisibilityChange);
