import { DATA_SOURCES } from '../config/sources';
import { SourceLinks } from './common/SourceLinks';

/**
 * Open-Meteo's credit, its licence, and what this app changes in its data,
 * which CC BY 4.0 asks a reuser to say (open-meteo.com/en/licence, read
 * 2026-10-08). Each card showing the data links Open-Meteo and the licence
 * in its own "Data:" line; this is the fuller statement.
 *
 * `scope` is what the page it sits on shows. The dashboard footer names the
 * three cards Open-Meteo feeds (Winds aloft, Drift, and the 10-day
 * outlook's day rows) and says they name the fallback that answered, so it
 * does not claim the NOAA FD bulletin or the NWS gridpoint as Open-Meteo's.
 * #parity shows the winds comparison, and its context notes quote other
 * Open-Meteo figures, so it says that.
 */
export function OpenMeteoCredit({ scope }: { scope: 'dashboard' | 'winds' }): JSX.Element {
  const credit = (
    <SourceLinks sources={[{ ...DATA_SOURCES.openMeteo, label: 'Weather data by Open-Meteo.com' }]} />
  );
  if (scope === 'winds') {
    return (
      <>
        {credit}: this dashboard&rsquo;s winds aloft and any other Open-Meteo figure this page
        quotes. The dashboard interpolates its pressure-level and 10 m winds to heights above the
        drop zone, Surface row included.
      </>
    );
  }
  return (
    <>
      {credit}: the winds aloft, the drift estimate and the 10-day outlook&rsquo;s day rows, unless
      it is unreachable, when those cards name the fallback that answered, if one did. This dashboard reworks it: winds and
      temperatures interpolated from pressure levels to heights above the drop zone, a drift
      estimate worked from those winds, and the day rows&rsquo; weather codes grouped into its own
      labels.
    </>
  );
}
