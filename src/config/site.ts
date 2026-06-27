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
  /** Nearest reporting station for METAR/TAF. */
  metarStation: {
    id: string; // ICAO
    name: string;
    lat: number;
    lon: number;
    elevationFt: number;
    distanceMi: number; // approx distance from the DZ
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
  timeZone: 'America/Chicago',
};

/** Jump-run / drift altitudes (ft AGL) shown in the winds-aloft panel. */
export const WINDS_ALOFT_LEVELS_AGL = [0, 3000, 6000, 9000, 12000] as const;
