import { DATA_SOURCES } from '../config/sources';
import { SourceLinks } from './common/SourceLinks';

/**
 * Open-Meteo's credit, its licence, and what this app changes in its data,
 * which CC BY 4.0 asks a reuser to say (open-meteo.com/en/licence, read
 * 2026-10-08). The page footer and #parity carry it; each card showing the
 * data links Open-Meteo and the licence in its own "Data:" line.
 *
 * Names the two cards Open-Meteo feeds, and says they name their fallback,
 * so it does not claim the NOAA FD bulletin or the NWS gridpoint as
 * Open-Meteo's when those are what the cards show.
 */
export function OpenMeteoCredit(): JSX.Element {
  return (
    <>
      <SourceLinks sources={[{ ...DATA_SOURCES.openMeteo, label: 'Weather data by Open-Meteo.com' }]} />
      : the winds aloft and the 10-day outlook, unless it is unreachable, when those cards name
      their fallback. This dashboard reworks it: winds and temperatures interpolated from pressure
      levels to heights above the drop zone, a drift estimate worked from those winds, and the
      outlook&rsquo;s weather codes grouped into its own labels.
    </>
  );
}
