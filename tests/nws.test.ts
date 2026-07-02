import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchJson, HttpError } from '../src/api/http';
import { fetchGridpoint, type ResolvedGridpoint } from '../src/api/nws';
import type { RawGridpoint } from '../src/domain/normalize';

/** Minimal Response stand-ins for the global fetch stub. */
const jsonRes = (body: unknown): unknown => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});
const errRes = (status: number): unknown => ({ ok: false, status });

/** Map-backed localStorage replacement (vitest runs in a node environment). */
function makeLocalStorage(): { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } {
  const store = new Map<string, string>();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  };
}

const GRID: RawGridpoint = { properties: {} };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchJson / HttpError', () => {
  it('throws HttpError without retrying on 404', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errRes(404));
    vi.stubGlobal('fetch', fetchMock);

    const err = await fetchJson('https://example.test/gone').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a 503 once and returns the second response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errRes(503))
      .mockResolvedValueOnce(jsonRes({ hello: 'world' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchJson('https://example.test/flaky')).resolves.toEqual({ hello: 'world' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws HttpError carrying the status after 5xx retries are exhausted', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errRes(503));
    vi.stubGlobal('fetch', fetchMock);

    const err = await fetchJson('https://example.test/down').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('fetchGridpoint cache invalidation (injected deps)', () => {
  const LAT = 40.87;
  const LON = -96.14;

  it('drops the cache and retries once when a cached URL 404s', async () => {
    const resolve = vi
      .fn<(lat: number, lon: number) => Promise<ResolvedGridpoint>>()
      .mockResolvedValueOnce({ url: 'https://nws.test/stale', fromCache: true })
      .mockResolvedValueOnce({ url: 'https://nws.test/fresh', fromCache: false });
    const fetchGrid = vi.fn((url: string) =>
      url === 'https://nws.test/fresh'
        ? Promise.resolve(GRID)
        : Promise.reject(new HttpError(404, url)),
    );
    const clearCache = vi.fn();

    const grid = await fetchGridpoint(LAT, LON, { resolve, fetchGrid, clearCache });

    expect(grid).toBe(GRID);
    expect(clearCache).toHaveBeenCalledTimes(1);
    expect(clearCache).toHaveBeenCalledWith(LAT, LON);
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(fetchGrid).toHaveBeenNthCalledWith(1, 'https://nws.test/stale');
    expect(fetchGrid).toHaveBeenNthCalledWith(2, 'https://nws.test/fresh');
  });

  it('propagates a 404 on a freshly resolved URL without a second resolve', async () => {
    const resolve = vi
      .fn<(lat: number, lon: number) => Promise<ResolvedGridpoint>>()
      .mockResolvedValue({ url: 'https://nws.test/fresh', fromCache: false });
    const fetchGrid = vi.fn((url: string) => Promise.reject(new HttpError(404, url)));
    const clearCache = vi.fn();

    await expect(fetchGridpoint(LAT, LON, { resolve, fetchGrid, clearCache })).rejects.toThrow(
      'HTTP 404',
    );
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(fetchGrid).toHaveBeenCalledTimes(1);
    expect(clearCache).not.toHaveBeenCalled();
  });

  it('propagates a 5xx on a cached URL without invalidating the cache', async () => {
    const resolve = vi
      .fn<(lat: number, lon: number) => Promise<ResolvedGridpoint>>()
      .mockResolvedValue({ url: 'https://nws.test/stale', fromCache: true });
    const fetchGrid = vi.fn((url: string) => Promise.reject(new HttpError(503, url)));
    const clearCache = vi.fn();

    await expect(fetchGridpoint(LAT, LON, { resolve, fetchGrid, clearCache })).rejects.toThrow(
      'HTTP 503',
    );
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(clearCache).not.toHaveBeenCalled();
  });

  it('propagates non-HTTP failures on a cached URL untouched', async () => {
    const resolve = vi
      .fn<(lat: number, lon: number) => Promise<ResolvedGridpoint>>()
      .mockResolvedValue({ url: 'https://nws.test/stale', fromCache: true });
    const boom = new Error('network down');
    const fetchGrid = vi.fn(() => Promise.reject(boom));
    const clearCache = vi.fn();

    await expect(fetchGridpoint(LAT, LON, { resolve, fetchGrid, clearCache })).rejects.toBe(boom);
    expect(clearCache).not.toHaveBeenCalled();
  });
});

describe('fetchGridpoint end-to-end wiring (default deps, stubbed globals)', () => {
  const LAT = 40.87;
  const LON = -96.14;
  const CACHE_KEY = `nws-grid:${LAT},${LON}`;
  const STALE_URL = 'https://api.weather.gov/gridpoints/OAX/old/forecastGridData';
  const FRESH_URL = 'https://api.weather.gov/gridpoints/OAX/new/forecastGridData';

  let storage: ReturnType<typeof makeLocalStorage>;

  beforeEach(() => {
    storage = makeLocalStorage();
    vi.stubGlobal('localStorage', storage);
  });

  it('heals a stale cached gridpoint URL via /points and re-caches it', async () => {
    storage.setItem(CACHE_KEY, STALE_URL);
    const fetchMock = vi.fn((url: string) => {
      if (url === STALE_URL) return Promise.resolve(errRes(404));
      if (url.includes('/points/')) {
        return Promise.resolve(jsonRes({ properties: { forecastGridData: FRESH_URL } }));
      }
      if (url === FRESH_URL) return Promise.resolve(jsonRes(GRID));
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    const grid = await fetchGridpoint(LAT, LON);

    expect(grid).toEqual(GRID);
    // stale entry replaced by the freshly resolved URL
    expect(storage.getItem(CACHE_KEY)).toBe(FRESH_URL);
    // stale grid (404, no retry) + /points + fresh grid
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not loop when the freshly resolved URL also 404s', async () => {
    // No cache entry: the first resolve goes through /points.
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/points/')) {
        return Promise.resolve(jsonRes({ properties: { forecastGridData: FRESH_URL } }));
      }
      return Promise.resolve(errRes(404));
    });
    vi.stubGlobal('fetch', fetchMock);

    const err = await fetchGridpoint(LAT, LON).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(404);
    // exactly one /points call and one gridpoint attempt
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
