import { afterEach, describe, expect, it, vi } from 'vitest';
import { newerGridpoint } from '../src/domain/gridpointFreshness';
import { fetchFreshGrid, resetHeldGrids } from '../src/api/nws';
import type { RawGridpoint } from '../src/domain/normalize';

const grid = (updateTime?: string): RawGridpoint => ({ properties: updateTime ? { updateTime } : {} });
const A = grid('2026-10-23T00:35:24+00:00');
const B = grid('2026-10-23T01:41:10+00:00');
const NOW = Date.parse('2026-10-23T03:00:00Z');

describe('newerGridpoint', () => {
  it('keeps the held copy when the fetched one was issued earlier', () => {
    expect(newerGridpoint(B, A, NOW)).toBe(B);
  });

  it('takes the fetched copy when it is newer, the same, or nothing is held', () => {
    expect(newerGridpoint(A, B, NOW)).toBe(B);
    const sameTime = grid('2026-10-23T00:35:24+00:00');
    expect(newerGridpoint(A, sameTime, NOW)).toBe(sameTime);
    expect(newerGridpoint(null, A, NOW)).toBe(A);
  });

  it('lets a held copy dated in the future give way', () => {
    // Such a copy would otherwise win every refresh until the page reloads.
    const future = grid('2026-10-24T00:00:00+00:00');
    expect(newerGridpoint(future, A, NOW)).toBe(A);
  });

  it('takes the fetched copy when either time cannot be read', () => {
    const none = grid();
    expect(newerGridpoint(B, none, NOW)).toBe(none);
    expect(newerGridpoint(none, A, NOW)).toBe(A);
  });
});

describe('fetchFreshGrid', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetHeldGrids();
  });

  const serve = (...grids: RawGridpoint[]) => {
    const fetch = vi.fn();
    for (const g of grids) fetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(g) });
    vi.stubGlobal('fetch', fetch);
    return fetch;
  };

  it('asks NWS each time rather than taking the browser’s copy', async () => {
    const fetch = serve(A);
    await fetchFreshGrid('https://api.weather.gov/gridpoints/OAX/77,42');
    expect(fetch.mock.calls[0][1]).toMatchObject({ cache: 'no-cache' });
  });

  it('never steps back to an older copy an edge cache served after a newer one', async () => {
    serve(B, A, grid('2026-10-23T02:40:00+00:00'));
    const url = 'https://api.weather.gov/gridpoints/OAX/77,42';
    expect(await fetchFreshGrid(url)).toBe(B);
    expect(await fetchFreshGrid(url)).toBe(B);
    expect((await fetchFreshGrid(url)).properties.updateTime).toBe('2026-10-23T02:40:00+00:00');
  });

  it('gives callers asking at once one request, so neither overwrites the other', async () => {
    let answer: (v: unknown) => void = () => {};
    const fetch = vi.fn().mockReturnValueOnce(new Promise((r) => (answer = r)));
    vi.stubGlobal('fetch', fetch);
    const url = 'https://api.weather.gov/gridpoints/OAX/77,42';
    const hourly = fetchFreshGrid(url);
    const daily = fetchFreshGrid(url);
    answer({ ok: true, status: 200, json: () => Promise.resolve(B) });
    expect(await hourly).toBe(B);
    expect(await daily).toBe(B);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('holds a copy per URL, so a re-gridded URL starts afresh', async () => {
    serve(B, A);
    expect(await fetchFreshGrid('https://api.weather.gov/gridpoints/OAX/77,42')).toBe(B);
    expect(await fetchFreshGrid('https://api.weather.gov/gridpoints/OAX/78,42')).toBe(A);
  });
});
