/**
 * "How different from other sources": the summary behind the #parity page.
 *
 * The live comparison scripts (scripts/schulzeCompare.live.ts and
 * scripts/usairnetCompare.live.ts) print one `@@parity {json}` line per run
 * beside their human-readable tables. The parity-summary workflow gathers
 * those lines from every recent run and feeds them here; this file turns them
 * into the figures the page shows. Pure: records in, summary out, `now`
 * passed in.
 *
 * What it must not do: grade. A row that says the two winds tables are 12°
 * apart at 9,000 ft one run in ten is a fact about the sources; whether that
 * matters is the reader's call, so nothing here labels a figure good or bad.
 * Medians and 90th percentiles are used rather than means because a single
 * stale-forecast run (docs/open-questions.md, "Which forecast run…") is
 * exactly the kind of outlier a mean would smear across every row.
 */
import { SITE } from '../config/site';

/** One run of the Schulze comparison. `aligned` is null when no Schulze table
 *  matched the app's hour; `error` set means nothing was compared. */
export interface SchulzeRecord {
  kind: 'schulze';
  /** ISO time the run started. */
  at: string;
  error?: string;
  /** The hour the app showed, "02Z"; the hour Schulze's page showed at that
   *  minute (his offset 0), "01Z". */
  appHour?: string;
  pageHour?: string;
  /** The app's valid time minus the hour in progress, in hours: 0 before
   *  half past, 1 after. Absent on runs logged before 2026-09-26. */
  gapHours?: number;
  /** Minute past the hour the run sampled at, UTC. */
  minute?: number;
  aligned?: { rows: { ft: number; dDir: number; dSpd: number; dT: number | null }[] } | null;
  /** What a jumper comparing both pages at that minute would see. `rows`
   *  (every height, when the hours differed) was added on 2026-09-26; older
   *  runs carry only the worst row's direction. */
  unaligned?: {
    hoursDiffer: boolean;
    maxDir: number | null;
    rows?: { ft: number; dDir: number; dSpd: number }[];
  };
  /** Whether the two raw profiles disagree at a shared level — the stale-run
   *  signal. null when it could not be judged. */
  rawMismatch?: boolean | null;
  /** The two ground rows: ours (Open-Meteo 10 m) in kt and km/h, his `groundSpd`. */
  ground?: { ourKt: number | null; theirKt: number | null };
}

/** One run of the usairnet comparison. */
export interface UsairnetRecord {
  kind: 'usairnet';
  at: string;
  error?: string;
  /** Whether both sides showed the same observation time. */
  sameReport?: boolean;
  /** Both observation times (ISO), the dashboard's minus usairnet's in
   *  minutes (positive: the dashboard had the newer report), and the newest
   *  report in NWS's own list at that moment. Logged from 2026-09-27. */
  ourObsAt?: string;
  theirObsAt?: string | null;
  obsGapMin?: number | null;
  nwsNewestAt?: string | null;
  /** Which feed the dashboard's report came from, and when each feed's
   *  report was taken. Logged from 2026-09-29, when the dashboard began
   *  reading IEM first; absent before, when NWS was the only feed. */
  ourSource?: 'iem' | 'nws';
  iemObsAt?: string | null;
  nwsObsAt?: string | null;
  /** The comparison's version: 2 from 2026-09-30, 3 from 2026-10-03;
   *  absent before. See FIELD_SINCE_VERSION. */
  v?: number;
  /** usairnet's page text near the station, kept when the page did not
   *  parse (from 2026-10-03). */
  pageText?: string;
  /** When NOAA's raw METAR file had its latest report taken, a reference
   *  clock (from 2026-09-30). */
  rawFileObsAt?: string | null;
  /** usairnet's wind line as printed, for reading a row that did not parse. */
  theirWind?: string | null;
  /** `delta` is dashboard minus usairnet where both sides were numbers
   *  (signed angular difference for wind direction); absent for text fields
   *  and for runs logged before it was recorded. */
  fields?: { name: string; same: boolean; delta?: number | null }[];
}

export type ParityRecord = SchulzeRecord | UsairnetRecord;

/** How far apart a set of paired values were: absolute gaps summarised
 *  every way a reader might ask for them, plus the signed mean, which says
 *  which side ran higher. */
export interface Spread {
  n: number;
  meanAbs: number;
  medianAbs: number;
  p90Abs: number;
  minAbs: number;
  maxAbs: number;
  /** Signed mean (dashboard minus the other source); the sign is the point. */
  mean: number;
}

export interface AltitudeSpread {
  ft: number;
  n: number;
  dir: Spread;
  spd: Spread;
}

/** One way the two winds tables can differ in the time they represent. */
export type TimeGapKey = 'same-hour-same-run' | 'same-hour-different-run' | 'one-hour-apart';

/**
 * The winds-aloft differences grouped by how far apart in time the two
 * tables were, pooled over every height from 1,000 ft up. The surface row is
 * left out: it differs for a reason of its own (the ground-row line on the
 * page, and docs/markschulze-altitude-reference.md), which would blur the
 * time effect this is meant to show.
 */
export interface TimeGapGroup {
  key: TimeGapKey;
  /** Runs that contributed rows. */
  runs: number;
  dir: Spread | null;
  spd: Spread | null;
}

/** `spread` is null for text fields and when no run recorded a gap. */
export interface UsairnetField {
  name: string;
  n: number;
  agree: number;
  spread: Spread | null;
}

/** When the two sides showed different observations, which was behind. */
export interface UsairnetTiming {
  /** Runs with different observation times. */
  mismatched: number;
  /** Of those, runs that logged both times (from 2026-09-27). */
  timed: number;
  dashboardNewer: number;
  usairnetNewer: number;
  /** Dashboard minus usairnet, minutes, over the timed mismatches. */
  gapMin: Spread | null;
  /** Timed runs where the dashboard was behind, split by whether NWS's own
   *  observation list already held the newer report (so its `latest`
   *  endpoint had not caught up) or did not (so NWS had not received it). */
  dashboardBehindNwsListHadIt: number;
  dashboardBehindNwsListLacked: number;
}

/** Minutes from a report's own time to the first sample that found it at
 *  one source, over every report timed there. */
export interface ArrivalLag {
  source: ArrivalSource;
  /** Reports timed: the sample before the first to find it had not, and was
   *  at most MAX_ARRIVAL_BRACKET_MIN earlier. */
  reports: number;
  lagMin: Spread | null;
}

export type ArrivalSource = 'rawFile' | 'iem' | 'usairnet' | 'nwsList' | 'nwsLatest';

/** The two ground rows over the runs whose forecast hour fell in one
 *  three-hour block of the drop zone's local day. */
export interface GroundBand {
  /** First local hour of the block: 0, 3, … 21. */
  fromHour: number;
  runs: number;
  medianOurKt: number | null;
  medianTheirKt: number | null;
  /** Median of Schulze's minus this dashboard's, per run. */
  medianGapKt: number | null;
}

/** Runs where one side could not be read, and the longest unbroken run of
 *  usairnet failures. */
export interface UsairnetOutages {
  /** usairnet's page could not be fetched or did not parse. */
  theirs: number;
  /** Neither of the dashboard's feeds could be read. */
  ours: number;
  /** Unbroken stretches of usairnet failures: consecutive samples, each
   *  within MAX_ARRIVAL_BRACKET_MIN of the last. */
  stretches: number;
  longest: { from: string; to: string; samples: number } | null;
}

export interface ParitySummary {
  generatedAt: string;
  /** Earliest and latest run times summarised, ISO; null with no records. */
  from: string | null;
  to: string | null;
  schulze: {
    runs: number;
    unreadable: number;
    /** Runs where a same-hour Schulze table existed. */
    aligned: number;
    byAltitude: AltitudeSpread[];
    /** Runs whose worst row was 10° or 3 kt off — the size of difference a
     *  reader would notice on the card. Counts, not verdicts. */
    runsWithRowOver10Deg: number;
    runsWithRowOver3Kt: number;
    unaligned: {
      runs: number;
      hoursDiffered: number;
      medianMaxDirWhenDiffer: number | null;
      p90MaxDirWhenDiffer: number | null;
    };
    rawMismatch: { judged: number; mismatched: number };
    ground: { n: number; medianOurKt: number | null; medianTheirKt: number | null; medianRatio: number | null };
    /** The ground rows by local time of the forecast hour. Absent before
     *  2026-10-03. */
    groundByLocalHour?: GroundBand[];
    /** Absent in summaries written before 2026-09-26. */
    byTimeGap?: TimeGapGroup[];
  };
  usairnet: {
    runs: number;
    unreadable: number;
    sameReport: number;
    /** Every run pooled. Only in summaries written before 2026-09-27; it
     *  mixed runs comparing one report with runs comparing two. */
    fields?: UsairnetField[];
    /** Runs where both sides showed the same observation: a decode
     *  comparison. */
    fieldsSameReport?: UsairnetField[];
    /** Runs where they showed different observations: mostly the weather
     *  changing between two reports, kept apart so it cannot blur the first. */
    fieldsDifferentReport?: UsairnetField[];
    /** Which side had the newer report when the two differed, over the
     *  runs from before the dashboard read IEM (NWS its only feed). */
    timing?: UsairnetTiming;
    /** The same over the runs since, kept apart because the change was
     *  made to move exactly these numbers. Absent before 2026-09-29. */
    timingSinceIem?: UsairnetTiming;
    /** Of the readable runs since then, which feed served the dashboard. */
    feeds?: { iem: number; nws: number };
    /** How long after each report each source first had it (see
     *  arrivalLags). Absent before 2026-09-30. */
    arrival?: ArrivalLag[];
    /** Absent before 2026-10-03. */
    outages?: UsairnetOutages;
  };
}

export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Nearest-rank percentile: the value at or above which `p` of the sample
 *  sits. With few runs this is a real observed value, never an interpolation
 *  between two. */
export function percentile(xs: readonly number[], p: number): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const rank = Math.min(s.length, Math.max(1, Math.ceil(p * s.length)));
  return s[rank - 1];
}

const round1 = (n: number | null): number | null => (n == null ? null : Math.round(n * 10) / 10);
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** The spread of a set of signed gaps; null with none. Rounded to two
 *  places so the JSON does not carry floating-point noise. */
export function spreadOf(deltas: readonly number[]): Spread | null {
  if (deltas.length === 0) return null;
  const abs = deltas.map((d) => Math.abs(d));
  const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
  return {
    n: deltas.length,
    meanAbs: round2(sum(abs) / abs.length),
    medianAbs: round2(median(abs) as number),
    p90Abs: round2(percentile(abs, 0.9) as number),
    minAbs: round2(Math.min(...abs)),
    maxAbs: round2(Math.max(...abs)),
    mean: round2(sum(deltas) / deltas.length),
  };
}

/**
 * Group the runs by the time the two tables represented:
 *
 *   same hour, same forecast run      the aligned rows of a run whose raw
 *                                     profiles agreed; what is left is the
 *                                     two tools' own arithmetic
 *   same hour, different forecast run the aligned rows of a run whose raw
 *                                     profiles disagreed; one side had been
 *                                     served a newer model run
 *   one hour apart                    the rows as the two pages showed them
 *                                     at that minute, when the card had
 *                                     snapped to the next hour and his page
 *                                     still showed the hour in progress
 *
 * A same-hour run whose raw profiles could not be judged is in neither of
 * the first two. The third fills only from runs logged since the rows were
 * recorded (2026-09-26); older runs kept only the worst row, which the
 * `unaligned` counts still report.
 */
export function timeGapGroups(records: readonly SchulzeRecord[]): TimeGapGroup[] {
  const aloft = (rows: readonly { ft: number; dDir: number; dSpd: number }[]) => rows.filter((r) => r.ft > 0);
  const group = (key: TimeGapKey, rowSets: { ft: number; dDir: number; dSpd: number }[][]): TimeGapGroup => {
    const rows = rowSets.flatMap(aloft);
    return {
      key,
      runs: rowSets.filter((set) => aloft(set).length > 0).length,
      dir: spreadOf(rows.map((r) => r.dDir)),
      spd: spreadOf(rows.map((r) => r.dSpd)),
    };
  };
  const aligned = records.filter((r) => !r.error && r.aligned != null);
  return [
    group(
      'same-hour-same-run',
      aligned.filter((r) => r.rawMismatch === false).map((r) => r.aligned!.rows),
    ),
    group(
      'same-hour-different-run',
      aligned.filter((r) => r.rawMismatch === true).map((r) => r.aligned!.rows),
    ),
    group(
      'one-hour-apart',
      records
        .filter((r) => !r.error && r.unaligned?.hoursDiffer && r.unaligned.rows != null)
        .map((r) => r.unaligned!.rows!),
    ),
  ];
}

export function summarizeParity(records: readonly ParityRecord[], now: number): ParitySummary {
  const times = records.map((r) => Date.parse(r.at)).filter((t) => Number.isFinite(t));
  const from = times.length ? new Date(Math.min(...times)).toISOString() : null;
  const to = times.length ? new Date(Math.max(...times)).toISOString() : null;

  const schulze = records.filter((r): r is SchulzeRecord => r.kind === 'schulze');
  const readable = schulze.filter((r) => !r.error);
  const aligned = readable.filter((r) => r.aligned != null);

  const byFt = new Map<number, { dir: number[]; spd: number[] }>();
  let over10 = 0;
  let over3 = 0;
  for (const r of aligned) {
    let worstDir = 0;
    let worstSpd = 0;
    for (const row of r.aligned!.rows) {
      const cell = byFt.get(row.ft) ?? { dir: [], spd: [] };
      cell.dir.push(row.dDir);
      cell.spd.push(row.dSpd);
      byFt.set(row.ft, cell);
      worstDir = Math.max(worstDir, Math.abs(row.dDir));
      worstSpd = Math.max(worstSpd, Math.abs(row.dSpd));
    }
    if (worstDir > 10) over10 += 1;
    if (worstSpd > 3) over3 += 1;
  }
  const byAltitude: AltitudeSpread[] = [...byFt.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ft, c]) => ({
      ft,
      n: c.dir.length,
      dir: spreadOf(c.dir) as Spread,
      spd: spreadOf(c.spd) as Spread,
    }));

  const unalignedRuns = readable.filter((r) => r.unaligned != null);
  const differed = unalignedRuns.filter((r) => r.unaligned!.hoursDiffer);
  const differMax = differed.map((r) => r.unaligned!.maxDir).filter((x): x is number => x != null);

  const judged = readable.filter((r) => r.rawMismatch != null);
  const ground = readable.filter((r) => r.ground?.ourKt != null && r.ground.theirKt != null);
  const ratios = ground
    .filter((r) => (r.ground!.ourKt as number) > 0)
    .map((r) => (r.ground!.theirKt as number) / (r.ground!.ourKt as number));

  const usair = records.filter((r): r is UsairnetRecord => r.kind === 'usairnet');
  const usairReadable = usair.filter((r) => !r.error && r.fields != null);
  const sameRuns = usairReadable.filter((r) => r.sameReport === true);
  const diffRuns = usairReadable.filter((r) => r.sameReport === false);

  return {
    generatedAt: new Date(now).toISOString(),
    from,
    to,
    schulze: {
      runs: schulze.length,
      unreadable: schulze.length - readable.length,
      aligned: aligned.length,
      byAltitude,
      runsWithRowOver10Deg: over10,
      runsWithRowOver3Kt: over3,
      unaligned: {
        runs: unalignedRuns.length,
        hoursDiffered: differed.length,
        medianMaxDirWhenDiffer: median(differMax),
        p90MaxDirWhenDiffer: percentile(differMax, 0.9),
      },
      rawMismatch: { judged: judged.length, mismatched: judged.filter((r) => r.rawMismatch).length },
      ground: {
        n: ground.length,
        medianOurKt: round1(median(ground.map((r) => r.ground!.ourKt as number))),
        medianTheirKt: round1(median(ground.map((r) => r.ground!.theirKt as number))),
        medianRatio: ratios.length ? Math.round((median(ratios) as number) * 100) / 100 : null,
      },
      groundByLocalHour: groundByLocalHour(ground),
      byTimeGap: timeGapGroups(schulze),
    },
    usairnet: {
      runs: usair.length,
      unreadable: usair.length - usairReadable.length,
      sameReport: sameRuns.length,
      fieldsSameReport: fieldTable(sameRuns),
      fieldsDifferentReport: fieldTable(diffRuns),
      timing: timingOf(diffRuns.filter((r) => r.ourSource == null)),
      timingSinceIem: timingOf(diffRuns.filter((r) => r.ourSource != null)),
      feeds: {
        iem: usairReadable.filter((r) => r.ourSource === 'iem').length,
        nws: usairReadable.filter((r) => r.ourSource === 'nws').length,
      },
      arrival: arrivalLags(usair),
      outages: outagesOf(usair),
    },
  };
}

/** The forecast hour a Schulze run compared, as an instant: `appHour`
 *  ("02Z") on the UTC day that puts it nearest the run's own time, since the
 *  card shows the hour nearest the clock. The run's time when the hour was
 *  not logged. */
export function validHourOf(r: SchulzeRecord): number {
  const at = Date.parse(r.at);
  const hh = r.appHour ? Number.parseInt(r.appHour, 10) : Number.NaN;
  if (!Number.isFinite(hh)) return at;
  const day = Math.floor(at / DAY_MS) * DAY_MS;
  const candidates = [day - DAY_MS, day, day + DAY_MS].map((d) => d + hh * 3_600_000);
  return candidates.reduce((best, c) => (Math.abs(c - at) < Math.abs(best - at) ? c : best));
}

const DAY_MS = 86_400_000;

const localHour = (ms: number): number =>
  Number(
    new Intl.DateTimeFormat('en-US', { timeZone: SITE.timeZone, hour: 'numeric', hourCycle: 'h23' }).format(
      new Date(ms),
    ),
  );

/**
 * The two ground rows by the local time of the hour they forecast, in
 * three-hour blocks. The two rows are different heights (this dashboard's
 * the model's 10 m wind, Schulze's a line through the pressure levels read
 * at 0 ft, docs/markschulze-altitude-reference.md), and the gap between a
 * 10 m wind and the wind a couple of hundred feet up is a matter of the time
 * of day: it opens at night, when the air at the ground goes calm under a
 * moving layer above. The Winds aloft card says so; this is the count that
 * shows whether the logs bear it out.
 */
export function groundByLocalHour(records: readonly SchulzeRecord[]): GroundBand[] {
  const bands = Array.from({ length: 8 }, () => ({ ours: [] as number[], theirs: [] as number[], gaps: [] as number[] }));
  for (const r of records) {
    const ours = r.ground?.ourKt;
    const theirs = r.ground?.theirKt;
    if (ours == null || theirs == null) continue;
    const t = validHourOf(r);
    if (!Number.isFinite(t)) continue;
    const band = bands[Math.floor(localHour(t) / 3)];
    band.ours.push(ours);
    band.theirs.push(theirs);
    band.gaps.push(theirs - ours);
  }
  return bands.map((b, i) => ({
    fromHour: i * 3,
    runs: b.ours.length,
    medianOurKt: round1(median(b.ours)),
    medianTheirKt: round1(median(b.theirs)),
    medianGapKt: round1(median(b.gaps)),
  }));
}

/**
 * How often each side could not be read, and the longest stretch usairnet's
 * page stayed unreadable. On 2026-09-30 it failed for 2 h 18 min, which a
 * bare count of unreadable runs does not show: an afternoon of failures in a
 * row and the same number scattered over a week are different things to a
 * reader deciding how far to lean on the page.
 */
export function outagesOf(records: readonly UsairnetRecord[]): UsairnetOutages {
  const theirSide = (r: UsairnetRecord): boolean => r.error?.startsWith('usairnet:') ?? false;
  const samples = records
    .map((r) => ({ r, at: Date.parse(r.at) }))
    .filter((x) => Number.isFinite(x.at))
    .sort((a, b) => a.at - b.at);
  const stretches: { from: number; to: number; samples: number }[] = [];
  let open: { from: number; to: number; samples: number } | null = null;
  let lastAt = Number.NEGATIVE_INFINITY;
  for (const { r, at } of samples) {
    const joined = at - lastAt <= MAX_ARRIVAL_BRACKET_MIN * 60_000;
    lastAt = at;
    if (!theirSide(r)) {
      open = null;
      continue;
    }
    if (open && joined) {
      open.to = at;
      open.samples += 1;
    } else {
      open = { from: at, to: at, samples: 1 };
      stretches.push(open);
    }
  }
  const longest = stretches.reduce<(typeof stretches)[number] | null>(
    (best, x) => (best == null || x.to - x.from > best.to - best.from ? x : best),
    null,
  );
  return {
    theirs: records.filter(theirSide).length,
    ours: records.filter((r) => r.error != null && !theirSide(r)).length,
    stretches: stretches.length,
    longest: longest && {
      from: new Date(longest.from).toISOString(),
      to: new Date(longest.to).toISOString(),
      samples: longest.samples,
    },
  };
}

/** Which side was behind, over runs whose two observation times differed. */
function timingOf(diffRuns: readonly UsairnetRecord[]): UsairnetTiming {
  const timed = diffRuns.filter((r) => typeof r.obsGapMin === 'number');
  const behind = timed.filter((r) => (r.obsGapMin as number) < 0);
  const listHadIt = (r: UsairnetRecord): boolean =>
    r.nwsNewestAt != null && r.ourObsAt != null && Date.parse(r.nwsNewestAt) > Date.parse(r.ourObsAt);
  return {
    mismatched: diffRuns.length,
    timed: timed.length,
    dashboardNewer: timed.filter((r) => (r.obsGapMin as number) > 0).length,
    usairnetNewer: behind.length,
    gapMin: spreadOf(timed.map((r) => r.obsGapMin as number)),
    dashboardBehindNwsListHadIt: behind.filter(listHadIt).length,
    dashboardBehindNwsListLacked: behind.filter((r) => r.nwsNewestAt != null && !listHadIt(r)).length,
  };
}

/** Each source's report time in a record. NWS's `latest` is the dashboard's
 *  own report in records from before IEM (no `ourSource`), and `nwsObsAt`
 *  since. */
const ARRIVAL_TIME: Record<ArrivalSource, (r: UsairnetRecord) => string | null | undefined> = {
  rawFile: (r) => r.rawFileObsAt,
  iem: (r) => r.iemObsAt,
  usairnet: (r) => r.theirObsAt,
  nwsList: (r) => r.nwsNewestAt,
  nwsLatest: (r) => (r.ourSource != null ? r.nwsObsAt : r.ourObsAt),
};

/** A report is timed at a source only when the sample before the first one
 *  to find it is this close: the true arrival lies between the two, so the
 *  gap is the timing's uncertainty. The sampler runs every 2 minutes; the
 *  hour between its batches, and the day between daily runs, time nothing. */
export const MAX_ARRIVAL_BRACKET_MIN = 5;

/**
 * For each source, how many minutes after a report was taken the first
 * sample found that report (or a newer one) there. The minutes are to that
 * first sample, so each is at most one sampling interval late, never early.
 *
 * Why: the dashboard reads IEM first because IEM had KPMV's reports within
 * minutes (a 20-second trace of three cycles on 2026-09-27). This counts the
 * same thing across every sampled cycle, beside usairnet and both NWS
 * endpoints, with NOAA's raw file as the quickest reference.
 */
export function arrivalLags(records: readonly UsairnetRecord[]): ArrivalLag[] {
  const samples = records
    .filter((r) => !r.error && typeof r.at === 'string')
    .map((r) => ({ r, at: Date.parse(r.at) }))
    .filter((x) => Number.isFinite(x.at))
    .sort((a, b) => a.at - b.at);
  return (Object.keys(ARRIVAL_TIME) as ArrivalSource[]).map((source) => {
    const seen = samples
      .map(({ r, at }) => {
        const t = ARRIVAL_TIME[source](r);
        return { at, obs: t ? Date.parse(t) : NaN };
      })
      .filter((x) => Number.isFinite(x.obs));
    const lags: number[] = [];
    for (let i = 1; i < seen.length; i++) {
      const prev = seen[i - 1];
      const cur = seen[i];
      // A new report appeared between these two samples.
      if (cur.obs <= prev.obs) continue;
      if (cur.at - prev.at > MAX_ARRIVAL_BRACKET_MIN * 60_000) continue;
      lags.push(Math.round((cur.at - cur.obs) / 60_000));
    }
    return { source, reports: lags.length, lagMin: spreadOf(lags) };
  });
}

/** Rows whose comparison was wrong in older records, and the record version
 *  from which each counts; older records are kept but skip these rows.
 *
 *  Version 2 (2026-09-30): usairnet's page was misread for a heading
 *  carrying present weather (no temperature) and every overcast layer
 *  ("Solid Overcast"), for gusting winds (no direction), and a calm wind
 *  read as 0° against usairnet's none.
 *
 *  Version 3 (2026-10-03): fractional visibility ("1 1/4 Miles") read as
 *  none (25 same-report runs), a north wind's 360° compared as text against
 *  the page's "0° North" (48), and the app's own sunrise and sunset, which
 *  ran up to 2 to 3 minutes late until it moved to NOAA's method. */
export const FIELD_SINCE_VERSION: Readonly<Record<string, number>> = {
  'temperature °F': 2,
  clouds: 2,
  'wind dir °': 3,
  'visibility mi': 3,
  'sunrise (min past midnight)': 3,
  'sunset (min past midnight)': 3,
};

/** Per field: runs, agreements and the spread of the numeric gaps. */
function fieldTable(runs: readonly UsairnetRecord[]): UsairnetField[] {
  const fieldMap = new Map<string, { n: number; agree: number; deltas: number[] }>();
  for (const r of runs) {
    for (const f of r.fields ?? []) {
      if ((r.v ?? 1) < (FIELD_SINCE_VERSION[f.name] ?? 1)) continue;
      const c = fieldMap.get(f.name) ?? { n: 0, agree: 0, deltas: [] };
      c.n += 1;
      if (f.same) c.agree += 1;
      if (typeof f.delta === 'number' && Number.isFinite(f.delta)) c.deltas.push(f.delta);
      fieldMap.set(f.name, c);
    }
  }
  return [...fieldMap.entries()].map(([name, c]) => ({ name, n: c.n, agree: c.agree, spread: spreadOf(c.deltas) }));
}

/** Parse the `@@parity` lines out of a log, ignoring everything else. A line
 *  that is not valid JSON is skipped rather than failing the summary: one bad
 *  run must not blank the page. */
export function parseParityLines(text: string): ParityRecord[] {
  const out: ParityRecord[] = [];
  for (const line of text.split('\n')) {
    const i = line.indexOf('@@parity ');
    if (i < 0) continue;
    try {
      const obj = JSON.parse(line.slice(i + '@@parity '.length)) as ParityRecord;
      if ((obj.kind === 'schulze' || obj.kind === 'usairnet') && typeof obj.at === 'string') out.push(obj);
    } catch {
      // not ours, or truncated: skip
    }
  }
  return out;
}
