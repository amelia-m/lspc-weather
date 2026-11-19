import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithRetry } from '../scripts/liveFetch';

/* The live checks' fetch tries once more on a timeout (#147, #238) and,
 * since 2026-11-03, on a 502, 503 or 504 (#256: one 502 from
 * aviationweather.gov, gone the next day). Any other status is the
 * finding: a 404 is a link that no longer opens, and is not retried. */
describe('fetchWithRetry', () => {
  const answers = (statuses: number[]) => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url);
      const status = statuses[Math.min(calls.length, statuses.length) - 1];
      return new Response(`body ${status}`, { status });
    });
    return calls;
  };
  afterEach(() => vi.unstubAllGlobals());

  it('tries once more on a gateway error and returns the second answer', async () => {
    for (const status of [502, 503, 504]) {
      const calls = answers([status, 200]);
      const res = await fetchWithRetry('https://example.test/x', {}, 1000);
      expect(calls, String(status)).toHaveLength(2);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('body 200');
      vi.unstubAllGlobals();
    }
  });

  it('reports a second gateway error in a row, and tries no third time', async () => {
    const calls = answers([503, 503]);
    const res = await fetchWithRetry('https://example.test/x', {}, 1000);
    expect(calls).toHaveLength(2);
    expect(res.status).toBe(503);
  });

  const throwsThen = (first: Error, status = 200) => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url);
      if (calls.length === 1) throw first;
      return new Response(`body ${status}`, { status });
    });
    return calls;
  };
  /** Node's fetch on a socket the far end reset: "fetch failed" with the socket error as cause. */
  const reset = () => Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }) });

  it('tries once more on a connection reset (the SIM check, 2026-11-18) and returns the second answer', async () => {
    const calls = throwsThen(reset());
    const res = await fetchWithRetry('https://example.test/x', {}, 1000);
    expect(calls).toHaveLength(2);
    expect(res.status).toBe(200);
  });

  it('throws a second reset in a row, and tries no third time', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url);
      throw reset();
    });
    await expect(fetchWithRetry('https://example.test/x', {}, 1000)).rejects.toThrow('fetch failed');
    expect(calls).toHaveLength(2);
  });

  it('does not retry a refused connection or an unknown host: that is the finding', async () => {
    for (const code of ['ECONNREFUSED', 'ENOTFOUND']) {
      const calls = throwsThen(Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error(code), { code }) }));
      await expect(fetchWithRetry('https://example.test/x', {}, 1000)).rejects.toThrow('fetch failed');
      expect(calls, code).toHaveLength(1);
      vi.unstubAllGlobals();
    }
  });

  it('does not retry a status that is an answer about the link', async () => {
    for (const status of [404, 403, 500, 200]) {
      const calls = answers([status, 200]);
      const res = await fetchWithRetry('https://example.test/x', {}, 1000);
      expect(calls, String(status)).toHaveLength(1);
      expect(res.status).toBe(status);
      vi.unstubAllGlobals();
    }
  });
});
