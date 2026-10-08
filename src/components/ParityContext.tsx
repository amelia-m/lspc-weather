import { REPO_URL } from '../config/site';
import { Panel } from './common/Panel';

/**
 * The checks made by hand while reading the comparison logs, kept beside the
 * live figures so a reader of #parity has the context those figures were
 * read in. Each was measured once; none moves with the summary, so each says
 * when it was measured and where it is written up, and the figures here are
 * copied from those write-ups, not recomputed. A check that is repeated
 * should change its write-up first and this panel after.
 *
 * Like the rest of the page: what was measured, and no verdict on it.
 */

const doc = (path: string): string => `${REPO_URL}/blob/main/${path}`;
const SCHULZE_DOC = doc('docs/markschulze-altitude-reference.md');
const PARITY_DOC = doc('docs/source-parity.md');
const SUN_SOURCE = doc('src/domain/sun.ts');

/** docs/markschulze-altitude-reference.md, "How far apart the tables are, by
 *  the time they represent": 2026-09-26 16:19Z, rows 1,000 to 13,000 ft. */
const GAP_GROWTH: [hours: number, pairs: number, dirAvg: string, dir90: string, spdAvg: string, spd90: string][] = [
  [0, 416, '0.5°', '1°', '0.0 kt', '0 kt'],
  [1, 806, '9.6°', '24°', '1.2 kt', '3 kt'],
  [2, 780, '18°', '48°', '2.0 kt', '5 kt'],
  [3, 754, '26°', '69°', '2.8 kt', '6 kt'],
  [6, 676, '47°', '143°', '4.4 kt', '9 kt'],
  [12, 520, '85°', '157°', '6.8 kt', '14 kt'],
  [24, 208, '143°', '175°', '9.4 kt', '18 kt'],
];

/** The same document, "How the surface row was worked out": 2026-10-03,
 *  around 01Z. */
const GROUND_SITES: [site: string, ground: string, hours: number, levels: string][] = [
  ['This drop zone (the point used until Oct 8)', '1,145 ft', 48, '1000 hPa (below ground) and 975 hPa'],
  ['Longmont, CO', '5,039 ft', 12, 'the levels either side of the ground'],
  ['Near Houston', '26 ft', 6, 'the two lowest, extended down'],
  ['Near Tampa', '89 ft', 6, 'the two lowest, extended down'],
];

export function ParityContext(): JSX.Element {
  return (
    <Panel title="Context: checks made by hand" subtitle="measured once each, not from the logs">
      <p className="muted small">
        These were measured while reading the logs above. They do not update with the summary;
        each says when it was measured and where it is written up.
      </p>

      <h4 className="cite-found-head">How the winds gap grows with the hours between the tables</h4>
      <p className="muted small">
        Measured on Sep 26 at 16:19Z: this dashboard&rsquo;s table for each of the next 32 hours
        against Schulze&rsquo;s for the same 32, fetched the same minute, every pair grouped by how
        many hours apart the two forecast hours were. Rows from 1,000 to 13,000 ft.
      </p>
      <div className="sky-scroll">
        <table className="aloft-table">
          <thead>
            <tr>
              <th>hours apart</th>
              <th>pairs</th>
              <th>avg dir</th>
              <th>90th dir</th>
              <th>avg speed</th>
              <th>90th speed</th>
            </tr>
          </thead>
          <tbody>
            {GAP_GROWTH.map(([h, pairs, da, d9, sa, s9]) => (
              <tr key={h}>
                <td>{h}</td>
                <td>{pairs}</td>
                <td>{da}</td>
                <td>{d9}</td>
                <td>{sa}</td>
                <td>{s9}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Each hour between the two adds about as much as the forecast changes in an hour. The large
        direction gaps are light winds: where both speeds were 10&nbsp;kt or more, one hour apart
        was 9° at the 90th percentile and 21° at the most. One day&rsquo;s weather, with a front
        coming through, so it shows the shape of the effect rather than a constant (
        <a href={SCHULZE_DOC} target="_blank" rel="noopener noreferrer">
          write-up
        </a>
        ).
      </p>

      <h4 className="cite-found-head">Which hour each table shows</h4>
      <p className="muted small">
        Open-Meteo gives one forecast per hour, valid on the hour. This dashboard shows the
        nearest hour, so the hour on the card is at most 30 minutes from now and 15 on average.
        Schulze&rsquo;s page shows the hour in progress, so its hour is up to 59 minutes behind
        now and 30 on average. That is why the two pages are an hour apart after half past every
        hour. Both pages have buttons to step an hour either way. Neither chooses the forecast
        run: the &ldquo;newer run&rdquo; rows above are whichever run Open-Meteo served each one.
        The rule each page used when the gap above was measured, on Sep 26 (
        <a href={SCHULZE_DOC} target="_blank" rel="noopener noreferrer">
          write-up
        </a>
        ).
      </p>

      <h4 className="cite-found-head">How Schulze&rsquo;s Surface row was worked out</h4>
      <p className="muted small">
        Read on Oct 3, around 01Z, from the same data endpoint Schulze&rsquo;s page loads: each
        hour&rsquo;s raw levels put through the rule and compared with the ground value served.
        Direction matched to the degree in all 72 hours; speed within 1&nbsp;kt, which is the
        whole-knot rounding of the raw speeds. It is worked out from the outputs at four sites
        over one day&rsquo;s forecasts; the code that computes it cannot be read (
        <a href={SCHULZE_DOC} target="_blank" rel="noopener noreferrer">
          write-up
        </a>
        ).
      </p>
      <div className="sky-scroll">
        <table className="aloft-table">
          <thead>
            <tr>
              <th>site</th>
              <th>ground</th>
              <th>hours</th>
              <th>levels used</th>
            </tr>
          </thead>
          <tbody>
            {GROUND_SITES.map(([site, ground, hours, levels]) => (
              <tr key={site}>
                <td>{site}</td>
                <td>{ground}</td>
                <td>{hours}</td>
                <td>{levels}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Two other readings were ruled out: Open-Meteo&rsquo;s 10&nbsp;m and 80&nbsp;m winds (neither
        matched at the sea-level sites), and a km/h figure read as knots (the ratio of the two
        ground speeds runs near 1.2, not 1.85).
      </p>

      <h4 className="cite-found-head">Sunrise and sunset</h4>
      <p className="muted small">
        Until Oct 3 this dashboard used a simplified sunrise equation that put the drop
        zone&rsquo;s sunset 2 to 3 minutes late, so the night-jump flag (14 CFR 105.19) came on
        late: on Sep 29 it gave 7:11:55 PM, where NOAA&rsquo;s Solar Calculator gives 7:09:34, the
        astral library 7:09:20 and Open-Meteo 7:09, and usairnet printed 7:09 for KPMV. It now
        uses NOAA&rsquo;s own method, held by its tests to NOAA&rsquo;s script within 5&nbsp;ms.
        Rounded to the minute, it matched the US Naval Observatory&rsquo;s times for the drop zone in
        56 of 56 sunrises and sunsets across 2026 (read Oct 3). The sun rows above count only runs
        since the change (
        <a href={SUN_SOURCE} target="_blank" rel="noopener noreferrer">
          write-up
        </a>
        , in the method&rsquo;s own notes).
      </p>

      <h4 className="cite-found-head">Why older observation runs are left out of some rows</h4>
      <p className="muted small">
        Each of these showed on this page as a disagreement. All but one turned out to be the
        comparison&rsquo;s own misreading, not either side&rsquo;s decode, and each of those rows now
        counts only runs from the version of the comparison that fixed it, logged from Sep 30 and
        Oct 3 (
        <a href={PARITY_DOC} target="_blank" rel="noopener noreferrer">
          write-up
        </a>
        ).
      </p>
      <ul className="cite-found">
        <li>
          <strong>Gusting winds:</strong> usairnet prints the gust between the speed and the
          direction, and the comparison read no direction. 19 of the 24 wind-direction differences
          on the same report to Sep 29. The speeds agreed in all 19.
        </li>
        <li>
          <strong>Calm:</strong> NWS&rsquo;s decode gives a calm wind 0°, usairnet gives no
          direction. 4 runs to Sep 29. No card shows the 0°.
        </li>
        <li>
          <strong>One unexplained run:</strong> on Sep 27 at 19:45Z usairnet&rsquo;s page gave no
          speed or direction for a 3&nbsp;kt wind. It is not a known misreading and nothing was fixed
          for it; its direction is left out only because it predates the runs the wind-direction
          row now counts. The comparison now keeps the page&rsquo;s text when a field will not read,
          so a repeat can be explained.
        </li>
        <li>
          <strong>Overcast:</strong> usairnet writes &ldquo;Solid Overcast&rdquo;; the FAA&rsquo;s word,
          which this dashboard uses, is &ldquo;Overcast&rdquo;. Clouds agreed in 72 of 120 same-report
          runs to Sep 29, and in 576 of 576 once the comparison used usairnet&rsquo;s word (to Oct
          2).
        </li>
        <li>
          <strong>Rain or fog in usairnet&rsquo;s heading</strong> hid the temperature from the
          comparison. How many runs it affected was not recorded.
        </li>
        <li>
          <strong>North wind:</strong> 360° in the report, &ldquo;0° North&rdquo; on usairnet&rsquo;s
          page, compared as text. 48 runs to Oct 2.
        </li>
        <li>
          <strong>Fractional visibility</strong> (&ldquo;1 1/4 Miles&rdquo;) read as none. 25 runs
          to Oct 2.
        </li>
      </ul>
    </Panel>
  );
}
