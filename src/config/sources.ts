import { SITE } from './site';

/** A data source shown in a card's "Data:" footer, linking to where the
 *  numbers actually come from. */
export interface DataSource {
  label: string;
  url: string;
}

export const DATA_SOURCES = {
  /** Current observation (the METAR). The app fetches the CORS-enabled
   *  api.weather.gov JSON endpoint, but that link points to the human-readable
   *  NWS observation-history page (the API endpoint downloads as JSON). */
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
