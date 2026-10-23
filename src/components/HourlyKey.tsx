import { CITATIONS } from '../config/thresholds';
import type { SpeedUnit } from '../domain/units';
import { FlightCategoryPill } from './common/FlightCategoryPill';
import { SourceLink } from './common/SourceLink';

/** NWS's glossary, read 2026-10-23 (forecast.weather.gov/glossary.php): its
 *  entries for Ceiling and Gust, which the key below quotes. Links to a
 *  definition, as the SIM glossary's are (`SimTerm`), not citations: the
 *  figures they explain are the forecast's, and no flag rests on them. */
const NWS_GLOSSARY = 'https://forecast.weather.gov/glossary.php';

/**
 * The hourly table's key, folded under it: what each column is, where it
 * comes from, and what a dash means. Definitions are quoted or paraphrased
 * from the source each names (AIM 7-1-7 for the categories, NWS's glossary
 * for ceiling and gust), so the key asserts nothing of the
 * app's own: a category is a description of ceiling and visibility, not a
 * go/no-go, and the figures are the forecast's.
 */
export function HourlyKey({ unit }: { unit: SpeedUnit }): JSX.Element {
  return (
    <details className="hourly-key">
      <summary className="small">Key: what the columns mean</summary>
      <dl className="muted small">
        <dt>Flight</dt>
        <dd>
          The FAA flight category for the hour, from the NWS forecast&rsquo;s ceiling and visibility,
          as AIM 7-1-7 defines them (<SourceLink citation={CITATIONS.aimFlightCategory} />):
          <ul className="hourly-key-cats">
            <li>
              <FlightCategoryPill category="VFR" /> ceiling above 3,000 ft and visibility over 5 miles; includes
              sky clear.
            </li>
            <li>
              <FlightCategoryPill category="MVFR" /> ceiling 1,000 to 3,000 ft and/or visibility 3 to 5 miles.
            </li>
            <li>
              <FlightCategoryPill category="IFR" /> ceiling 500 to under 1,000 ft and/or visibility 1 to under 3
              miles.
            </li>
            <li>
              <FlightCategoryPill category="LIFR" /> ceiling under 500 ft and/or visibility under 1 mile.
            </li>
          </ul>
          A category describes ceiling and visibility; it is not a go/no-go. A dash means no category
          could be given: the NWS forecasts ceiling and visibility only about a day and a half ahead,
          and the table marks the hour they stop. Where only one of the two is forecast, it can still
          give MVFR, IFR or LIFR, never VFR, which needs both.
        </dd>
        <dt>Ceiling</dt>
        <dd>
          Not a column, but what Flight reads: &ldquo;the height of the cloud base for the lowest broken or
          overcast cloud layer&rdquo; (
          <a href={NWS_GLOSSARY + '?word=ceiling'} target="_blank" rel="noopener noreferrer">
            NWS glossary
          </a>
          ). An hour the forecast gives no ceiling counts as clear for the category.
        </dd>
        <dt>Wind ({unit})</dt>
        <dd>
          The direction the wind blows from, then its speed, then &ldquo;g&rdquo; and the gust where the
          forecast gives one: the NWS forecast&rsquo;s surface wind. A station&rsquo;s report gives a gust
          only when the wind varied by 10 knots or more between peaks and lulls (
          <a href={NWS_GLOSSARY + '?word=gust'} target="_blank" rel="noopener noreferrer">
            NWS glossary
          </a>
          ), so a report with no gust is not a steady wind.
        </dd>
        <dt>Sky</dt>
        <dd>
          The NWS forecast&rsquo;s sky cover: how much of the sky is covered by cloud, as a percentage.
          It says how much, not how high: a high overcast and a low one read the same here. The flight
          category reads the ceiling and the visibility, not this figure.
        </dd>
        <dt>Vis</dt>
        <dd>The NWS forecast&rsquo;s visibility, in statute miles.</dd>
        <dt>Temp</dt>
        <dd>The NWS forecast&rsquo;s temperature.</dd>
        <dt>Rain, Storm</dt>
        <dd>The NWS forecast&rsquo;s chance of precipitation, and of a thunderstorm, for the hour.</dd>
      </dl>
    </details>
  );
}
