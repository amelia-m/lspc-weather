/**
 * Two stations' sky reports side by side: an AWOS and the ASOS at a larger
 * airport near it, hour by hour. The arithmetic behind
 * docs/cloud-cover-stations.md.
 *
 * The question (2026-10-10): KPMV, an AWOS, reported no FEW layer in 71,889
 * reports, and 18 other Nebraska AWOS none in September 2026, while every
 * ASOS did (docs/cloud-cover-sources.md). Set beside a nearby ASOS, how
 * often does such an AWOS report what the ASOS does, and when the ASOS
 * reports FEW, what does the AWOS say? The two are miles apart, so some
 * difference is the sky itself; a pattern that runs one way (ASOS FEW, AWOS
 * SCT far more often than AWOS CLR) is what the station would add.
 *
 * Each top of the hour takes each station's report nearest it within
 * REPORT_WINDOW_MIN (an ASOS reports at :53 or so, an AWOS at :15, :35 and
 * :55). Counts only, never a grade (CLAUDE.md, the governing rule).
 *
 * Pure: reports in, counts out.
 */
import {
  OBSERVED_CATEGORIES,
  isCeiling,
  REPORT_WINDOW_MIN,
  reportNear,
  type ObservedCategory,
  type StationReport,
} from './cloudCoverSources';

export { stationReports, type StationReport } from './cloudCoverSources';

/** An automated station's ceilometer reports nothing above this (CLR is
 *  "no layers ... at or below 12,000 ft", AC 00-45H Table 3-3). Passed as
 *  stationReports' top, a staffed station's observer, who reports cirrus at
 *  25,000 ft, is compared with an AWOS on what the AWOS can see. */
export const AUTOMATED_TOP_FT = 12_000;

const MS_H = 3_600_000;
const WINDOW_MS = REPORT_WINDOW_MIN * 60_000;

export interface PairSummary {
  /** Tops of the hour where both stations had a report with a sky group. */
  hours: number;
  /** Hours by category: `table[a][b]` counts hours station A reported `a`
   *  and station B reported `b`. */
  table: Record<ObservedCategory, Record<ObservedCategory, number>>;
  sameCategory: number;
  /** Whether each reported a ceiling (BKN, OVC or VV). */
  ceiling: { both: number; aOnly: number; bOnly: number; neither: number };
}

const emptyTable = (): PairSummary['table'] =>
  Object.fromEntries(
    OBSERVED_CATEGORIES.map((a) => [a, Object.fromEntries(OBSERVED_CATEGORIES.map((b) => [b, 0]))]),
  ) as PairSummary['table'];

/** Station A's reports against station B's, at every top of the hour
 *  both stations' reports could reach: from the first hour within the
 *  window of the later station's first report to the last hour within the
 *  window of the earlier station's last. */
export function comparePair(a: readonly StationReport[], b: readonly StationReport[]): PairSummary {
  const table = emptyTable();
  const ceiling = { both: 0, aOnly: 0, bOnly: 0, neither: 0 };
  let hours = 0;
  let sameCategory = 0;
  if (a.length === 0 || b.length === 0) return { hours, table, sameCategory, ceiling };
  const first = Math.ceil((Math.max(a[0].t, b[0].t) - WINDOW_MS) / MS_H) * MS_H;
  const last = Math.min(a[a.length - 1].t, b[b.length - 1].t) + WINDOW_MS;
  // Each list is sorted, so a moving start keeps each search to the reports
  // near the hour; reportNear still decides which, if any, is near enough.
  let ia = 0;
  let ib = 0;
  const near = (rs: readonly StationReport[], i: number, t: number): [StationReport | null, number] => {
    while (i < rs.length && rs[i].t < t - WINDOW_MS) i++;
    let end = i;
    while (end < rs.length && rs[end].t <= t + WINDOW_MS) end++;
    return [reportNear(rs.slice(i, end), t), i];
  };
  for (let t = first; t <= last; t += MS_H) {
    let ra: StationReport | null;
    let rb: StationReport | null;
    [ra, ia] = near(a, ia, t);
    [rb, ib] = near(b, ib, t);
    if (ra?.obs == null || rb?.obs == null) continue;
    hours++;
    const ca = ra.obs.category;
    const cb = rb.obs.category;
    table[ca][cb]++;
    if (ca === cb) sameCategory++;
    const ya = isCeiling(ca);
    const yb = isCeiling(cb);
    if (ya && yb) ceiling.both++;
    else if (ya) ceiling.aOnly++;
    else if (yb) ceiling.bOnly++;
    else ceiling.neither++;
  }
  return { hours, table, sameCategory, ceiling };
}
