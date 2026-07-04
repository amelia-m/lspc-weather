import { fetchJson, HttpError, NWS_BASE, USE_FIXTURES } from './http';
import {
  aggregateDailyFromHourly,
  normalizeGridpoint,
  normalizeNwsObservation,
  parseFdWinds,
  parseTaf,
  type RawGridpoint,
  type RawNwsObservation,
  type RawNwsProduct,
} from '../domain/normalize';
import { interpolateWindsAloft } from '../domain/windsAloft';
import type {
  CurrentConditions,
  DailyPoint,
  HourlyPoint,
  TafForecast,
  WindsAloftLevel,
} from '../domain/types';
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
 * Fallback daily outlook aggregated from the NWS gridpoint hourlies (~7 days
 * of data) — used when Open-Meteo's 10-day daily forecast is unreachable.
 */
export async function fetchDailyFromGridpoint(
  lat: number,
  lon: number,
  timeZone: string,
): Promise<DailyPoint[]> {
  const grid = await fetchGridpoint(lat, lon);
  return aggregateDailyFromHourly(normalizeGridpoint(grid, 7 * 24), timeZone);
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
 * product for the location code, then fetch that product's text. Returns null
 * when the feed has no product for the location — notably military fields
 * like KOFF, whose USAF-issued TAFs are not always carried on this feed.
 */
export async function fetchTaf(
  station: string,
  productLocation: string,
): Promise<TafForecast | null> {
  const list = await fetchJson<{ '@graph'?: Array<{ '@id': string; issuanceTime?: string }> }>(
    `${NWS_BASE}/products/types/TAF/locations/${encodeURIComponent(productLocation)}`,
  );
  const latest = list['@graph']?.[0];
  if (!latest) return null;
  const product = await fetchJson<RawNwsProduct>(latest['@id']);
  return parseTaf(product.productText ?? '', station, product.issuanceTime ?? latest.issuanceTime);
}

export interface TafStationRef {
  id: string;
  nwsProductLocation: string;
}

/** Injectable dependency so the fallback logic is unit-testable. */
interface TafChainDeps {
  fetchOne: (station: string, productLocation: string) => Promise<TafForecast | null>;
}

/**
 * Try each TAF station in preference order and return the first available
 * TAF (its `station` field says which one the card is showing). A station
 * yielding no product is normal (see fetchTaf) and falls through; a fetch
 * error also falls through so one bad request doesn't blank the card — but
 * if EVERY station errored, the last error propagates so the source reads
 * as failed rather than "no TAF".
 */
export async function fetchTafChain(
  stations: readonly TafStationRef[],
  deps: TafChainDeps = { fetchOne: fetchTaf },
): Promise<TafForecast | null> {
  let errors = 0;
  let lastErr: unknown;
  for (const s of stations) {
    try {
      const taf = await deps.fetchOne(s.id, s.nwsProductLocation);
      if (taf) return taf;
    } catch (err) {
      errors++;
      lastErr = err;
    }
  }
  if (errors > 0 && errors === stations.length) throw lastErr;
  return null;
}

/** Entry point for the app: fixture in dev, live fallback chain otherwise. */
export async function fetchTafAny(stations: readonly TafStationRef[]): Promise<TafForecast | null> {
  if (USE_FIXTURES) {
    return parseTaf(TAF_FIXTURE.productText ?? '', stations[0].id, TAF_FIXTURE.issuanceTime);
  }
  return fetchTafChain(stations);
}

/** NOAA winds-aloft (FD) bulletins covering the north-central US, in
 *  preference order: 6-hour first, then the longer-range issuances. The
 *  type/location codes come from the AWIPS PILs (FD1US3 = FBUS33 etc.);
 *  unknown codes just fall through. */
const FD_PRODUCT_CANDIDATES = [
  { type: 'FD1', location: 'US3' },
  { type: 'FD3', location: 'US3' },
  { type: 'FD5', location: 'US3' },
];

/**
 * Fallback winds aloft from the NOAA FD text product via api.weather.gov —
 * used when Open-Meteo is unreachable (some networks block that host). The
 * bulletin forecasts point winds for OMA (~30 mi from the DZ) at 3/6/9/12k+
 * ft MSL; sparser than the pressure-level model but the same data jump
 * pilots brief from. Returns null when no candidate product yields winds.
 */
export async function fetchWindsAloftFd(
  station: string,
  fieldElevationFt: number,
  targetAltitudesFtAgl: readonly number[],
): Promise<WindsAloftLevel[] | null> {
  for (const cand of FD_PRODUCT_CANDIDATES) {
    try {
      const list = await fetchJson<{ '@graph'?: Array<{ '@id': string }> }>(
        `${NWS_BASE}/products/types/${cand.type}/locations/${cand.location}`,
      );
      const latest = list['@graph']?.[0];
      if (!latest) continue;
      const product = await fetchJson<RawNwsProduct>(latest['@id']);
      const samples = parseFdWinds(product.productText ?? '', station);
      if (samples && samples.length > 0) {
        return interpolateWindsAloft(samples, fieldElevationFt, targetAltitudesFtAgl);
      }
    } catch {
      // Try the next candidate; the caller keeps the original error if all fail.
    }
  }
  return null;
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
