import { describe, expect, it, vi } from 'vitest';
import { ALLOWED_ORIGINS, CACHE_SECONDS, PATH, UPSTREAM, UPSTREAM_TIMEOUT_MS, handle, type RelayDeps } from '../relay/src/relay';
import { connectSources, tafRelayUrlFor } from '../src/config/tafRelay';
import { tafFromAwcJson } from '../src/domain/normalize';
import { decodeTaf } from '../src/domain/taf';

// aviationweather.gov's answer for KOFF, read 2026-10-20 (validTimeFrom/To
// left out: the app reads neither).
const AWC_KOFF = [
  {
    icaoId: 'KOFF',
    issueTime: '2026-10-20T10:00:00.000Z',
    rawTAF: 'TAF KOFF 201000Z 2010/2116 16009KT 9999 FEW130 QNH3017INS TX20/2020Z TN07/2010Z',
  },
];
const SITE_ORIGIN = 'https://amelia-m.github.io';
const BASE = 'https://lspc-taf-relay.example.workers.dev';

const T0 = Date.parse('2026-10-20T18:00:00Z');

function deps(answer: () => Response | Promise<Response>) {
  const fetch = vi.fn<RelayDeps['fetch']>(async () => answer());
  const clock = { t: T0 };
  return { fetch, memo: { body: null, at: 0 }, nbm: { body: null, at: 0, offset: 0 }, now: () => clock.t, clock } satisfies RelayDeps & { clock: { t: number } };
}

const req = (path: string, init: { origin?: string; method?: string } = {}) =>
  new Request(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: init.origin ? { origin: init.origin } : {},
  });

describe('the TAF relay', () => {
  it('passes on aviationweather.gov’s answer to the dashboard, with the CORS header it lacks', async () => {
    const d = deps(() => Response.json(AWC_KOFF));
    const res = await handle(req(PATH, { origin: SITE_ORIGIN }), d);
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(SITE_ORIGIN);
    expect(res.headers.get('cache-control')).toBe(`public, max-age=${CACHE_SECONDS}`);
    expect(await res.json()).toEqual(AWC_KOFF);
    // One fixed URL, with its own user agent, as aviationweather.gov asks,
    // and a deadline of its own.
    const [url, init] = d.fetch.mock.calls[0];
    expect(url).toBe(UPSTREAM);
    expect(new Headers(init.headers).get('user-agent')).toMatch(/lspc-weather/);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(UPSTREAM_TIMEOUT_MS).toBeLessThan(12_000);
  });

  it('refuses another site’s page, and fetches nothing for it', async () => {
    const d = deps(() => Response.json(AWC_KOFF));
    const res = await handle(req(PATH, { origin: 'https://example.com' }), d);
    expect(res.status).toBe(403);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it('answers a request with no Origin (a script, curl) without a CORS header', async () => {
    const res = await handle(req(PATH), deps(() => Response.json(AWC_KOFF)));
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('serves its TAF path (the NBM path is tests/nbmRelay.test.ts) and GET only', async () => {
    const d = deps(() => Response.json(AWC_KOFF));
    expect((await handle(req('/taf/KOMA', { origin: SITE_ORIGIN }), d)).status).toBe(404);
    expect((await handle(req(`${PATH}?ids=KOMA`, { origin: SITE_ORIGIN }), d)).status).toBe(200);
    expect((await handle(req(PATH, { origin: SITE_ORIGIN, method: 'POST' }), d)).status).toBe(405);
    const pre = await handle(req(PATH, { origin: SITE_ORIGIN, method: 'OPTIONS' }), d);
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe(SITE_ORIGIN);
    // The query string is not passed on: only the one GET reached upstream,
    // and it asked for UPSTREAM.
    expect(d.fetch).toHaveBeenCalledTimes(1);
    expect(d.fetch.mock.calls[0]).toContain(UPSTREAM);
  });

  it('allows the deployed site and the local dev and preview servers, nothing else', () => {
    expect(ALLOWED_ORIGINS).toEqual([SITE_ORIGIN, 'http://localhost:5173', 'http://localhost:4173']);
  });

  it('asks upstream once per cache period however many readers ask, then again', async () => {
    const d = deps(() => Response.json(AWC_KOFF));
    for (let i = 0; i < 3; i++) {
      const res = await handle(req(PATH, { origin: SITE_ORIGIN }), d);
      expect(await res.json()).toEqual(AWC_KOFF);
    }
    expect(d.fetch).toHaveBeenCalledTimes(1);
    d.clock.t = T0 + CACHE_SECONDS * 1000 - 1;
    await handle(req(PATH), d);
    expect(d.fetch).toHaveBeenCalledTimes(1);
    d.clock.t = T0 + CACHE_SECONDS * 1000;
    await handle(req(PATH), d);
    expect(d.fetch).toHaveBeenCalledTimes(2);
  });

  it('tells the browser to keep a remembered answer only for what is left of its five minutes', async () => {
    const d = deps(() => Response.json(AWC_KOFF));
    await handle(req(PATH), d);
    d.clock.t = T0 + 200_000;
    const later = await handle(req(PATH), d);
    expect(later.headers.get('cache-control')).toBe(`public, max-age=${CACHE_SECONDS - 200}`);
  });

  it('answers 502, and keeps nothing, when aviationweather.gov’s answer is not a list of TAFs', async () => {
    for (const bad of [() => new Response('<html>busy</html>'), () => Response.json({ error: 'x' })]) {
      const d = deps(bad);
      const res = await handle(req(PATH), d);
      expect(res.status).toBe(502);
      expect(d.memo.body).toBeNull();
    }
    // A body that fails part-way through reading is aviationweather.gov's failure too.
    const broken = deps(() => ({ status: 200, ok: true, text: () => Promise.reject(new TypeError('terminated')) }) as unknown as Response);
    expect((await handle(req(PATH), broken)).status).toBe(502);
  });

  it('reads aviationweather.gov’s 204, no data, as an empty list', async () => {
    const res = await handle(req(PATH), deps(() => new Response(null, { status: 204 })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('answers 502 when aviationweather.gov fails, and keeps no failure in the cache', async () => {
    let n = 0;
    const d = deps(() => (n++ === 0 ? new Response('busy', { status: 429 }) : Response.json(AWC_KOFF)));
    const first = await handle(req(PATH, { origin: SITE_ORIGIN }), d);
    expect(first.status).toBe(502);
    expect(first.headers.get('access-control-allow-origin')).toBe(SITE_ORIGIN);
    // The next reader gets a fresh answer, not the failure kept.
    const second = await handle(req(PATH, { origin: SITE_ORIGIN }), d);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(AWC_KOFF);
    expect(d.fetch).toHaveBeenCalledTimes(2);
    const down = deps(() => Promise.reject(new TypeError('fetch failed')));
    expect((await handle(req(PATH), down)).status).toBe(502);
  });
});

describe('tafFromAwcJson', () => {
  it('reads the station’s TAF as the card reads the NWS feed’s, and says where it came from', () => {
    const taf = tafFromAwcJson(AWC_KOFF, 'KOFF');
    expect(taf).toEqual({
      station: 'KOFF',
      // parseTaf keeps a same-line "TAF" (its military-style prefix).
      raw: AWC_KOFF[0].rawTAF,
      issuedMs: Date.parse('2026-10-20T10:00:00Z'),
      validRaw: '2010/2116',
      via: 'aviationweather',
    });
    // So the decode, and the ended-TAF check, resolve its days.
    expect(decodeTaf(taf!.raw, taf!.issuedMs)?.validToMs).toBe(Date.parse('2026-10-21T16:00:00Z'));
  });

  it('gives null only when the answer has no TAF for the station', () => {
    expect(tafFromAwcJson([], 'KOFF')).toBeNull();
    expect(tafFromAwcJson(AWC_KOFF, 'KOMA')).toBeNull();
  });

  it('throws on an answer it cannot read, so the chain calls it a failure and not Offutt’s gap', () => {
    expect(() => tafFromAwcJson({ error: 'x' }, 'KOFF')).toThrow(/not a list/);
    expect(() => tafFromAwcJson([{ icaoId: 'KOFF' }], 'KOFF')).toThrow(/no TAF text/);
    expect(() => tafFromAwcJson([{ icaoId: 'KOFF', rawTAF: 'garbage' }], 'KOFF')).toThrow(/could not be read/);
  });
});

describe('the relay setting', () => {
  it('routes only the stations the relay serves, and nothing until it is set', () => {
    expect(tafRelayUrlFor('KOFF', null)).toBeNull();
    expect(tafRelayUrlFor('KOFF', BASE)).toBe(`${BASE}${PATH}`);
    expect(tafRelayUrlFor('KOMA', BASE)).toBeNull();
    // An address pasted with its trailing slash still reaches the one path.
    expect(tafRelayUrlFor('KOFF', `${BASE}/`)).toBe(`${BASE}${PATH}`);
  });

  it('adds the relay’s origin to the page’s connect-src, and only once it is set', () => {
    const apis = ['https://api.weather.gov', 'https://api.open-meteo.com', 'https://mesonet.agron.iastate.edu'];
    expect(connectSources(null)).toEqual(apis);
    expect(connectSources(`${BASE}`)).toEqual([...apis, BASE]);
  });
});
