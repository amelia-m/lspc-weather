import { haversineMiles, initialBearingDeg } from '../domain/geo';
import { compass } from '../domain/units';
import { radarImageFraction, type RadarImageGeoref } from '../domain/radarGeo';

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
  };
  /** TAF stations near the DZ, in preference order (KPMV issues no TAF).
   *  Offutt is closest but its TAF is issued by the USAF and is not always
   *  carried in the NWS text-product feed the app can reach from a browser,
   *  so civilian fallbacks follow. */
  tafStations: Array<{
    id: string; // ICAO
    name: string;
    lat: number;
    lon: number;
    /** NWS text-product location code (ICAO minus leading "K"). */
    nwsProductLocation: string;
  }>;
  /** NWS WSR-88D radar covering the drop zone. */
  radarSite: {
    id: string; // e.g. KOAX
    name: string;
    lat: number;
    lon: number;
  };
  /** Nearest station in the NOAA winds-aloft (FD) bulletin — the fallback
   *  winds source when Open-Meteo is unreachable. */
  fdWindsStation: string;
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
  },
  tafStations: [
    { id: 'KOFF', name: 'Offutt AFB', lat: 41.1183, lon: -95.9124, nwsProductLocation: 'OFF' },
    {
      id: 'KOMA',
      name: 'Omaha Eppley Airfield',
      lat: 41.3032,
      lon: -95.8941,
      nwsProductLocation: 'OMA',
    },
    { id: 'KLNK', name: 'Lincoln Airport', lat: 40.851, lon: -96.759, nwsProductLocation: 'LNK' },
  ],
  radarSite: {
    id: 'KOAX',
    name: 'NWS Omaha / Valley',
    lat: 41.3203,
    lon: -96.3667,
  },
  fdWindsStation: 'OMA',
  timeZone: 'America/Chicago',
};

/**
 * Georeferencing of the NWS RIDGE "standard" radar image the Radar card shows.
 *
 * **Measured, not published.** NWS serves no world file, `.aux.xml` or bbox
 * alongside these GIFs (`/ridge/standard/` contains GIFs and nothing else),
 * and radar.weather.gov's own viewer treats the file as an ungeoreferenced
 * picture. These figures come from registering the image against county
 * boundary geometry fetched from `api.weather.gov/zones/county/...`:
 * projecting 11,000 authoritative boundary vertices into the image and fitting
 * the transform that puts them on the drawn lines.
 *
 * Measured 2026-09-22 against KOAX, and cross-checked on KUEX and KDMX so the
 * figures describe the product rather than one image:
 *
 * | site | bbox span | centre lon − radar | centre lat − radar |
 * |------|-----------|--------------------|--------------------|
 * | KOAX | 4.286°    | +0.001°            | +0.061°            |
 * | KUEX | 4.288°    | +0.001°            | +0.059°            |
 * | KDMX | 4.288°    | +0.001°            | +0.060°            |
 *
 * All three registered at a median residual of 0 px (90th percentile 1 px)
 * under an equirectangular model; Mercator and azimuthal-equidistant models
 * fitted an order of magnitude worse, and forcing the bbox to be centred on
 * the radar — the obvious assumption — was off by a median of 2 px and 8 px at
 * the 90th percentile. Hence `centreLatOffsetDeg`: the image is centred on the
 * radar in longitude but not in latitude.
 *
 * Nothing upstream promises these will hold. If NWS changes the product the
 * marker moves silently, so `docs/open-questions.md` carries the method for
 * re-measuring it.
 */
export const RADAR_IMAGE_GEOREF: RadarImageGeoref = {
  spanDeg: 4.287,
  centreLatOffsetDeg: 0.0603,
  // The 600x550 image carries a 24 px NWS header bar and a 24 px colour-scale
  // and timestamp bar, both drawn over the map.
  barTopFrac: 24 / 550,
  barBottomFrac: 1 - 24 / 550,
};

/** Where the drop zone falls inside the radar loop image, as fractions of its
 *  width and height — null if it is not on the visible map. Derived from the
 *  DZ and radar coordinates above rather than written down as a pixel offset,
 *  so a correction to either moves the marker with it. */
export const DZ_ON_RADAR_IMAGE = radarImageFraction(
  SITE.dz.lat,
  SITE.dz.lon,
  { lat: SITE.radarSite.lat, lon: SITE.radarSite.lon },
  RADAR_IMAGE_GEOREF,
);

/** Jump-run / drift altitudes (ft AGL) shown in the winds-aloft panel —
 *  surface, 500 ft, then 1,000-ft steps to 13,000 ft (covers C-182 exit
 *  altitudes). The 500 ft row is the landing pattern's altitude, and it is
 *  bracketed by real samples: here the 975 hPa level sits near 250 ft AGL
 *  and 950 hPa near 960 ft, so the row is interpolated, not extrapolated. */
export const WINDS_ALOFT_LEVELS_AGL: readonly number[] = [
  0,
  500,
  ...Array.from({ length: 13 }, (_, i) => (i + 1) * 1000),
];

/** How far a point lies from the drop zone, and in which direction. */
export interface DzOffset {
  distanceMi: number;
  bearingDeg: number;
  /** Compass label for `bearingDeg`, e.g. "ENE". */
  compass: string;
}

/** Great-circle offset of any point from the DZ. Derived rather than written
 *  down: the coordinates above are the single source of truth, so a station
 *  that moves or a correction to its position cannot leave a stale mileage
 *  behind in the config. */
export function offsetFromDz(lat: number, lon: number): DzOffset {
  const bearingDeg = initialBearingDeg(SITE.dz.lat, SITE.dz.lon, lat, lon);
  return {
    distanceMi: haversineMiles(SITE.dz.lat, SITE.dz.lon, lat, lon),
    bearingDeg,
    compass: compass(bearingDeg),
  };
}

/** Offset of the METAR station (KPMV) from the DZ — ~11.5 mi ENE. Surface
 *  observations are a proxy from there, so the UI states the gap. */
export const METAR_STATION_OFFSET: DzOffset = offsetFromDz(
  SITE.metarStation.lat,
  SITE.metarStation.lon,
);

/** Where this dashboard's source lives. The citations page sends a reviewer's
 *  answers here as a new issue, and the club-policy citation links here. */
export const REPO_URL = 'https://github.com/amelia-m/lspc-weather';
