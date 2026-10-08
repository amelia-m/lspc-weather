import { DATA_SOURCES } from '../config/sources';

/**
 * Open-Meteo's credit, its licence, and what this app changes in its data,
 * which CC BY 4.0 asks a reuser to say (open-meteo.com/en/licence, read
 * 2026-10-08). The page footer and #parity carry it; each card showing the
 * data links Open-Meteo and the licence in its own "Data:" line.
 *
 * Pointed at the cards' Data lines on purpose: when Open-Meteo is
 * unreachable the winds and drift come from the NOAA FD bulletin and the
 * outlook from the NWS gridpoint, and this must not claim those as
 * Open-Meteo's.
 */
export function OpenMeteoCredit(): JSX.Element {
  const om = DATA_SOURCES.openMeteo;
  return (
    <>
      <a href={om.url} target="_blank" rel="noopener noreferrer">
        Weather data by Open-Meteo.com
      </a>
      {om.licence && (
        <>
          {', under '}
          <a href={om.licence.url} target="_blank" rel="noopener noreferrer">
            {om.licence.label}
          </a>
        </>
      )}
      . Where this dashboard shows Open-Meteo data (a card&rsquo;s Data line says when), it has
      reworked it: winds and temperatures interpolated from pressure levels to heights above the drop zone, a drift
      estimate worked from those winds, and the 10-day outlook&rsquo;s weather codes grouped into
      its own labels.
    </>
  );
}
