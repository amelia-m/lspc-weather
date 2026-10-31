/**
 * fetch with a timeout, tried twice on a timeout, for the live checks.
 *
 * Both issues the daily checks have opened (#147 on 2026-10-05, #238 on
 * 2026-10-29) were one 20-second timeout to aviationweather.gov that the
 * next day's run did not meet. A second timeout in a row is the failure
 * and is reported; anything else (an HTTP status, a refused connection, a
 * body that will not parse) is the finding and is not retried.
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

export async function fetchWithRetry(url: string, init: RequestInit, timeoutMs: number): Promise<Fetched> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      const body = await res.text();
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
      process.stdout.write(`[retry] ${url} timed out after ${timeoutMs} ms; trying once more\n`);
    }
  }
}
