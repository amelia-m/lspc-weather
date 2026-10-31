import { fetchJson, USE_FIXTURES } from './http';
import {
  normalizeOpenMeteo,
  normalizeOpenMeteoDaily,
  normalizeOpenMeteoHours,
  normalizeOpenMeteoClouds,
  coerceOpenMeteoTimes,
  openMeteoDailyUrl,
  openMeteoWindsUrl,
  type RawOpenMeteo,
  type RawOpenMeteoDaily,
} from '../domain/normalize';
import { interpolateAsSchulze, interpolateWindsAloft } from '../domain/windsAloft';
import type { DailyPoint, WindsAloftForecast } from '../domain/types';
import { SITE } from '../config/site';
import { OPEN_METEO_FIXTURE } from './fixtures/openMeteo';
import { OPEN_METEO_DAILY_FIXTURE } from './fixtures/openMeteoDaily';
import { recordOpenMeteoRequest } from './openMeteoUsage';
import type { UsageOutcome } from '../domain/openMeteoUsage';


/** Open-Meteo can be slow from mobile networks (field reports of 12 s
 *  aborts while the NWS endpoints answered fine), so give it more headroom
 *  and an extra retry than the fetchJson defaults. */
const OPEN_METEO_OPTS = { timeoutMs: 20_000, retries: 2 };

/** The fetch options for one URL: the shared ones, plus the counter that
 *  records each attempt as a call Open-Meteo charges this address. */
const optsFor = (url: string) => ({
  ...OPEN_METEO_OPTS,
  onAttempt: (outcome: UsageOutcome) => recordOpenMeteoRequest(url, outcome),
});

/** Fetch winds aloft and interpolate to the requested AGL jump altitudes.
 *
 *  Returns the valid time alongside the levels: the model is hourly and the
 *  normalizer snaps to the nearest step in either direction, so "the winds" are
 *  always the winds for one specific hour that is rarely the current one. The
 *  UI states that hour so it can be compared against tools that print their own
 *  (Mark Schulze's Winds Aloft labels its data in Z). */
export async function fetchWindsAloft(
  lat: number,
  lon: number,
  fieldElevationFt: number,
  targetAltitudesFtAgl: readonly number[],
  now: number,
): Promise<WindsAloftForecast> {
  const windsUrl = openMeteoWindsUrl(lat, lon);
  const data: RawOpenMeteo = USE_FIXTURES ? OPEN_METEO_FIXTURE : await fetchJson<RawOpenMeteo>(windsUrl, optsFor(windsUrl));

  const coerced = coerceOpenMeteoTimes(data);
  const atNow = normalizeOpenMeteo(coerced, now);
  return {
    levels: interpolateWindsAloft(atNow.samples, fieldElevationFt, targetAltitudesFtAgl),
    validity: { validMs: atNow.validMs },
    clouds: normalizeOpenMeteoClouds(coerced),
    // Each hour carries two tables from the one response: this app's default
    // (every sample, field datum) and Mark Schulze's method (his levels, his
    // datum, his ground rule), which the card can show instead.
    hours: normalizeOpenMeteoHours(coerced)
      .filter((h) => h.validMs != null && Number.isFinite(h.validMs))
      .map((h) => ({
        validMs: h.validMs as number,
        levels: interpolateWindsAloft(h.samples, fieldElevationFt, targetAltitudesFtAgl),
        schulzeLevels:
          h.schulze.groundFtMsl != null
            ? interpolateAsSchulze(h.schulze.levels, h.schulze.groundFtMsl, targetAltitudesFtAgl)
            : [],
      }))
      .filter((h) => h.levels.length > 0),
  };
}

/** Fetch the 10-day daily outlook (temps, wind/gust maxima, precip chance,
 *  WMO weather code). timezone=DZ so daily aggregates follow local days. */
export async function fetchDailyForecast(lat: number, lon: number): Promise<DailyPoint[]> {
  const dailyUrl = openMeteoDailyUrl(lat, lon, SITE.timeZone);
  const data: RawOpenMeteoDaily = USE_FIXTURES
    ? OPEN_METEO_DAILY_FIXTURE
    : await fetchJson<RawOpenMeteoDaily>(dailyUrl, optsFor(dailyUrl));
  return normalizeOpenMeteoDaily(data);
}
