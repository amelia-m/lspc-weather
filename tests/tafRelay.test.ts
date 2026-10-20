import { describe, expect, it, vi } from 'vitest';
import { ALLOWED_ORIGINS, CACHE_SECONDS, PATH, UPSTREAM, handle, type RelayDeps } from '../relay/src/relay';
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

/** A stand-in for Cloudflare's per-location cache. */
function memoryCache(): Cache {
  const m = new Map<string, Response>();
  return {
    match: async (k: RequestInfo | URL) => m.get(String(k))?.clone(),
    put: async (k: RequestInfo | URL, r: Response) => void m.set(String(k), r),
  } as unknown as Cache;
}

function deps(answer: () => Response | Promise<Response>, cache: Cache | null = null) {
  const fetch = vi.fn(async () => answer());
  return { fetch, cache } satisfies RelayDeps;
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
    // One fixed URL, with its own user agent, as aviationweather.gov asks.
    expect(d.fetch).toHaveBeenCalledWith(UPSTREAM, expect.objectContaining({ headers: expect.objectContaining({ 'user-agent': expect.stringMatching(/lspc-weather/) }) }));
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

  it('serves its one path and GET only', async () => {
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

  it('asks upstream once per cache period however many readers ask', async () => {
    const d = deps(() => Response.json(AWC_KOFF), memoryCache());
    for (let i = 0; i < 3; i++) {
      const res = await handle(req(PATH, { origin: SITE_ORIGIN }), d);
      expect(await res.json()).toEqual(AWC_KOFF);
    }
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });

  it('reads aviationweather.gov’s 204, no data, as an empty list', async () => {
    const res = await handle(req(PATH), deps(() => new Response(null, { status: 204 })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('answers 502 when aviationweather.gov fails, and keeps no failure in the cache', async () => {
    const cache = memoryCache();
    let n = 0;
    const d = deps(() => (n++ === 0 ? new Response('busy', { status: 429 }) : Response.json(AWC_KOFF)), cache);
    const first = await handle(req(PATH, { origin: SITE_ORIGIN }), d);
    expect(first.status).toBe(502);
    expect(first.headers.get('access-control-allow-origin')).toBe(SITE_ORIGIN);
    expect((await handle(req(PATH, { origin: SITE_ORIGIN }), d)).status).toBe(200);
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

  it('gives null for no TAF, another station’s, or an answer of another shape', () => {
    expect(tafFromAwcJson([], 'KOFF')).toBeNull();
    expect(tafFromAwcJson(AWC_KOFF, 'KOMA')).toBeNull();
    expect(tafFromAwcJson({ error: 'x' }, 'KOFF')).toBeNull();
    expect(tafFromAwcJson([{ icaoId: 'KOFF' }], 'KOFF')).toBeNull();
  });
});

describe('the relay setting', () => {
  it('routes only the stations the relay serves, and nothing until it is set', () => {
    expect(tafRelayUrlFor('KOFF', null)).toBeNull();
    expect(tafRelayUrlFor('KOFF', BASE)).toBe(`${BASE}${PATH}`);
    expect(tafRelayUrlFor('KOMA', BASE)).toBeNull();
  });

  it('adds the relay’s origin to the page’s connect-src, and only once it is set', () => {
    const apis = ['https://api.weather.gov', 'https://api.open-meteo.com', 'https://mesonet.agron.iastate.edu'];
    expect(connectSources(null)).toEqual(apis);
    expect(connectSources(`${BASE}`)).toEqual([...apis, BASE]);
  });
});
