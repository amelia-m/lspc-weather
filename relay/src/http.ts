/** What every path of the relay answers alike: the CORS header for an
 *  allowed origin, and a JSON body with the cache time the memo has left. */
import { ALLOWED_ORIGINS } from './station';

export function corsHeaders(origin: string | null): Record<string, string> {
  return origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : { vary: 'Origin' };
}

export function json(status: number, body: string, origin: string | null, maxAgeS = 0): Response {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${maxAgeS}`,
      ...corsHeaders(origin),
    },
  });
}

/** The origin rule, once for every path: a browser's page is answered only
 *  from the dashboard's own origins; a request with no Origin (a script,
 *  curl) is answered, since an Origin can be forged outside a browser and
 *  refusing it would only stop the honest checks. Returns the refusal, or
 *  null to go on. */
export function refuseOrigin(origin: string | null): Response | null {
  return origin != null && !ALLOWED_ORIGINS.includes(origin) ? json(403, JSON.stringify({ error: 'origin not allowed' }), null) : null;
}

/** The preflight and the method rule, once for every path: OPTIONS gets
 *  the CORS answer, anything but GET a 405. Returns the answer, or null
 *  for a GET to go on. */
export function preflightOrMethod(request: Request, origin: string | null): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { 'access-control-allow-methods': 'GET', 'access-control-max-age': '86400', ...corsHeaders(origin) },
    });
  }
  return request.method === 'GET' ? null : json(405, JSON.stringify({ error: 'GET only' }), origin);
}
