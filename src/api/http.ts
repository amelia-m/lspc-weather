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
export const AWC_BASE = env.VITE_AWC_BASE ?? 'https://aviationweather.gov/api/data';
export const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

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
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await delay(500 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
