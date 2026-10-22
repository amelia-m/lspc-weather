/**
 * The TAF relay: a Cloudflare Worker that hands the dashboard Offutt's TAF.
 *
 * Offutt AFB (KOFF), the nearest TAF to the drop zone, is issued by the USAF.
 * api.weather.gov, the only TAF feed a browser can read from another site,
 * has never carried it; aviationweather.gov and NOAA's raw files do, but
 * send no CORS header, and aviationweather.gov's API page says "Cross-origin
 * resource sharing is not permitted at this time" (read 2026-10-20). So the
 * card showed Omaha's TAF and linked Offutt's (docs/open-questions.md,
 * "KOFF's TAF").
 *
 * This fetches one fixed URL, so it cannot be used to fetch anything else.
 * It answers a browser only from the dashboard's own origins (`ALLOWED_ORIGINS`):
 * another site's page cannot read it. A request with no Origin header (a script,
 * curl) is answered, since an Origin can be forged outside a browser and
 * refusing it would only stop the honest checks; what bounds that is the one
 * URL, and the cache below.
 *
 * aviationweather.gov asks callers to set their own user agent, keep requests
 * "limited in scope and frequency", and stay under 100 a minute. A good
 * answer is kept for `CACHE_SECONDS` in the Worker's memory (`RelayMemo`),
 * and the reader's browser is told to keep it only for what is left of
 * that, so a TAF reaches the card at most five minutes older than
 * aviationweather.gov's own. That is not a promise of fewer requests:
 * Cloudflare runs many copies of a Worker and keeps none of them for a set
 * time. Its docs give working cache operations (`caches.default`) only to
 * Workers on custom domains, not workers.dev, where this one runs (read
 * 2026-10-20), so no Cloudflare cache is used: a second layer would only
 * add its own age to the memory's. At this club's scale it does not need
 * one: each open dashboard asks every 10 minutes, far under the limit with
 * no cache at all. A TAF is issued every six hours or so and amended
 * between, so five minutes costs little freshness.
 *
 * The body is aviationweather.gov's JSON, unchanged (an array of TAFs with
 * `rawTAF` and `issueTime`); the app reads it with `tafFromAwcJson`.
 */

import { ALLOWED_ORIGINS, PATH, STATION } from './station';

export { ALLOWED_ORIGINS, PATH };
export const UPSTREAM = `https://aviationweather.gov/api/data/taf?ids=${STATION}&format=json`;
export const CACHE_SECONDS = 300;
/** Give up on aviationweather.gov after this long and answer 502, so a
 *  stalled upstream does not hold the reader's request until the app's own
 *  12-second timeout, after which it would retry and ask upstream again. */
export const UPSTREAM_TIMEOUT_MS = 8_000;
const USER_AGENT = 'lspc-weather TAF relay (https://github.com/amelia-m/lspc-weather)';

/** The last good answer, kept in the Worker's memory between requests. */
export interface RelayMemo {
  body: string | null;
  at: number;
}

export interface RelayDeps {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  memo: RelayMemo;
  now: () => number;
}

function corsHeaders(origin: string | null): Record<string, string> {
  return origin
    ? { 'access-control-allow-origin': origin, vary: 'Origin' }
    : { vary: 'Origin' };
}

function json(status: number, body: string, origin: string | null, maxAgeS = 0): Response {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${maxAgeS}`,
      ...corsHeaders(origin),
    },
  });
}

const upstreamFailed = (why: string, origin: string | null): Response =>
  json(502, JSON.stringify({ error: `aviationweather.gov ${why}` }), origin);

export async function handle(request: Request, deps: RelayDeps): Promise<Response> {
  const origin = request.headers.get('origin');
  if (origin != null && !ALLOWED_ORIGINS.includes(origin)) {
    return json(403, JSON.stringify({ error: 'origin not allowed' }), null);
  }
  const url = new URL(request.url);
  if (url.pathname !== PATH) return json(404, JSON.stringify({ error: `only ${PATH}` }), origin);
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { 'access-control-allow-methods': 'GET', 'access-control-max-age': '86400', ...corsHeaders(origin) },
    });
  }
  if (request.method !== 'GET') return json(405, JSON.stringify({ error: 'GET only' }), origin);

  const now = deps.now();
  const memoAgeS = (now - deps.memo.at) / 1000;
  if (deps.memo.body != null && memoAgeS < CACHE_SECONDS) {
    return json(200, deps.memo.body, origin, Math.floor(CACHE_SECONDS - memoAgeS));
  }

  // Every way aviationweather.gov can fail answers 502, the one status the
  // app reads as "upstream failed" rather than the relay's own fault
  // (passedOverReason, src/domain/sourceProvenance.ts). That covers a body
  // that is not a list of TAFs, which is neither cached nor passed on.
  let body: string;
  try {
    const upstream = await deps.fetch(UPSTREAM, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    // 204 is aviationweather.gov's "valid request, no data": no TAF in its
    // window, as over Offutt's weekend gaps. An empty list says the same.
    if (upstream.status === 204) body = '[]';
    else if (!upstream.ok) return upstreamFailed(`answered ${upstream.status}`, origin);
    else body = await upstream.text();
  } catch (err) {
    return upstreamFailed(`unreachable: ${String(err)}`, origin);
  }
  try {
    if (!Array.isArray(JSON.parse(body))) return upstreamFailed('answered something other than a list of TAFs', origin);
  } catch {
    return upstreamFailed('answered something other than JSON', origin);
  }
  deps.memo.body = body;
  deps.memo.at = now;
  return json(200, body, origin, CACHE_SECONDS);
}
