/**
 * fetch with a timeout, tried twice on a timeout or a gateway error, for
 * the live checks.
 *
 * The first two issues the daily checks opened (#147 on 2026-10-05, #238
 * on 2026-10-29) were one 20-second timeout to aviationweather.gov that
 * the next day's run did not meet; the third (#256 on 2026-11-01) was one
 * 502 from the same host, gone the next day. A timeout or a 502, 503 or
 * 504 earns one more try, two attempts in all, whichever of them the
 * second meets: a second one of either kind is the failure and is
 * reported. Anything else (any other HTTP status, a refused connection, a
 * body that will not parse) is the finding and is not retried: a 404 or a 403 is a link that no longer
 * opens, which is what the checks exist to catch, while a 5xx of those
 * three is the server or its gateway briefly unable to answer.
 *
 * The body is read here, under the same timeout, so a response whose
 * headers arrive and whose body then stalls is retried too; what comes
 * back is the read response, with the parts the checks use.
 */
import { isTimeoutError } from '../src/domain/liveIssue';

export interface Fetched {
  ok: boolean;
  status: number;
  url: string;
  headers: Headers;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

/** The statuses tried once more: the server's or its gateway's own
 *  trouble, not an answer about the link. */
export const RETRIED_STATUSES: readonly number[] = [502, 503, 504];

export async function fetchWithRetry(url: string, init: RequestInit, timeoutMs: number): Promise<Fetched> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      const body = await res.text();
      if (attempt < 2 && RETRIED_STATUSES.includes(res.status)) {
        console.log(`[retry] ${url} answered ${res.status}; trying once more`);
        continue;
      }
      return {
        ok: res.ok,
        status: res.status,
        url: res.url,
        headers: res.headers,
        text: async () => body,
        json: async () => JSON.parse(body) as unknown,
      };
    } catch (err) {
      if (attempt >= 2 || !isTimeoutError(err)) throw err;
      console.log(`[retry] ${url} timed out after ${timeoutMs} ms; trying once more`);
    }
  }
}
