/**
 * The Worker's entry. Only the default export: Cloudflare's runtime treats
 * every named export of this module as an entry point, and refused the
 * relay's constants when they were exported from here ("Incorrect type for
 * map entry 'CACHE_SECONDS'", wrangler 4.151.3, 2026-10-20). The logic and
 * its constants are in relay.ts, where the tests import them.
 */
import { handle, type RelayMemo } from './relay';

// Lives as long as this copy of the Worker does; see relay.ts on why that
// is a saving and not a promise.
const memo: RelayMemo = { body: null, at: 0 };

export default {
  fetch(request: Request): Promise<Response> {
    return handle(request, { fetch: (u, init) => fetch(u, init), memo, now: Date.now });
  },
};
