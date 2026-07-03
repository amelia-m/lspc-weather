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
export const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

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
  opts: { timeoutMs?: number; headers?: Record<string, string>; retries?: number } = {},
): Promise<T> {
  const { timeoutMs = 12_000, headers = {}, retries = 1 } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // Only CORS-safelisted headers: api.weather.gov asks non-browser callers
      // for a User-Agent, but browsers forbid setting it from fetch(), and a
      // custom request header would trigger a CORS preflight the API may not
      // satisfy. Accept (safelisted) keeps the request CORS-"simple".
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json', ...headers },
      });
      if (!res.ok) throw new HttpError(res.status, url);
      return (await res.json()) as T;
    } catch (err) {
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
