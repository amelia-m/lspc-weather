import { fetchJson, NWS_BASE, USE_FIXTURES } from './http';
import { normalizeGridpoint, type RawGridpoint } from '../domain/normalize';
import type { HourlyPoint } from '../domain/types';
import { GRIDPOINT_FIXTURE } from './fixtures/gridpoint';

interface PointsResponse {
  properties: { forecastGridData: string };
}

const GRID_CACHE_KEY = (lat: number, lon: number): string => `nws-grid:${lat},${lon}`;

/**
 * Resolve the gridpoint forecast URL for a lat/lon. The mapping is static for a
 * fixed location, so it's cached in localStorage indefinitely to skip the
 * two-step lookup on every load.
 */
export async function resolveGridpointUrl(lat: number, lon: number): Promise<string> {
  const key = GRID_CACHE_KEY(lat, lon);
  const cached = safeLocalGet(key);
  if (cached) return cached;

  const point = await fetchJson<PointsResponse>(`${NWS_BASE}/points/${lat},${lon}`);
  const url = point.properties.forecastGridData;
  safeLocalSet(key, url);
  return url;
}

/** Fetch + normalize the hourly gridpoint forecast for the drop zone. */
export async function fetchHourly(lat: number, lon: number): Promise<HourlyPoint[]> {
  if (USE_FIXTURES) return normalizeGridpoint(GRIDPOINT_FIXTURE);
  const url = await resolveGridpointUrl(lat, lon);
  const grid = await fetchJson<RawGridpoint>(url);
  return normalizeGridpoint(grid);
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
