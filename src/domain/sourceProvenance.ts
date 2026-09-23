import type { SkyDecodeCheck, SourceKey, WeatherSnapshot } from './types';
import { SITE } from '../config/site';

/** Which provider a source is currently served from, and whether that is the
 *  primary source or a fallback (e.g. Open-Meteo unreachable → NOAA FD). */
export interface SourceProvenance {
  detail: string;
  fallback: boolean;
}

/** Amber ("fallback") whenever the two decodes did not simply agree: that is
 *  the state a reader should glance at the raw METAR for. */
const METAR_SKY_PROVENANCE: Record<SkyDecodeCheck, SourceProvenance> = {
  agrees: { detail: 'sky from METAR text · NWS decode agrees', fallback: false },
  'decode-empty': { detail: 'sky from METAR text · NWS decode had none', fallback: true },
  'decode-differs': { detail: 'sky from METAR text · NWS decode differs', fallback: true },
  'text-empty': { detail: 'sky from NWS decode · METAR text had no sky group', fallback: true },
  'not-reported': { detail: 'sky not reported', fallback: true },
};

/** Describe which provider each fallback-capable source is currently served
 *  from, so Data health can show primary vs fallback. The NWS forecast has a
 *  single provider and no chip. The METAR has one provider but two decodes of
 *  each report — the text, which the app parses, and api.weather.gov's
 *  cloudLayers — and its chip says whether they agreed, because on 2026-09-23
 *  the decode was empty through a two-hour overcast and the card read "Clear"
 *  with nothing on screen to say why. Pure so it can be unit-tested without
 *  rendering. */
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

  const sky = snapshot.current?.skyDecode;
  if (sky !== undefined) prov.metar = METAR_SKY_PROVENANCE[sky];

  if (snapshot.taf) {
    const primaryTaf = SITE.tafStations[0].id;
    prov.taf = { detail: snapshot.taf.station, fallback: snapshot.taf.station !== primaryTaf };
  }

  return prov;
}
