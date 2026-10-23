/**
 * Telling apart the two explanations for the winds-aloft table and Mark
 * Schulze's sometimes being on different forecast runs for the same hour
 * (docs/open-questions.md, "Which forecast run the winds-aloft request is
 * served"; docs/run-split.md).
 *
 * The comparison saw it 2.5% of the time when it read his hour in progress
 * and 11.4% when it read his next hour. But it reads his next hour only
 * after half past, because the Winds aloft card snaps to the nearest hour,
 * so "his next-hour request" and "the second half of the hour" always came
 * together, and the logs could not say which mattered. The candidates:
 * something about the tool's next-hour request (its own caching, say), or a
 * new run reaching Open-Meteo's servers at different moments, which happens
 * at a time of the clock rather than with a request.
 *
 * The sampler (scripts/runSplit.live.ts) breaks the link: every few minutes,
 * whatever the minute, it asks the tool for both hours, and sets each against
 * this app's own Open-Meteo answer for the same valid hour. It also makes a
 * second app request a moment after the first. If the two app requests
 * disagree with each other, the servers answered with different runs moments
 * apart, which no request of the tool's could cause.
 *
 * Pure: the sampler fetches, this compares and counts.
 */
import type { RawWindSample } from './windsAloft';
import { RUN_AGE_BANDS, type RunsSeen } from './runAge';

/** A raw profile as heights above the drop zone with direction and speed. */
export interface RawLevel {
  ftAgl: number;
  dir: number;
  spd: number;
}

/** Two raw profiles set against each other at shared heights. */
export interface RawGap {
  /** Heights paired (within PAIR_WITHIN_FT). */
  pairs: number;
  /** Pairs more than MISMATCH_DIR_DEG or MISMATCH_SPD_KT apart. */
  bad: number;
  maxDir: number;
  maxSpd: number;
  /** "Different runs" by the comparison's long-standing rule: at least
   *  MIN_PAIRS pairs, and MIN_BAD of them apart. Null when too few pairs. */
  mismatch: boolean | null;
}

/** The comparison's rule since 2026-09-23, kept exactly so the sampler's
 *  counts read beside the comparison's: raw levels paired within 150 ft,
 *  "apart" at more than 5° or 2 kt, a mismatch at two such pairs of at least
 *  three. On the same run the two sides agreed to a median 0° and 0 kt
 *  (docs/source-parity.md), so the margins only absorb rounding. It is a
 *  heuristic, not a run identifier: Open-Meteo's responses name no run. */
export const PAIR_WITHIN_FT = 150;
export const MISMATCH_DIR_DEG = 5;
export const MISMATCH_SPD_KT = 2;
const MIN_PAIRS = 3;
const MIN_BAD = 2;
/** Only heights both tools sample alike: his raw levels stop at his table's
 *  top, and above it nothing of the card's is read. */
const TOP_FT_AGL = 14_000;

const angle = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);

/** Each of `theirs` paired with the nearest of `ours` within PAIR_WITHIN_FT. */
export function rawGap(ours: readonly RawLevel[], theirs: readonly RawLevel[]): RawGap {
  let pairs = 0;
  let bad = 0;
  let maxDir = 0;
  let maxSpd = 0;
  for (const t of theirs) {
    if (t.ftAgl < 0 || t.ftAgl > TOP_FT_AGL) continue;
    let best: RawLevel | null = null;
    for (const o of ours) {
      const d = Math.abs(o.ftAgl - t.ftAgl);
      if (d <= PAIR_WITHIN_FT && (best == null || d < Math.abs(best.ftAgl - t.ftAgl))) best = o;
    }
    if (!best) continue;
    pairs += 1;
    const dDir = angle(best.dir, t.dir);
    const dSpd = Math.abs(best.spd - t.spd);
    maxDir = Math.max(maxDir, dDir);
    maxSpd = Math.max(maxSpd, dSpd);
    if (dDir > MISMATCH_DIR_DEG || dSpd > MISMATCH_SPD_KT) bad += 1;
  }
  return {
    pairs,
    bad,
    maxDir,
    maxSpd: Math.round(maxSpd * 10) / 10,
    mismatch: pairs >= MIN_PAIRS ? bad >= MIN_BAD : null,
  };
}

/** This app's raw pressure-level samples, as heights above the drop zone.
 *  The 10 m wind and the fixed-height winds (80/120/180 m) are left out:
 *  his raw levels are pressure levels, and a fixed-height wind near one
 *  would be a different quantity read as a mismatch. */
export function appRawLevels(samples: readonly RawWindSample[], elevFt: number): RawLevel[] {
  return samples
    .filter((x) => !x.isSurface && x.fixedHeightM == null)
    .map((x) => ({
      ftAgl: x.heightFtMsl - elevFt,
      dir: x.directionDeg,
      spd: x.speedKt,
    }));
}

/** His raw levels, as his endpoint serves them. */
export function schulzeRawLevels(his: {
  altFtRaw: readonly number[];
  directionRaw: Record<string, number>;
  speedRaw: Record<string, number>;
}): RawLevel[] {
  return his.altFtRaw
    .filter((a) => his.directionRaw[a] != null && his.speedRaw[a] != null)
    .map((a) => ({ ftAgl: a, dir: his.directionRaw[a], spd: his.speedRaw[a] }));
}

/** One sample's record (scripts/runSplit.live.ts). */
export interface RunSplitRecord {
  kind: 'runsplit';
  v: 1;
  at: string;
  /** Minute of the hour the sample started. */
  minute: number;
  /** His hour in progress (offset 0) and next hour (offset 1), each set
   *  against the app's first and second request for the same valid hour.
   *  A side that could not be read is null. */
  hours: {
    offset: 0 | 1;
    validHour: string | null;
    vsFirst: RawGap | null;
    vsSecond: RawGap | null;
  }[];
  /** The app's two requests against each other, at the two valid hours. */
  self: { offset: 0 | 1; gap: RawGap | null }[];
  /** Seconds between the app's two requests starting. */
  apartS: number | null;
  omRuns?: Record<string, RunsSeen | null>;
  errors?: string[];
}

export interface Cell {
  n: number;
  mismatched: number;
}
const cell = (): Cell => ({ n: 0, mismatched: 0 });
const add = (c: Cell, m: boolean | null): void => {
  if (m == null) return;
  c.n += 1;
  if (m) c.mismatched += 1;
};

/** The minute bands counted, ten minutes each. */
export const MINUTE_BANDS = [0, 10, 20, 30, 40, 50] as const;

export interface RunSplitSummary {
  samples: number;
  first: string | null;
  last: string | null;
  /**
   * The table that separates the two: his request (hour in progress or
   * next hour) by half of the clock hour, set against the app's first
   * request. A next-hour cause shows as offset 1 high in both halves; a
   * clock-time cause as both offsets high in the same half.
   */
  byOffsetAndHalf: { offset: 0 | 1; half: 'first' | 'second'; cell: Cell }[];
  byOffsetAndBand: { offset: 0 | 1; fromMin: number; cell: Cell }[];
  /** The app's two requests against each other, by band: different runs a
   *  moment apart, with the tool not involved. */
  selfByBand: { fromMin: number; cell: Cell }[];
  /** Where his table and the app's first request were on different runs:
   *  how many of those had his table on the same run as the app's second
   *  request, the app's first answer being the odd one out. */
  firstWasOddOneOut: { of: number; secondMatched: number };
  /** Every judged pairing (both offsets, first request) by minutes since
   *  the newest HRRR run the metadata reads saw became available. */
  byRunAge: { fromMin: number; toMin: number; cell: Cell }[];
}

const RUN_DOMAIN = 'ncep_hrrr_conus';

export function summarizeRunSplit(records: readonly RunSplitRecord[]): RunSplitSummary {
  const recs = records.filter((r) => r.kind === 'runsplit').sort((a, b) => a.at.localeCompare(b.at));
  const byOffsetAndHalf = ([0, 1] as const).flatMap((offset) =>
    (['first', 'second'] as const).map((half) => ({
      offset,
      half,
      cell: cell(),
    })),
  );
  const byOffsetAndBand = ([0, 1] as const).flatMap((offset) =>
    MINUTE_BANDS.map((fromMin) => ({ offset, fromMin, cell: cell() })),
  );
  const selfByBand = MINUTE_BANDS.map((fromMin) => ({ fromMin, cell: cell() }));
  const byRunAge = RUN_AGE_BANDS.map((b) => ({ ...b, cell: cell() }));
  const odd = { of: 0, secondMatched: 0 };
  for (const r of recs) {
    const half = r.minute < 30 ? 'first' : 'second';
    const band = MINUTE_BANDS.filter((b) => r.minute >= b).pop() ?? 0;
    const avail = r.omRuns?.[RUN_DOMAIN]?.avail;
    const ageMin = avail != null ? (Date.parse(r.at) - Date.parse(avail)) / 60_000 : NaN;
    const ageRow = Number.isFinite(ageMin) ? byRunAge.find((b) => ageMin >= b.fromMin && ageMin < b.toMin) : undefined;
    for (const h of r.hours) {
      const m = h.vsFirst?.mismatch ?? null;
      add(byOffsetAndHalf.find((c) => c.offset === h.offset && c.half === half)!.cell, m);
      add(byOffsetAndBand.find((c) => c.offset === h.offset && c.fromMin === band)!.cell, m);
      if (ageRow) add(ageRow.cell, m);
      const second = h.vsSecond?.mismatch ?? null;
      if (m === true && second != null) {
        odd.of += 1;
        if (!second) odd.secondMatched += 1;
      }
    }
    for (const s of r.self) add(selfByBand.find((c) => c.fromMin === band)!.cell, s.gap?.mismatch ?? null);
  }
  return {
    samples: recs.length,
    first: recs[0]?.at ?? null,
    last: recs.length ? recs[recs.length - 1].at : null,
    byOffsetAndHalf,
    byOffsetAndBand,
    selfByBand,
    firstWasOddOneOut: odd,
    byRunAge,
  };
}

/** The sampler's output: one `@@parity {json}` line per sample among other
 *  text; anything else is skipped. */
export function parseRunSplitLines(text: string): RunSplitRecord[] {
  const out: RunSplitRecord[] = [];
  for (const line of text.split('\n')) {
    const i = line.indexOf('@@parity ');
    if (i < 0) continue;
    try {
      const r = JSON.parse(line.slice(i + 9)) as RunSplitRecord;
      if (r.kind === 'runsplit') out.push(r);
    } catch {
      // A line cut short by a cancelled job: nothing to count.
    }
  }
  return out;
}
