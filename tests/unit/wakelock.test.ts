import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = () => void;

function fakeSentinel() {
  const handlers: Handler[] = [];
  return {
    released: false,
    addEventListener: (_: string, h: Handler) => handlers.push(h),
    release: vi.fn(async function (this: { released: boolean }) {
      this.released = true;
      handlers.forEach((h) => h());
    }),
    /** Simulates the browser dropping the lock (e.g. tab hidden). */
    drop() {
      handlers.forEach((h) => h());
    },
  };
}

let sentinels: ReturnType<typeof fakeSentinel>[];
const request = vi.fn(async () => {
  const s = fakeSentinel();
  sentinels.push(s);
  return s;
});

async function load() {
  vi.resetModules();
  return import('../../src/lib/wakelock');
}

beforeEach(() => {
  sentinels = [];
  request.mockClear();
  vi.stubGlobal('navigator', { wakeLock: { request } });
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn() });
});

afterEach(() => vi.unstubAllGlobals());

describe('wakelock', () => {
  it('reports support only when navigator.wakeLock exists', async () => {
    const wl = await load();
    expect(wl.wakeLockSupported()).toBe(true);
    vi.stubGlobal('navigator', {});
    expect(wl.wakeLockSupported()).toBe(false);
  });

  it('acquires and releases, notifying listeners', async () => {
    const wl = await load();
    const seen: boolean[] = [];
    wl.onWakeChange((on) => seen.push(on));
    await wl.setKeepAwake(true);
    expect(request).toHaveBeenCalledWith('screen');
    expect(wl.isAwake()).toBe(true);
    await wl.setKeepAwake(false);
    expect(wl.isAwake()).toBe(false);
    expect(sentinels[0]?.released).toBe(true);
    expect(seen[0]).toBe(true);
    expect(seen.at(-1)).toBe(false);
  });

  it('re-acquires when the page becomes visible again while wanted', async () => {
    const wl = await load();
    await wl.setKeepAwake(true);
    sentinels[0]?.drop();
    expect(wl.isAwake()).toBe(false);
    wl.handleVisibilityChange();
    await vi.waitFor(() => expect(wl.isAwake()).toBe(true));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not re-acquire after the user turned it off', async () => {
    const wl = await load();
    await wl.setKeepAwake(true);
    await wl.setKeepAwake(false);
    wl.handleVisibilityChange();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('throws when unsupported so the UI can show a toast', async () => {
    vi.stubGlobal('navigator', {});
    const wl = await load();
    await expect(wl.setKeepAwake(true)).rejects.toThrow('unsupported');
  });

  it('registers a visibilitychange listener on import', async () => {
    await load();
    expect(document.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
