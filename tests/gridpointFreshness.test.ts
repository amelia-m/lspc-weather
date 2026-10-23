import { afterEach, describe, expect, it, vi } from 'vitest';
import { newerGridpoint } from '../src/domain/gridpointFreshness';
import { fetchFreshGrid, resetHeldGrids } from '../src/api/nws';
import type { RawGridpoint } from '../src/domain/normalize';

const grid = (updateTime?: string): RawGridpoint => ({ properties: updateTime ? { updateTime } : {} });
const A = grid('2026-10-23T00:35:24+00:00');
const B = grid('2026-10-23T01:41:10+00:00');

describe('newerGridpoint', () => {
  it('keeps the held copy when the fetched one was issued earlier', () => {
    expect(newerGridpoint(B, A)).toBe(B);
  });

  it('takes the fetched copy when it is newer, the same, or nothing is held', () => {
    expect(newerGridpoint(A, B)).toBe(B);
    const sameTime = grid('2026-10-23T00:35:24+00:00');
    expect(newerGridpoint(A, sameTime)).toBe(sameTime);
    expect(newerGridpoint(null, A)).toBe(A);
  });

  it('takes the fetched copy when either time cannot be read', () => {
    const none = grid();
    expect(newerGridpoint(B, none)).toBe(none);
    expect(newerGridpoint(none, A)).toBe(A);
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

  it('holds a copy per URL, so a re-gridded URL starts afresh', async () => {
    serve(B, A);
    expect(await fetchFreshGrid('https://api.weather.gov/gridpoints/OAX/77,42')).toBe(B);
    expect(await fetchFreshGrid('https://api.weather.gov/gridpoints/OAX/78,42')).toBe(A);
  });
});
