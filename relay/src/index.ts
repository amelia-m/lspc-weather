/**
 * The Worker's entry. Only the default export: Cloudflare's runtime treats
 * every named export of this module as an entry point, and refused the
 * relay's constants when they were exported from here ("Incorrect type for
 * map entry 'CACHE_SECONDS'", wrangler 4.151.3, 2026-10-20). The logic and
 * its constants are in relay.ts, where the tests import them.
 */
import { handle } from './relay';

export default {
  fetch(request: Request): Promise<Response> {
    const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default ?? null;
    return handle(request, { fetch: (u, init) => fetch(u, init), cache });
  },
};
