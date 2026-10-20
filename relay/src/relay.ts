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
 * "limited in scope and frequency", and stay under 100 a minute. The answer
 * is kept for `CACHE_SECONDS` in Cloudflare's cache, so however many
 * dashboards are open, each Cloudflare location asks upstream at most once
 * in that time. A TAF is issued every six hours or so and amended between,
 * so five minutes costs little freshness.
 *
 * The body is aviationweather.gov's JSON, unchanged (an array of TAFs with
 * `rawTAF` and `issueTime`); the app reads it with `tafFromAwcJson`.
 */

export const UPSTREAM = 'https://aviationweather.gov/api/data/taf?ids=KOFF&format=json';
export const PATH = '/taf/KOFF';
export const ALLOWED_ORIGINS: readonly string[] = [
  'https://amelia-m.github.io',
  // `npm run dev` and `vite preview`, for a check before a deploy.
  'http://localhost:5173',
  'http://localhost:4173',
];
export const CACHE_SECONDS = 300;
const USER_AGENT = 'lspc-weather TAF relay (https://github.com/amelia-m/lspc-weather)';

export interface RelayDeps {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  /** Cloudflare's per-location cache (`caches.default`), or null where there
   *  is none (the tests). */
  cache: Cache | null;
}

function corsHeaders(origin: string | null): Record<string, string> {
  return origin
    ? { 'access-control-allow-origin': origin, vary: 'Origin' }
    : { vary: 'Origin' };
}

function json(status: number, body: string, origin: string | null): Response {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${status === 200 ? CACHE_SECONDS : 0}`,
      ...corsHeaders(origin),
    },
  });
}

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

  const cached = await deps.cache?.match(UPSTREAM);
  if (cached) return json(200, await cached.text(), origin);

  let upstream: Response;
  try {
    upstream = await deps.fetch(UPSTREAM, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' } });
  } catch (err) {
    return json(502, JSON.stringify({ error: `aviationweather.gov unreachable: ${String(err)}` }), origin);
  }
  // 204 is aviationweather.gov's "valid request, no data": no TAF in its
  // window, as over Offutt's weekend gaps. An empty list says the same.
  const body = upstream.status === 204 ? '[]' : await upstream.text();
  if (!upstream.ok) {
    return json(502, JSON.stringify({ error: `aviationweather.gov answered ${upstream.status}` }), origin);
  }
  await deps.cache?.put(
    UPSTREAM,
    new Response(body, { headers: { 'cache-control': `public, max-age=${CACHE_SECONDS}` } }),
  );
  return json(200, body, origin);
}
