import type { SourceKey, WeatherSnapshot } from './types';
import { SITE } from '../config/site';

/** Which provider a source is currently served from, and whether that is the
 *  primary source or a fallback (e.g. Open-Meteo unreachable → NOAA FD). */
export interface SourceProvenance {
  detail: string;
  fallback: boolean;
}

/** Describe which provider each fallback-capable source is currently served
 *  from, so Data health can show primary vs fallback. Sources with a single
 *  provider (METAR, NWS forecast) are omitted — no chip is shown for them.
 *  Pure so it can be unit-tested without rendering. */
export function deriveProvenance(
  snapshot: WeatherSnapshot,
): Partial<Record<SourceKey, SourceProvenance>> {
  const prov: Partial<Record<SourceKey, SourceProvenance>> = {};

  if (snapshot.windsAloftSource === 'open-meteo') {
    prov.windsAloft = { detail: 'Open-Meteo pressure levels', fallback: false };
  } else if (snapshot.windsAloftSource === 'nws-fd') {
    prov.windsAloft = { detail: `NOAA FD winds · ${SITE.fdWindsStation}`, fallback: true };
  }

  if (snapshot.dailySource === 'open-meteo') {
    prov.daily = { detail: 'Open-Meteo (10-day)', fallback: false };
  } else if (snapshot.dailySource === 'nws-gridpoint') {
    prov.daily = { detail: 'NWS gridpoint (~7-day)', fallback: true };
  }

  if (snapshot.taf) {
    const primaryTaf = SITE.tafStations[0].id;
    prov.taf = { detail: snapshot.taf.station, fallback: snapshot.taf.station !== primaryTaf };
  }

  return prov;
}
