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
  /** Mark Schulze's Winds Aloft — same Open-Meteo source; cross-reference. */
  markschulze: {
    label: 'Winds Aloft · Mark Schulze',
    url: 'https://www.markschulze.net/winds/',
  },
  /** usairnet aviation forecast for KPMV — the page the club traditionally
   *  checked. Presents the same NWS forecast data; cross-reference only. */
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
