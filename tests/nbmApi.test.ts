import { afterEach, describe, expect, it, vi } from 'vitest';
import { nbhFixtureText } from '../src/api/fixtures/nbm';

/* fetchNbm's answers from the relay: the bucket's 502 named as the
 * bucket's (the live-site check notes it), the relay's own 500 (a file
 * read, the block not found: the bulletin's header changed on 2026-11-03)
 * thrown as the HTTP error it is (that check counts it), neither retried
 * since the relay answers after its own waits; any other failure retried
 * once. The fixtures switch is forced off for the module, as the tests
 * otherwise run with it on. */
const BASE = 'https://lspc-taf-relay.example.workers.dev';
const res = (status: number, body?: unknown) => ({ ok: status < 400, status, json: () => Promise.resolve(body) });

async function load() {
  vi.resetModules();
  vi.doMock('../src/api/http', async (orig) => ({ ...(await orig<typeof import('../src/api/http')>()), USE_FIXTURES: false }));
  return (await import('../src/api/nbm')).fetchNbm;
}

describe('fetchNbm', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock('../src/api/http');
    vi.resetModules();
  });

  it('names the relay’s 502 as the bucket’s, without a second request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(502, { error: "NOAA's NBM bucket has no NBH file" }));
    vi.stubGlobal('fetch', fetchMock);
    const fetchNbm = await load();
    await expect(fetchNbm(BASE)).rejects.toThrow(/NOAA's NBM bucket failed behind the relay \(relay answered 502\)/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws the relay’s 500 as the HTTP error it is, without a second request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(500, { error: 'the relay found no KPMV block in blend.x' }));
    vi.stubGlobal('fetch', fetchMock);
    const fetchNbm = await load();
    await expect(fetchNbm(BASE)).rejects.toThrow(/HTTP 500 for /);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries any other failure once and parses the block the second answer carries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(530))
      .mockResolvedValueOnce(res(200, { station: 'KPMV', file: 'blend.x', cycle: 'c', text: nbhFixtureText(Date.now()) }));
    vi.stubGlobal('fetch', fetchMock);
    const fetchNbm = await load();
    const f = await fetchNbm(BASE);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(f?.station).toBe('KPMV');
    expect(f?.file).toBe('blend.x');
    expect(f?.hours.length).toBeGreaterThan(0);
  });
});
