/** Normalized internal model. All API responses are mapped onto these shapes
 *  by src/domain/normalize.ts so the UI and advisory engine never touch raw
 *  vendor JSON. Units are explicit in field names. */

export type SkyCover = 'SKC' | 'CLR' | 'NSC' | 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'VV';

export interface SurfaceWind {
  /** Degrees true. null when calm or variable. */
  directionDeg: number | null;
  speedKt: number;
  gustKt: number | null;
}

export interface SkyLayer {
  cover: SkyCover;
  /** Cloud base, ft AGL. null for clear layers. */
  baseFtAgl: number | null;
}

/** Current observation, from a METAR (KPMV). */
export interface CurrentConditions {
  station: string;
  observedAt: number; // epoch ms
  raw: string;
  wind: SurfaceWind;
  visibilitySm: number | null;
  skyLayers: SkyLayer[];
  /** Lowest BKN/OVC/VV layer base, ft AGL. null = no ceiling. */
  ceilingFtAgl: number | null;
  tempC: number | null;
  dewpointC: number | null;
  altimeterInHg: number | null;
  /** Present-weather string from the METAR (e.g. "TSRA", "-RA"). */
  wxString: string | null;
}

/** A single forecast hour, from NWS gridpoint data. */
export interface HourlyPoint {
  time: number; // epoch ms
  skyCoverPct: number | null;
  ceilingFtAgl: number | null;
  visibilitySm: number | null;
  windSpeedKt: number | null;
  windGustKt: number | null;
  windDirectionDeg: number | null;
  precipProbPct: number | null;
  tempC: number | null;
}

/** Wind at one altitude, from Open-Meteo, interpolated to a jump altitude. */
export interface WindsAloftLevel {
  altitudeFtAgl: number;
  altitudeFtMsl: number;
  directionDeg: number;
  speedKt: number;
  /** Temperature at this altitude, °C (null if the model didn't provide it). */
  tempC: number | null;
}

export interface DensityAltitudeResult {
  densityAltitudeFt: number;
  pressureAltitudeFt: number;
  isaDeviationC: number;
  fieldElevationFt: number;
}

export interface SunTimes {
  sunrise: number; // epoch ms
  sunset: number; // epoch ms
}

/** Terminal Aerodrome Forecast (from the nearest TAF station). */
export interface TafForecast {
  station: string;
  raw: string; // the TAF body text
  issuedMs: number | null;
  /** Raw valid-period token, e.g. "2718/2824" (UTC day/hour). */
  validRaw: string | null;
}

/** Merged, normalized snapshot fed to the advisory engine and the UI. */
export interface WeatherSnapshot {
  current: CurrentConditions | null;
  hourly: HourlyPoint[];
  windsAloft: WindsAloftLevel[];
  sun: SunTimes | null;
  densityAltitude: DensityAltitudeResult | null;
  taf: TafForecast | null;
}

// ---- Advisories (flags, never a go/no-go verdict) ----

export interface Citation {
  source: string; // e.g. "USPA SIM 2-1", "14 CFR 105.17"
  ref: string; // short human label, e.g. "Basic Safety Requirements"
  url: string;
  /** Optional caveat, e.g. "value not live-verified from this environment". */
  note?: string;
}

/** Neutral severity. NOT a recommendation — the human makes the call. */
export type AdvisoryLevel = 'info' | 'watch' | 'caution';

export interface Advisory {
  id: string;
  level: AdvisoryLevel;
  metric: string; // "Surface wind"
  value: string; // "21 kt (24 mph), gusting 28"
  guidance: string; // brief paraphrase of the cited rule
  citation: Citation;
}

export type JumperClass = 'student' | 'licensed';

// ---- Per-source fetch status ----

export type SourceKey = 'nws' | 'metar' | 'windsAloft' | 'taf';

export interface SourceStatus {
  ok: boolean;
  fetchedAt: number | null;
  stale: boolean;
  error: string | null;
}
