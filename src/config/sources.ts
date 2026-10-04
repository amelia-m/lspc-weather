import { NEARBY_METAR_STATIONS, SITE } from './site';

/** A data source shown in a card's "Data:" footer, linking to where the
 *  numbers actually come from. */
export interface DataSource {
  label: string;
  url: string;
}

/** The query both live-traffic links take, in tar1090's terms (the map
 *  software adsb.lol runs, read from its script on 2026-10-03; adsb.fi's
 *  globe is reported to run it too but sits behind a bot check, see
 *  `adsbFiTraffic`): `lat`/`lon`/`zoom` centre the map and
 *  `baseMap=VFR_Sectional` draws it over FAA's sectional, the same tiles as
 *  the Sectional card. One string, so the two maps cannot open on different
 *  spots.
 *
 *  No `SiteLat`/`SiteLon`, though they would ring the drop zone: tar1090
 *  saves them in the visitor's own storage until `?SiteClear`, so one tap
 *  would leave every later visit to that site, for the visitor's own
 *  flying, centred and marked on Brown's. `lat`/`lon` are not saved. */
const TRAFFIC_MAP_QUERY = `lat=${SITE.dz.lat}&lon=${SITE.dz.lon}&zoom=10&baseMap=VFR_Sectional`;

export const DATA_SOURCES = {
  /** Current observation from the Iowa Environmental Mesonet, read first
   *  because it carries each report within minutes (see src/domain/iem.ts).
   *  The label names IEM's own id (PMV), which is what the link selects.
   *  The link is IEM's page for the station; the API answers JSON. */
  iemObservation: {
    label: `IEM observation · ${SITE.metarStation.iemId}`,
    url: `https://mesonet.agron.iastate.edu/sites/site.php?station=${SITE.metarStation.iemId}&network=${SITE.metarStation.iemNetwork}`,
  },
  /** Current observation (the METAR), the backup to IEM's. The app fetches
   *  the CORS-enabled api.weather.gov JSON endpoint, but that link points to
   *  the human-readable NWS observation-history page (the API endpoint
   *  downloads as JSON). */
  nwsObservation: {
    label: `NWS observation · ${SITE.metarStation.id}`,
    url: `https://forecast.weather.gov/data/obhistory/${SITE.metarStation.id}.html`,
  },
  /** Gridded hourly forecast for the drop zone (the original NOAA graph). */
  nwsForecast: {
    label: 'NWS forecast · NOAA',
    url: `https://forecast.weather.gov/MapClick.php?lat=${SITE.dz.lat}&lon=${SITE.dz.lon}`,
  },
  /** Winds aloft (pressure-level winds). */
  openMeteo: {
    label: 'Open-Meteo',
    url: 'https://open-meteo.com/',
  },
  /** Mark Schulze's Winds Aloft — same Open-Meteo source; cross-reference.
   *  The page reads `lat` and `lon` from its query string and asks the
   *  browser for the reader's own position only when they are missing
   *  (getPos_maptest.js, read 2026-09-26), so the bare URL opened on
   *  wherever the reader was standing, not the drop zone. */
  markschulze: {
    label: 'Winds Aloft · Mark Schulze',
    url: `https://www.markschulze.net/winds/?lat=${SITE.dz.lat}&lon=${SITE.dz.lon}`,
  },
  /** The VFR sectional chart around the drop zone on SkyVector, the chart a
   *  pilot plans the jump run on: airspace, the airport and what is near it.
   *  Read from SkyVector's own script on 2026-10-03: its Link button writes
   *  `ll` (the centre), `chart` (the chart's protoid) and `zoom` (its scale),
   *  and zooming in lowers the scale to a minimum of 1, so 2 is one step out
   *  from the closest view; its chart service names protoid 301 "World VFR"
   *  (type vfr) at the drop zone's coordinates. The view itself has not been
   *  seen in a browser: the sandbox's browser cannot load https pages. */
  skyvector: {
    label: 'Sectional chart · SkyVector',
    url: `https://skyvector.com/?ll=${SITE.dz.lat},${SITE.dz.lon}&chart=301&zoom=2`,
  },
  /** FAA's VFR sectional as a tile service, published by FAA Aeronautical
   *  Information Services on ArcGIS (the item page this links; the tiles the
   *  Sectional card shows come from `FAA_SECTIONAL_TILES`). */
  faaSectional: {
    label: 'FAA VFR sectional',
    url: 'https://faa.maps.arcgis.com/home/item.html?id=6ab79dc5de5743adb3e3b6e3c803aa59',
  },
  /** Live air traffic around the drop zone on adsb.lol, a community-run
   *  ADS-B network whose data is open (ODbL). The query (`TRAFFIC_MAP_QUERY`)
   *  was read from its map's own script on 2026-10-03. A link and not an
   *  embedded frame: the map's aircraft feed answers only with a
   *  cookie its own page sets, without SameSite=None, so inside a frame on
   *  this site the browser would not send it and the map would show no
   *  aircraft (checked 2026-10-03: the feed returned 207 and no body without
   *  the cookie, 200 and data with it). */
  adsbTraffic: {
    label: 'Live traffic · adsb.lol',
    url: `https://adsb.lol/?${TRAFFIC_MAP_QUERY}`,
  },
  /** The same query on adsb.fi's globe, a second volunteer network, for when
   *  adsb.lol is down. Its page sits behind Cloudflare's bot check, so it
   *  could not be read from a script and has not been seen opening on the
   *  sectional: the query is upstream tar1090's (wiedehopf/tar1090 on
   *  GitHub, html/script.js and html/layers.js, read 2026-10-04, where the
   *  sectional layer is unconditional), and tar1090 falls back to a street
   *  map, silently, on a base map its deployment lacks. The card's text says
   *  only what the link asks for. Not drawn on this card: its aircraft feed
   *  sends no CORS header for this site (checked 2026-10-04). Whether its
   *  map would work in a frame was not checkable. */
  adsbFiTraffic: {
    label: 'Live traffic · adsb.fi',
    url: `https://globe.adsb.fi/?${TRAFFIC_MAP_QUERY}`,
  },
  /** The nearby stations' observations, from IEM's Nebraska ASOS network
   *  (the Nearby METARs card). */
  iemNebraska: {
    label: 'IEM observations · Nebraska ASOS',
    url: 'https://mesonet.agron.iastate.edu/ASOS/current.phtml?network=NE_ASOS',
  },
  /** usairnet aviation forecast for KPMV — a page many jumpers use. Presents
   *  the same NWS forecast data; cross-reference only. */
  usairnet: {
    label: 'usairnet · KPMV',
    url: `https://www.usairnet.com/cgi-bin/launch/code.cgi?state=NE&sta=${SITE.metarStation.id}`,
  },
  /** TAF — fetched from the NWS text-products API; link is the NOAA viewer
   *  showing every station in the fallback chain. */
  taf: {
    label: 'NWS TAF',
    url: `https://aviationweather.gov/data/taf/?ids=${SITE.tafStations.map((s) => s.id).join('%2C')}`,
  },
  /** Offutt's own TAF on aviationweather.gov. api.weather.gov, the only TAF
   *  feed a browser here can read, has never had it (no product under any
   *  lookup on 2026-09-27 or 2026-09-30, while Omaha's had 59); AWC and
   *  NOAA's raw files carry it but send no CORS header. So the TAF card
   *  shows the next station and links here for Offutt's. AWC's TAF page reads
   *  `ids` (or `id`) from the query string (its own script, read 2026-09-30). */
  awcTafPrimary: {
    label: `AWC TAF · ${SITE.tafStations[0].id}`,
    url: `https://aviationweather.gov/data/taf/?ids=${SITE.tafStations[0].id}`,
  },
  /** NOAA winds-and-temps-aloft (FD) forecast — fallback winds source.
   *
   *  The label names no station even though the fetch uses SITE.fdWindsStation
   *  (OMA): this URL is the generic FD product page, and it does not open on
   *  OMA. Labelling the link "· OMA" promised a station the reader would then
   *  have to go and find for themselves — the same defect as a citation naming
   *  a section its link does not open. The query parameters that would select
   *  the station cannot be verified from this environment, so the label matches
   *  what the link actually delivers instead of being guessed at. */
  fdWinds: {
    label: 'NOAA winds aloft (FD)',
    url: 'https://aviationweather.gov/data/windtemp/',
  },
  /** NWS radar (image loop + interactive viewer). */
  radar: {
    label: `NWS radar · ${SITE.radarSite.id}`,
    url: `https://radar.weather.gov/station/${SITE.radarSite.id}/standard`,
  },
  /** Sunrise/sunset computed locally via the NOAA solar-position algorithm. */
  computed: {
    label: 'Computed locally · NOAA solar algorithm',
    url: 'https://gml.noaa.gov/grad/solcalc/calcdetails.html',
  },
} satisfies Record<string, DataSource>;

/** FAA's VFR sectional tiles, z/y/x, 256 px JPEG, levels 8 to 12 (the
 *  MapServer's own description, read 2026-10-03). Loaded as <img>, so no CORS
 *  is needed; the CSP's img-src names the host. */
export const FAA_SECTIONAL_TILES = {
  url: (z: number, y: number, x: number): string =>
    `https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/${z}/${y}/${x}`,
  minZoom: 8,
  maxZoom: 12,
} as const;

/** A link on the Pilots tab's resources card: where a pilot briefs from. */
export interface PilotLink {
  label: string;
  url: string;
  /** What the page is for, in a line. */
  note: string;
}

/** The stations of the Nearby METARs card (config/site.ts). All six
 *  answered aviationweather.gov's METAR API on 2026-10-03. */
const NEARBY_METAR_IDS = NEARBY_METAR_STATIONS.map((s) => s.id);

/**
 * The briefing services, each opened from here on 2026-10-03 unless its note
 * in this comment says otherwise. NOTAM Search answered the sandbox with an
 * Akamai "Access Denied" (it refuses scripts), so that page was not seen;
 * the address is FAA's NOTAM Search. G-AIRMETs are not listed on their own:
 * aviationweather.gov refused /gairmet, and the GFA carries the same AIRMETs.
 * 1-800-WX-BRIEF is not listed because it could not be opened from here.
 */
export const PILOT_LINKS: readonly PilotLink[] = [
  {
    label: 'NOTAM Search (FAA)',
    url: 'https://notams.aim.faa.gov/notamSearch/',
    note: 'NOTAMs for KPMV and the airports around the drop zone.',
  },
  {
    label: 'TFRs (FAA)',
    url: 'https://tfr.faa.gov/',
    note: 'Temporary flight restrictions, list and map.',
  },
  {
    label: 'Nearby METARs (aviationweather.gov)',
    url: `https://aviationweather.gov/data/metar/?ids=${NEARBY_METAR_IDS.join(',')}&hours=0`,
    note: `The latest reports at ${NEARBY_METAR_IDS.join(', ')}.`,
  },
  {
    label: 'PIREPs (aviationweather.gov)',
    url: `https://aviationweather.gov/data/pirep/?id=${SITE.metarStation.id}&distance=100`,
    note: `Pilot reports within 100 nm of ${SITE.metarStation.id}.`,
  },
  {
    label: 'Graphical Forecasts for Aviation (aviationweather.gov)',
    url: 'https://aviationweather.gov/gfa/',
    note: 'Clouds, icing, turbulence and AIRMETs on a map.',
  },
  {
    label: 'SIGMETs (aviationweather.gov)',
    url: 'https://aviationweather.gov/sigmet/',
    note: 'SIGMETs and convective SIGMETs in force.',
  },
  {
    label: 'Chart Supplement (FAA)',
    url: 'https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd/search/',
    note: `Airport details; search ${SITE.metarStation.id.slice(1)} for Plattsmouth.`,
  },
];
