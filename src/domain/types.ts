/** Normalized internal model. All API responses are mapped onto these shapes
 *  by src/domain/normalize.ts so the UI and advisory engine never touch raw
 *  vendor JSON. Units are explicit in field names. */

/** METAR sky covers. SKC, CLR, NSC and NCD all mean no cloud to report (NCD is
 *  the automated-station form used outside the US); FEW/SCT are layers that
 *  are not a ceiling; BKN/OVC/VV are. */
export type SkyCover = 'SKC' | 'CLR' | 'NSC' | 'NCD' | 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'VV';

export interface SurfaceWind {
  /** Degrees true. null when calm or variable. */
  directionDeg: number | null;
  /** Sustained speed, kt. null = missing/unreported (e.g. sensor failed QC);
   *  0 = a genuine calm observation. The two must never be conflated. */
  speedKt: number | null;
  gustKt: number | null;
}

export interface SkyLayer {
  cover: SkyCover;
  /** Cloud base, ft AGL. null for clear layers. */
  baseFtAgl: number | null;
}

/** How the two decodes of one observation compared — the METAR text the
 *  normaliser parses itself, and api.weather.gov's `cloudLayers`. The text
 *  wins whenever it has a sky group; this records whether the decode agreed,
 *  so Data health can show when it did not. On 2026-09-23 the decode was
 *  empty for a two-hour overcast and nothing on screen said so. */
export type SkyDecodeCheck =
  | 'agrees' // same layers, bases within rounding
  | 'decode-empty' // text has sky groups, the decode has none
  | 'decode-differs' // both present, different layers
  | 'text-empty' // text has no sky group; layers came from the decode
  | 'not-reported'; // neither has anything

/** Current observation, from a METAR (KPMV). */
/** Which feed served an observation: the Iowa Environmental Mesonet
 *  (primary, minutes after the report) or api.weather.gov (the backup). */
export type ObservationSource = 'iem' | 'nws';

export interface CurrentConditions {
  station: string;
  observedAt: number; // epoch ms
  raw: string;
  /** Which feed the report came from. chooseObservation sets it on the one
   *  shown; normalizeNwsObservation leaves it unset, having been written
   *  when there was one feed. */
  source?: ObservationSource;
  wind: SurfaceWind;
  visibilitySm: number | null;
  /** Sky groups as reported. A clear sky is a CLR/SKC/NCD layer with no base,
   *  so an EMPTY list means the sky was not reported (an observation with no
   *  METAR text, or one whose sensor reported nothing) — not that it was clear.
   *  The cards say "Not reported" for it and withhold the VFR label, which
   *  needs a ceiling to be established. */
  skyLayers: SkyLayer[];
  /** Lowest BKN/OVC/VV layer base, ft AGL. null means no ceiling could be
   *  computed, which is NOT the same as "no ceiling": a `BKN///` (a broken
   *  layer whose height the sensor could not measure) and a report with no
   *  sky group both leave it null. `ceilingState()` in normalize.ts says
   *  which; the cards and `observedFlightCategory` go through it. */
  ceilingFtAgl: number | null;
  /** Set by normalizeNwsObservation, which has two decodes to compare. Absent
   *  on the aviationweather path (normalizeMetar), which has one. */
  skyDecode?: SkyDecodeCheck;
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
  /** Forecast thunderstorm probability, percent (NWS gridpoint). */
  thunderProbPct: number | null;
  /** Forecast precipitation amount for the period, inches (NWS QPF). */
  precipAmountIn: number | null;
  tempC: number | null;
}

/** One day of the extended outlook, from Open-Meteo's daily forecast. */
export interface DailyPoint {
  /** Epoch ms marking the forecast day (local day per SITE.timeZone). */
  date: number;
  /** WMO weather interpretation code (0 clear … 99 thunderstorm w/ hail). */
  weatherCode: number | null;
  tempMaxC: number | null;
  tempMinC: number | null;
  /** Daily maximum 10 m wind speed / gust, knots. */
  windMaxKt: number | null;
  gustMaxKt: number | null;
  /** The day's dominant 10 m wind direction, degrees true (the direction it
   *  blows FROM): the speed-weighted vector mean of its hourly winds. See
   *  `dominantWindDirectionDeg`. A mean, not the direction of the maximum. */
  windDirDominantDeg: number | null;
  precipProbMaxPct: number | null;
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
  /** Dry: from the thermometer reading, FAA-P-8740-2's density altitude. */
  densityAltitudeFt: number;
  /** With the dew point folded in through the virtual temperature, as the
   *  NWS calculator computes it; null when the report has no dew point. */
  humidDensityAltitudeFt: number | null;
  pressureAltitudeFt: number;
  /** The altimeter setting reduced to the field's elevation by the NWS
   *  station-pressure formula, to two decimals: what the NWS Density
   *  Altitude calculator asks for. */
  stationPressureInHg: number;
  isaDeviationC: number;
  fieldElevationFt: number;
  /** The temperature and dew point the figures were worked from, so the
   *  card can print them to the tenth the report carries. */
  oatC: number;
  dewpointC: number | null;
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

/** Where the winds-aloft levels came from: Open-Meteo (its 10 to 180 m
 *  winds and pressure levels) or the NOAA FD text-product fallback. */
export type WindsAloftSource = 'open-meteo' | 'nws-fd';

/**
 * WHEN the winds-aloft levels are valid — a first-class fact, not a detail.
 *
 * Both sources are forecasts for a specific time, not observations of now:
 * Open-Meteo is snapped to the nearest hourly step (which can be up to half an
 * hour ahead of the clock), and a NOAA FD bulletin verifies at a single stated
 * hour. Jumpers cross-check this card against Mark Schulze's Winds Aloft, which
 * prints its own valid time in Z; unless this app states its valid time too,
 * a routine one-hour offset looks exactly like a data disagreement.
 */
export interface WindsAloftValidity {
  /** Epoch ms the levels verify at. null when the source states no valid time
   *  (an FD bulletin whose header did not parse). */
  validMs: number | null;
  /** FD only: the model cycle the bulletin was computed from ("DATA BASED ON"). */
  basedOnMs?: number | null;
  /** FD only: the bulletin's own "FOR USE hhmm-hhmm" window, hours in Z. The
   *  codes carry no day, so this stays text rather than becoming timestamps. */
  forUseRaw?: string | null;
}

/** How the Open-Meteo winds table is built: from every sample this app takes
 *  (`all`, the default), or as Mark Schulze's tool builds his (`schulze`). */
export type WindsMethod = 'all' | 'schulze';

/** The levels for one forecast hour. */
export interface WindsAloftHour {
  validMs: number;
  levels: WindsAloftLevel[];
  /** The same hour as Mark Schulze's tool builds it (interpolateAsSchulze);
   *  absent on the NOAA FD fallback. */
  schulzeLevels?: WindsAloftLevel[];
}

/** One hour of Open-Meteo cloud cover, percentages of the sky (total, and
 *  the low, mid and high bands); null where not served. */
export interface OpenMeteoCloudHour {
  time: number;
  totalPct: number | null;
  lowPct: number | null;
  midPct: number | null;
  highPct: number | null;
}

/** One fetch of winds aloft: the interpolated levels and the time they are for.
 *  Returned by both the Open-Meteo path and the NOAA FD fallback so neither can
 *  hand the UI altitudes without a valid time. The Schulze-method table rides
 *  on `hours` only, which is where the card reads it. */
export interface WindsAloftForecast {
  levels: WindsAloftLevel[];
  validity: WindsAloftValidity;
  /** Open-Meteo's cloud cover for the same hours, served in the same
   *  response. Absent on the NOAA FD fallback. */
  clouds?: OpenMeteoCloudHour[];
  /** Every hour the source served, ascending, for stepping the card through
   *  them. Absent on the NOAA FD fallback, which is one bulletin. */
  hours?: WindsAloftHour[];
}

/** Where the daily outlook came from: Open-Meteo (10 days) or the NWS
 *  gridpoint aggregate fallback (~7 days). */
export type DailySource = 'open-meteo' | 'nws-gridpoint';

/** Merged, normalized snapshot fed to the advisory engine and the UI. */
export interface WeatherSnapshot {
  current: CurrentConditions | null;
  /** When the observation feed NOT shown had its latest report taken (see
   *  chooseObservation); null when that feed failed or had none. */
  currentOtherObservedAt?: number | null;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  /** null until the daily outlook has loaded. */
  dailySource?: DailySource | null;
  windsAloft: WindsAloftLevel[];
  /** null until winds aloft have loaded. */
  windsAloftSource?: WindsAloftSource | null;
  /** Forecast time the `windsAloft` levels are valid for. null until they load. */
  windsAloftValidity?: WindsAloftValidity | null;
  /** Every forecast hour behind `windsAloft`, for the card's hour buttons.
   *  null on the FD fallback and until the winds load. */
  windsAloftHours?: WindsAloftHour[] | null;
  /** Open-Meteo's hourly cloud cover, from the winds request; null on the
   *  FD fallback and until it loads. When neither winds source answers, the
   *  last answer is kept, as the winds are, and Data health marks the
   *  source stale. */
  openMeteoClouds?: OpenMeteoCloudHour[] | null;
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
  /** A second authority, where the guidance makes a claim the first does not
   *  support. The after-sunset flag is the case it exists for: the FAA reg
   *  sets the light requirement and the trigger, while the USPA licence claim
   *  in the same sentence comes from the SIM. One link for two authorities let
   *  a reader check the reg and find nothing about licences in it. */
  secondaryCitation?: Citation;
}

export type JumperClass = 'student' | 'licensed';

// ---- Per-source fetch status ----

export type SourceKey = 'nws' | 'metar' | 'windsAloft' | 'taf' | 'daily';

export interface SourceStatus {
  ok: boolean;
  fetchedAt: number | null;
  stale: boolean;
  error: string | null;
  /** True while a fetch for this source is in flight. */
  pending: boolean;
}
