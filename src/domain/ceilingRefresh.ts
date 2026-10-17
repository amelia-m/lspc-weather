/**
 * The weekly refresh of the ceiling-error page's data file
 * (.github/workflows/ceiling-data-refresh.yml, docs/ceiling-heights.md,
 * "The chart"): which archive files the file is built from, which days to
 * fetch next, and whether what came back may replace what is published.
 * scripts/ceilingRefresh.ts reads the files and runs these; nothing here
 * touches the disk or the clock (`now` is passed in).
 *
 * The rules it holds:
 *
 * - The next window starts on the day of the newest record already kept,
 *   not the day after, and it is worked out from the records, not from the
 *   file names. A name says what was asked for; a fetch made mid-day holds
 *   only the hours before it, and starting after its named end would leave
 *   the rest of that day out for good. Starting on the newest record's day
 *   re-reads at most one day, and scripts/ceilingChartData.ts counts a line
 *   found in two files once, so the overlap costs a few lines and no hours.
 * - The window ends on the last whole UTC day before `now`. NOAA writes
 *   two ceiling files an hour (:16 and :46), and the fetch takes the last
 *   one in each issue hour; a fetch made between them takes the :16, and a
 *   later fetch of the same day the :46, so the day would carry two
 *   issuances for one hour. Fetching whole days only, each day is read once
 *   in its final form, and the day re-read in the overlap gives the same
 *   lines again.
 * - A run never builds a file from less than the published one holds
 *   (`shrinkage`): every source it named, every report, every issuance and
 *   every row's hours must still be there. Adding reports or forecasts only
 *   adds hours (an hour counts when both sides have it), so a fall means a
 *   file went missing or a fetch came back short, and the run stops.
 */

/** A date-stamped archive file, as cloudCoverFetch.py's callers name them:
 *  `<kind>-YYYY-MM-DD-to-YYYY-MM-DD.jsonl.gz`. */
const DATED = /^(ceiling|cloud-cover|metar)-\d{4}-\d\d-\d\d-to-\d{4}-\d\d-\d\d\.jsonl\.gz$/;

/**
 * The files under data/parity/ the chart's data file is built from, in name
 * order: every ceiling archive for `--ceiling`, and for `--cover` every
 * drop-zone cloud-cover archive and METAR fetch. Left out by the pattern:
 * `cloud-cover-stations-*` (the station comparison's, 5.5 MB, whose METARs
 * carry a `site` the chart skips), `ceiling-same-hours-*.md` and anything
 * else not named for a window.
 */
export function chartInputs(names: string[]): { ceiling: string[]; cover: string[] } {
  const dated = names.filter((n) => DATED.test(n)).sort();
  return {
    ceiling: dated.filter((n) => n.startsWith('ceiling-')),
    cover: dated.filter((n) => !n.startsWith('ceiling-')),
  };
}

/** The newest of a set of ISO times, compared as instants; null for none. */
export function newest(times: Iterable<string>): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const t of times) {
    const ms = Date.parse(t);
    if (Number.isNaN(ms)) throw new Error(`not a time: ${t}`);
    if (ms > bestMs) {
      best = t;
      bestMs = ms;
    }
  }
  return best;
}

/** The UTC calendar day of an ISO time, YYYY-MM-DD. */
const utcDay = (t: string | Date): string => new Date(t).toISOString().slice(0, 10);

export interface FetchWindow {
  /** First and last day to fetch, YYYY-MM-DD, both included (the fetch
   *  script's own arguments). */
  start: string;
  end: string;
}

export interface RefreshWindow {
  /** The last whole UTC day before `now`. */
  end: string;
  /** Null when that part already holds a record on or after `end`. */
  ceiling: FetchWindow | null;
  metar: FetchWindow | null;
}

/**
 * The days to fetch for each part, from the newest NDFD issuance and the
 * newest KPMV report already kept. A part whose newest record falls on
 * `end` or later is left alone this run: if that day was fetched only in
 * part, the next run starts on it again, so nothing is skipped for good.
 * With no records at all the archive is missing, and the refresh refuses
 * rather than fetch from an invented start.
 */
export function refreshWindow(input: { lastIssued: string | null; lastReport: string | null; now: Date }): RefreshWindow {
  const { lastIssued, lastReport, now } = input;
  if (lastIssued == null) throw new Error('no NDFD ceiling records found: the archive under data/parity/ is missing');
  if (lastReport == null) throw new Error('no KPMV reports found: the archive under data/parity/ is missing');
  const end = utcDay(new Date(Date.parse(utcDay(now)) - 86_400_000));
  const part = (last: string): FetchWindow | null => (utcDay(last) >= end ? null : { start: utcDay(last), end });
  return { end, ceiling: part(lastIssued), metar: part(lastReport) };
}

/**
 * How many of a fetch's records are newer than the newest already kept,
 * and the days of the window with none at all. The run fails on no newer
 * records: a whole day the archive did not have was asked for, so an empty
 * answer is a source that failed, not a quiet week. A day with none is
 * only reported: the next window starts after it, so failing on it would
 * stop every later run on a gap no rerun can fill.
 */
export function fetchCoverage(times: string[], since: string, window: FetchWindow): { newer: number; emptyDays: string[] } {
  const sinceMs = Date.parse(since);
  const newer = times.filter((t) => Date.parse(t) > sinceMs).length;
  const seen = new Set(times.map(utcDay));
  const emptyDays: string[] = [];
  for (let d = Date.parse(window.start); d <= Date.parse(window.end); d += 86_400_000) {
    const day = utcDay(new Date(d));
    if (!seen.has(day)) emptyDays.push(day);
  }
  return { newer, emptyDays };
}

/** The parts of the chart's data file (scripts/ceilingChartData.ts) the
 *  comparison reads. */
interface ChartRow {
  label: string;
  hours: number;
}
export interface ChartData {
  version: number;
  sources: { ceiling: string[]; cover: string[]; kept: number };
  reports: { count: number; span: { from: string; to: string } | null };
  points: { site: string; issuances: { count: number }; rows: ChartRow[] }[];
  chances: { elements: { key: string; rows: ChartRow[] }[] } | null;
}

/**
 * Every way `next` holds less than `published`: an empty list means it may
 * replace it. Hours are compared row by row, since a row could lose hours
 * while another gains them.
 */
export function shrinkage(published: ChartData, next: ChartData): string[] {
  const out: string[] = [];
  if (next.version !== published.version) out.push(`version ${next.version}, published ${published.version}`);
  for (const kind of ['ceiling', 'cover'] as const) {
    for (const f of published.sources[kind]) {
      if (!next.sources[kind].includes(f)) out.push(`source ${f} (--${kind}) is no longer read`);
    }
  }
  if (next.sources.kept < published.sources.kept) {
    out.push(`kept snapshots ${next.sources.kept}, published ${published.sources.kept}`);
  }
  if (next.reports.count < published.reports.count) {
    out.push(`KPMV reports ${next.reports.count}, published ${published.reports.count}`);
  }
  const pTo = published.reports.span?.to;
  const nTo = next.reports.span?.to;
  if (pTo != null && (nTo == null || Date.parse(nTo) < Date.parse(pTo))) {
    out.push(`reports end ${nTo ?? 'nowhere'}, published ${pTo}`);
  }
  const rows = (where: string, before: ChartRow[], after: ChartRow[] | undefined) => {
    for (const r of before) {
      const now = after?.find((a) => a.label === r.label);
      if (now == null) out.push(`${where}: row "${r.label}" is gone`);
      else if (now.hours < r.hours) out.push(`${where}: row "${r.label}" ${now.hours} h, published ${r.hours}`);
    }
  };
  for (const p of published.points) {
    const n = next.points.find((q) => q.site === p.site);
    if (n == null) {
      out.push(`point ${p.site} is gone`);
      continue;
    }
    if (n.issuances.count < p.issuances.count) {
      out.push(`point ${p.site}: ${n.issuances.count} issuances, published ${p.issuances.count}`);
    }
    rows(`point ${p.site}`, p.rows, n.rows);
  }
  for (const e of published.chances?.elements ?? []) {
    rows(`chances ${e.key}`, e.rows, next.chances?.elements.find((x) => x.key === e.key)?.rows);
  }
  return out;
}
