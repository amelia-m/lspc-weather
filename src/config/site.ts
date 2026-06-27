/**
 * Fixed site configuration for the Lincoln Sport Parachute Club (LSPC).
 *
 * The drop zone operates from Brown's Airport (NE69) in Weeping Water, NE.
 * The nearest official reporting station (METAR/TAF) is Plattsmouth
 * Municipal (KPMV), roughly 12 miles to the east-northeast — so surface
 * observations are a proxy, while gridded forecasts use the actual DZ
 * coordinates.
 */

export interface SiteConfig {
  /** Drop zone — used for NWS gridpoint + Open-Meteo lookups. */
  dz: {
    name: string;
    icao: string; // FAA local id (NE69 has no ICAO; used for display)
    lat: number;
    lon: number;
    elevationFt: number;
  };
  /** Nearest reporting station for METARs. */
  metarStation: {
    id: string; // ICAO
    name: string;
    lat: number;
    lon: number;
    elevationFt: number;
    distanceMi: number; // approx distance from the DZ
  };
  /** Nearest station that issues a TAF (KPMV does not). */
  tafStation: {
    id: string; // ICAO
    name: string;
    lat: number;
    lon: number;
    /** NWS text-product location code (ICAO minus leading "K"). */
    nwsProductLocation: string;
  };
  timeZone: string;
}

export const SITE: SiteConfig = {
  dz: {
    name: "Lincoln Sport Parachute Club (Brown's Airport)",
    icao: 'NE69',
    lat: 40.8675,
    lon: -96.11,
    elevationFt: 1182,
  },
  metarStation: {
    id: 'KPMV',
    name: 'Plattsmouth Municipal / Douglas V Duey Field',
    lat: 40.9502,
    lon: -95.9179,
    elevationFt: 1204,
    distanceMi: 12,
  },
  tafStation: {
    id: 'KOFF',
    name: 'Offutt AFB',
    lat: 41.1183,
    lon: -95.9124,
    nwsProductLocation: 'OFF',
  },
  timeZone: 'America/Chicago',
};

/** Jump-run / drift altitudes (ft AGL) shown in the winds-aloft panel —
 *  surface to 13,000 ft in 1,000-ft increments (covers C-182 exit altitudes). */
export const WINDS_ALOFT_LEVELS_AGL: readonly number[] = Array.from(
  { length: 14 },
  (_, i) => i * 1000,
);
