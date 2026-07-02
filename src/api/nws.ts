import { fetchJson, HttpError, NWS_BASE, USE_FIXTURES } from './http';
import {
  normalizeGridpoint,
  normalizeNwsObservation,
  parseTaf,
  type RawGridpoint,
  type RawNwsObservation,
  type RawNwsProduct,
} from '../domain/normalize';
import type { CurrentConditions, HourlyPoint, TafForecast } from '../domain/types';
import { GRIDPOINT_FIXTURE } from './fixtures/gridpoint';
import { OBSERVATION_FIXTURE } from './fixtures/observation';
import { TAF_FIXTURE } from './fixtures/taf';

interface PointsResponse {
  properties: { forecastGridData: string };
}

const GRID_CACHE_KEY = (lat: number, lon: number): string => `nws-grid:${lat},${lon}`;

export interface ResolvedGridpoint {
  url: string;
  /** True when the URL was served from the localStorage cache. */
  fromCache: boolean;
}

/**
 * Resolve the gridpoint forecast URL for a lat/lon. The mapping is stable for a
 * fixed location, so it's cached in localStorage to skip the two-step lookup on
 * every load. `fromCache` tells the caller whether a failure on this URL might
 * be stale-cache-induced (see fetchGridpoint) rather than a real outage.
 */
export async function resolveGridpointUrl(lat: number, lon: number): Promise<ResolvedGridpoint> {
  const key = GRID_CACHE_KEY(lat, lon);
  const cached = safeLocalGet(key);
  if (cached) return { url: cached, fromCache: true };

  const point = await fetchJson<PointsResponse>(`${NWS_BASE}/points/${lat},${lon}`);
  const url = point.properties.forecastGridData;
  safeLocalSet(key, url);
  return { url, fromCache: false };
}

/** Drop the cached gridpoint URL for a lat/lon (e.g. after NWS re-grids). */
export function clearGridpointCache(lat: number, lon: number): void {
  safeLocalRemove(GRID_CACHE_KEY(lat, lon));
}

/** Injectable dependencies so the cache-invalidation logic is unit-testable. */
interface GridpointDeps {
  resolve: (lat: number, lon: number) => Promise<ResolvedGridpoint>;
  fetchGrid: (url: string) => Promise<RawGridpoint>;
  clearCache: (lat: number, lon: number) => void;
}

const defaultGridpointDeps: GridpointDeps = {
  resolve: resolveGridpointUrl,
  fetchGrid: (url) => fetchJson<RawGridpoint>(url),
  clearCache: clearGridpointCache,
};

/**
 * Fetch the raw gridpoint forecast, healing a stale cached URL: NWS re-grids
 * occasionally, and a cached forecastGridData URL that starts returning 4xx
 * would otherwise fail forever (4xx is non-retryable). On a 4xx for a
 * cached URL, drop the cache entry, re-resolve via /points, and retry once.
 * A failure on the freshly resolved URL propagates normally.
 */
export async function fetchGridpoint(
  lat: number,
  lon: number,
  deps: GridpointDeps = defaultGridpointDeps,
): Promise<RawGridpoint> {
  const { url, fromCache } = await deps.resolve(lat, lon);
  try {
    return await deps.fetchGrid(url);
  } catch (err) {
    const staleCache =
      fromCache && err instanceof HttpError && err.status >= 400 && err.status < 500;
    if (!staleCache) throw err;
    deps.clearCache(lat, lon);
    const fresh = await deps.resolve(lat, lon);
    return deps.fetchGrid(fresh.url);
  }
}

/** Fetch + normalize the hourly gridpoint forecast for the drop zone. */
export async function fetchHourly(lat: number, lon: number): Promise<HourlyPoint[]> {
  if (USE_FIXTURES) return normalizeGridpoint(GRIDPOINT_FIXTURE);
  return normalizeGridpoint(await fetchGridpoint(lat, lon));
}

/**
 * Fetch + normalize the latest observation (current conditions) for a station.
 * This replaces the AviationWeather.gov METAR call, which the browser blocks on
 * CORS; api.weather.gov is CORS-enabled. The response's `rawMessage` is the
 * actual METAR, so the displayed raw text is unchanged.
 */
export async function fetchLatestObservation(
  stationId: string,
): Promise<CurrentConditions | null> {
  const data = USE_FIXTURES
    ? OBSERVATION_FIXTURE
    : await fetchJson<RawNwsObservation>(
        `${NWS_BASE}/stations/${encodeURIComponent(stationId)}/observations/latest`,
      );
  if (!data?.properties) return null;
  return normalizeNwsObservation(data, stationId);
}

/**
 * Fetch the latest TAF for a station via the NWS text-products API
 * (CORS-friendly, unlike aviationweather.gov). Two steps: list the latest TAF
 * product for the location code, then fetch that product's text.
 */
export async function fetchTaf(
  station: string,
  productLocation: string,
): Promise<TafForecast | null> {
  if (USE_FIXTURES) {
    return parseTaf(TAF_FIXTURE.productText ?? '', station, TAF_FIXTURE.issuanceTime);
  }
  const list = await fetchJson<{ '@graph'?: Array<{ '@id': string; issuanceTime?: string }> }>(
    `${NWS_BASE}/products/types/TAF/locations/${encodeURIComponent(productLocation)}`,
  );
  const latest = list['@graph']?.[0];
  if (!latest) return null;
  const product = await fetchJson<RawNwsProduct>(latest['@id']);
  return parseTaf(product.productText ?? '', station, product.issuanceTime ?? latest.issuanceTime);
}

function safeLocalGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeLocalSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / quota — ignore */
  }
}
function safeLocalRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* private mode / unavailable — ignore */
  }
}
