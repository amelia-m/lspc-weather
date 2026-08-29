import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearLogs,
  getLogs,
  loadPersistedLogs,
  logSource,
  subscribe,
  type SourceLog,
} from '../src/api/sourceLog';

const STORAGE_KEY = 'lspc:sourceLogs';
const MAX_LOGS = 200;

/** Vitest runs in the `node` environment, so there is no localStorage unless a
 *  test installs one. The module must stay import- and call-safe without it. */
function installStorage(seed?: string): Map<string, string> {
  const store = new Map<string, string>();
  if (seed !== undefined) store.set(STORAGE_KEY, seed);
  const mock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: mock as unknown as Storage,
    configurable: true,
    writable: true,
  });
  return store;
}

function removeStorage(): void {
  Reflect.deleteProperty(globalThis, 'localStorage');
}

const entry = (over: Partial<SourceLog> = {}): SourceLog => ({
  timestamp: 1_700_000_000_000,
  source: 'metar',
  status: 'success',
  message: 'ok',
  ...over,
});

beforeEach(() => {
  // import.meta.env.DEV is true under vitest, so the console gate is open;
  // silence it rather than printing hundreds of lines per eviction test.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  removeStorage();
  clearLogs();
});

afterEach(() => {
  vi.restoreAllMocks();
  removeStorage();
});

describe('logSource', () => {
  it('records without localStorage (node import safety)', () => {
    expect(() => logSource('metar', 'success', 'METAR from KOMA')).not.toThrow();
    expect(getLogs()).toHaveLength(1);
    expect(getLogs()[0]).toMatchObject({
      source: 'metar',
      status: 'success',
      message: 'METAR from KOMA',
    });
  });

  it('omits the error field entirely when no reason was passed', () => {
    logSource('taf', 'attempted', 'trying KOFF');
    expect(getLogs()[0].error).toBeUndefined();
  });

  it('normalizes an Error rejection to its message', () => {
    logSource('nws', 'failure', 'NWS hourly fetch failed', new Error('HTTP 503 for /gridpoints'));
    expect(getLogs()[0].error).toBe('HTTP 503 for /gridpoints');
  });

  it('keeps the reason for non-Error rejections', () => {
    logSource('daily', 'failure', 'string rejection', 'boom');
    logSource('daily', 'failure', 'number rejection', 42);
    logSource('daily', 'failure', 'null rejection', null);
    expect(getLogs().map((l) => l.error)).toEqual(['boom', '42', 'null']);
  });

  it('persists to localStorage when it is available', () => {
    const store = installStorage();
    logSource('windsAloft', 'fallback', 'NOAA FD fallback (5 levels)');
    expect(JSON.parse(store.get(STORAGE_KEY) ?? 'null')).toEqual([
      expect.objectContaining({ source: 'windsAloft', status: 'fallback' }),
    ]);
  });
});

describe('eviction policy', () => {
  it('caps the buffer at 200 entries', () => {
    for (let i = 0; i < MAX_LOGS + 50; i++) logSource('metar', 'success', `m${i}`);
    expect(getLogs()).toHaveLength(MAX_LOGS);
  });

  it('evicts the oldest success before any failure or fallback', () => {
    logSource('nws', 'failure', 'the 09:00 outage');
    logSource('windsAloft', 'fallback', 'the 09:00 fallback');
    for (let i = 0; i < MAX_LOGS; i++) logSource('metar', 'success', `m${i}`);

    const logs = getLogs();
    expect(logs).toHaveLength(MAX_LOGS);
    // The two interesting entries survive a full buffer of routine successes.
    expect(logs[0]).toMatchObject({ status: 'failure', message: 'the 09:00 outage' });
    expect(logs[1]).toMatchObject({ status: 'fallback', message: 'the 09:00 fallback' });
    // The successes that went are the oldest ones.
    expect(logs[2].message).toBe('m2');
    expect(logs.some((l) => l.message === 'm0')).toBe(false);
  });

  it('falls back to evicting the oldest entry when nothing is a success', () => {
    for (let i = 0; i < MAX_LOGS; i++) logSource('nws', 'failure', `f${i}`);
    logSource('taf', 'failure', 'newest');

    const logs = getLogs();
    expect(logs).toHaveLength(MAX_LOGS);
    expect(logs[0].message).toBe('f1');
    expect(logs[MAX_LOGS - 1].message).toBe('newest');
  });
});

describe('getLogs snapshot identity', () => {
  it('returns the same array until the log changes', () => {
    logSource('metar', 'success', 'first');
    const a = getLogs();
    const b = getLogs();
    expect(a).toBe(b);

    logSource('metar', 'success', 'second');
    expect(getLogs()).not.toBe(a);
    // The old snapshot is frozen, so a consumer holding it cannot be surprised.
    expect(Object.isFrozen(a)).toBe(true);
    expect(a).toHaveLength(1);
  });
});

describe('subscribe', () => {
  it('notifies on log and clear, and stops after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    logSource('metar', 'success', 'one');
    clearLogs();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    logSource('metar', 'success', 'two');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('loadPersistedLogs', () => {
  it('restores valid entries', () => {
    installStorage(JSON.stringify([entry({ message: 'from a previous session' })]));
    loadPersistedLogs();
    expect(getLogs()).toEqual([entry({ message: 'from a previous session' })]);
  });

  it('drops malformed entries and keeps the valid ones', () => {
    installStorage(
      JSON.stringify([
        entry({ message: 'keep me' }),
        { ...entry(), source: 'hourly' }, // not a SourceKey
        { ...entry(), status: 'weird' }, // not a status
        { ...entry(), timestamp: 'noon' }, // not finite
        { ...entry(), message: 7 }, // not a string
        { ...entry(), error: { message: 'nested' } }, // error must be a string
        null,
        'not an entry',
        entry({ message: 'keep me too', status: 'failure', error: 'HTTP 500' }),
      ]),
    );
    loadPersistedLogs();
    expect(getLogs().map((l) => l.message)).toEqual(['keep me', 'keep me too']);
    expect(getLogs()[1].error).toBe('HTTP 500');
  });

  it.each(['null', '5', '"x"', '{"logs":[]}', 'not json at all'])(
    'leaves the in-memory log intact when the stored value is %s',
    (stored) => {
      logSource('metar', 'success', 'this session');
      installStorage(stored);
      const before = getLogs();

      loadPersistedLogs();

      // Wipe-before-validate would have emptied the buffer and then thrown.
      expect(getLogs()).toBe(before);
      expect(getLogs().map((l) => l.message)).toEqual(['this session']);
    },
  );

  it('is a no-op when nothing is stored, or when storage is unavailable', () => {
    logSource('metar', 'success', 'this session');
    installStorage();
    loadPersistedLogs();
    expect(getLogs().map((l) => l.message)).toEqual(['this session']);

    removeStorage();
    expect(() => loadPersistedLogs()).not.toThrow();
    expect(getLogs().map((l) => l.message)).toEqual(['this session']);
  });

  it('applies the cap and the success-first policy to a bloated stored log', () => {
    const stored = [
      entry({ status: 'failure', message: 'old outage' }),
      ...Array.from({ length: MAX_LOGS + 20 }, (_, i) => entry({ message: `s${i}` })),
    ];
    installStorage(JSON.stringify(stored));
    loadPersistedLogs();

    const logs = getLogs();
    expect(logs).toHaveLength(MAX_LOGS);
    expect(logs[0]).toMatchObject({ status: 'failure', message: 'old outage' });
    expect(logs[1].message).toBe('s21');
  });
});

describe('clearLogs', () => {
  it('empties the buffer and the stored copy so a clear survives reload', () => {
    const store = installStorage();
    logSource('metar', 'success', 'one');
    expect(store.has(STORAGE_KEY)).toBe(true);

    clearLogs();
    expect(getLogs()).toEqual([]);
    expect(store.has(STORAGE_KEY)).toBe(false);
  });
});
