import { AWC_BASE, fetchJson, USE_FIXTURES } from './http';
import { normalizeMetar, type RawMetar } from '../domain/normalize';
import type { CurrentConditions } from '../domain/types';
import { METAR_FIXTURE } from './fixtures/metar';

/** Fetch + normalize the latest METAR for a station (e.g. KPMV). */
export async function fetchMetar(station: string): Promise<CurrentConditions | null> {
  const raw = USE_FIXTURES
    ? METAR_FIXTURE
    : await fetchJson<RawMetar[]>(
        `${AWC_BASE}/metar?ids=${encodeURIComponent(station)}&format=json`,
      );
  if (!raw || raw.length === 0) return null;
  return normalizeMetar(raw[0]);
}
