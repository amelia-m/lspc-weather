import { SITE } from './site';

/** A data source shown in a card's "Data:" footer, linking to where the
 *  numbers actually come from. */
export interface DataSource {
  label: string;
  url: string;
}

export const DATA_SOURCES = {
  /** Current observation (the METAR) — NWS, CORS-enabled. */
  nwsObservation: {
    label: `NWS observation · ${SITE.metarStation.id}`,
    url: `https://api.weather.gov/stations/${SITE.metarStation.id}/observations/latest`,
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
  /** Sunrise/sunset computed locally via the NOAA solar-position algorithm. */
  computed: {
    label: 'Computed locally · NOAA solar algorithm',
    url: 'https://gml.noaa.gov/grad/solcalc/calcdetails.html',
  },
} satisfies Record<string, DataSource>;
