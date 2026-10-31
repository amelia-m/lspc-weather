/** Thin fetch layer: configurable base URLs, timeout, one retry with backoff,
 *  and a fixtures switch so the app runs offline (the dev sandbox blocks the
 *  .gov hosts). Keep base URLs as single constants so flipping to a proxy
 *  later is a one-line change. */

const env = import.meta.env;

/**
 * Fixtures vs live:
 *  - explicit VITE_USE_FIXTURES wins ("true"/"false")
 *  - otherwise: dev → fixtures (sandbox-friendly), production build → live.
 */
export const USE_FIXTURES: boolean =
  env.VITE_USE_FIXTURES != null ? env.VITE_USE_FIXTURES === 'true' : env.DEV;

export const NWS_BASE = env.VITE_NWS_BASE ?? 'https://api.weather.gov';
/**
 * Thrown for any non-ok HTTP response. `status` lets callers react to specific
 * classes of failure (e.g. dropping a cached URL that now 404s). fetchJson
 * treats 4xx as non-retryable and 5xx as transient (one retry with backoff).
 */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** Thrown when a request exceeds its timeout. Replaces the browser's cryptic
 *  AbortError message ("The operation was aborted.") with an actionable one. */
export class TimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Request timed out after ${Math.round(timeoutMs / 1000)} s (${new URL(url).host})`);
    this.name = 'TimeoutError';
  }
}

const isAbort = (err: unknown): boolean =>
  err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');

export async function fetchJson<T>(
  url: string,
  opts: {
    timeoutMs?: number;
    headers?: Record<string, string>;
    retries?: number;
    cache?: RequestCache;
    /** Called once per attempt with how it ended (answered; rejected with
     *  an HTTP error; timed out here; unreachable, a network or CORS
     *  failure): a counter of requests (src/api/openMeteoUsage.ts) has to
     *  see every attempt and how it ended, since the server charges each
     *  one by that, not the call's final result. */
    onAttempt?: (outcome: 'answered' | 'rejected' | 'timeout' | 'unreachable') => void;
  } = {},
): Promise<T> {
  const { timeoutMs = 12_000, headers = {}, retries = 1, cache, onAttempt } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let reported = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // Only CORS-safelisted headers: api.weather.gov asks non-browser callers
      // for a User-Agent, but browsers forbid setting it from fetch(), and a
      // custom request header would trigger a CORS preflight the API may not
      // satisfy. Accept (safelisted) keeps the request CORS-"simple".
      // `cache` is a request mode, not a header, so it keeps the request
      // CORS-simple: the browser adds its own conditional headers.
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json', ...headers },
        cache,
      });
      if (!res.ok) throw new HttpError(res.status, url);
      // Answered: reported once, here, whatever the body then does. A 200
      // whose body will not parse is an answered request the server has
      // charged in full; the catch below must not report it a second time.
      reported = true;
      onAttempt?.('answered');
      return (await res.json()) as T;
    } catch (err) {
      if (!reported) onAttempt?.(err instanceof HttpError ? 'rejected' : isAbort(err) ? 'timeout' : 'unreachable');
      lastErr = isAbort(err) ? new TimeoutError(url, timeoutMs) : err;
      // 4xx is a client error (bad URL, not found, unauthorized) — retrying
      // won't help, so fail fast. Retry only transient failures (5xx, network,
      // timeout).
      if (err instanceof HttpError && err.status >= 400 && err.status < 500) break;
      if (attempt < retries) await delay(500 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
