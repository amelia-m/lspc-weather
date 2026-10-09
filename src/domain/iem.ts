/**
 * The Iowa Environmental Mesonet's current observation for a station, and the
 * choice between it and api.weather.gov's.
 *
 * Why IEM first: timed on 2026-09-27 from a GitHub runner, polling every 20 s
 * through three KPMV report cycles, IEM had each report 4 to 6 minutes after
 * it was taken, usairnet 17 to 18, and api.weather.gov (the only source this
 * app read until then) 24 to 33. IEM is also one of the few fast sources that
 * answers a browser on another site (`Access-Control-Allow-Origin: *`);
 * aviationweather.gov and NOAA's raw METAR files are as fast and do not. See
 * docs/source-parity.md, "Why the observation times differ".
 *
 * Why NWS stays: IEM is a university service with no promise of uptime, and
 * either feed can miss a report. Both are fetched and the newer report is
 * shown, so a gap in one is covered by the other and the dashboard is never
 * older than NWS alone would make it.
 *
 * Pure: records in, conditions out.
 */
import type { CurrentConditions, ObservationSource, SkyLayer } from './types';
import { altimeterFromRaw, compareSkyDecodes, parseSkyGroups, tempsFromRaw, toSkyCover } from './normalize';
import { round } from './units';

/** The fields of IEM's `api/1/currents.json` record this app reads, as the
 *  API served them on 2026-09-27. Numbers can be null for a sensor that did
 *  not report. */
export interface RawIemCurrent {
  station?: string; // "PMV", no K
  utc_valid?: string | null; // "2026-09-27T20:35:00Z"
  raw?: string | null; // the METAR text
  tmpf?: number | null;
  dwpf?: number | null;
  drct?: number | null;
  sknt?: number | null;
  gust?: number | string | null;
  vsby?: number | null;
  alti?: number | null; // inHg
  wxcodes?: string | string[] | null;
  skyc1?: string | null;
  skyc2?: string | null;
  skyc3?: string | null;
  skyc4?: string | null;
  skyl1?: number | null;
  skyl2?: number | null;
  skyl3?: number | null;
  skyl4?: number | null;
  /** The station's position, which the Nearby METARs card measures from. */
  lat?: number | null;
  lon?: number | null;
}

export interface RawIemCurrents {
  data?: RawIemCurrent[];
}

const fToC = (f: number): number => round(((f - 32) * 5) / 9, 1);

/** An IEM current record as the conditions every card reads. null when the
 *  record has no valid time, which is the one field nothing can stand in for. */
export function normalizeIemCurrent(rec: RawIemCurrent, stationId: string): CurrentConditions | null {
  const observedAt = rec.utc_valid ? Date.parse(rec.utc_valid) : NaN;
  if (!Number.isFinite(observedAt)) return null;
  const raw = rec.raw ?? '';

  // Same order as normalizeNwsObservation: the text, then the decode only
  // when the text has no sky group, and the two graded against each other.
  const rawSky = parseSkyGroups(raw);
  const decodedSky: SkyLayer[] = [1, 2, 3, 4]
    .map((i) => ({
      cover: rec[`skyc${i}` as 'skyc1'],
      base: rec[`skyl${i}` as 'skyl1'],
    }))
    .filter((l) => l.cover != null && l.cover !== '')
    .map((l) => ({ cover: toSkyCover(l.cover), baseFtAgl: l.base ?? null }));
  const skyLayers = rawSky.length > 0 ? rawSky : decodedSky;
  const ceiling = skyLayers
    .filter((l) => ['BKN', 'OVC', 'VV'].includes(l.cover) && l.baseFtAgl != null)
    .reduce<number | null>((min, l) => (min == null ? l.baseFtAgl : Math.min(min, l.baseFtAgl!)), null);

  const temps = tempsFromRaw(raw) ?? {
    tempC: rec.tmpf != null ? fToC(rec.tmpf) : null,
    dewpointC: rec.dwpf != null ? fToC(rec.dwpf) : null,
  };
  const speed = rec.sknt ?? null;
  const gust = rec.gust == null || rec.gust === '' ? null : Number(rec.gust);
  const wx = Array.isArray(rec.wxcodes) ? rec.wxcodes.join(' ') : rec.wxcodes;

  return {
    station: stationId,
    observedAt,
    raw,
    source: 'iem',
    wind: {
      // Calm and variable have no direction (see SurfaceWind).
      directionDeg: speed === 0 || rec.drct == null || /\bVRB\d/.test(raw) ? null : rec.drct,
      speedKt: speed,
      gustKt: gust != null && Number.isFinite(gust) ? gust : null,
    },
    visibilitySm: rec.vsby ?? null,
    skyLayers,
    ceilingFtAgl: ceiling,
    skyDecode: compareSkyDecodes(rawSky, decodedSky),
    tempC: temps.tempC,
    dewpointC: temps.dewpointC,
    altimeterInHg: altimeterFromRaw(raw) ?? rec.alti ?? null,
    wxString: wx ? wx : null,
  };
}

/**
 * The observation to show: the newer report of the two, IEM on a tie (the
 * same report, and IEM is the primary). Either side may be missing, a fetch
 * that failed or answered nothing. `source` says which was chosen and
 * `otherObservedAt` when the other side's report was taken, for Data health.
 */
export function chooseObservation(
  iem: CurrentConditions | null,
  nws: CurrentConditions | null,
): { current: CurrentConditions; source: ObservationSource; otherObservedAt: number | null } | null {
  const tag = (c: CurrentConditions, source: ObservationSource): CurrentConditions => ({ ...c, source });
  if (iem && (!nws || iem.observedAt >= nws.observedAt)) {
    return { current: tag(iem, 'iem'), source: 'iem', otherObservedAt: nws?.observedAt ?? null };
  }
  if (nws) return { current: tag(nws, 'nws'), source: 'nws', otherObservedAt: iem?.observedAt ?? null };
  return null;
}

/**
 * Whether a freshly fetched observation may replace the one on screen: not
 * when it is older. Two loops ask for the observation, so an answer can
 * arrive after a newer one, and when IEM drops out NWS's latest is usually
 * the report before the one shown. The same report may replace itself (its
 * feed or the other feed's time may have changed).
 */
export function supersedes(next: CurrentConditions, shown: CurrentConditions | null): boolean {
  return shown == null || next.observedAt >= shown.observedAt;
}
