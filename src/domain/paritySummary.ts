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
  aligned?: { rows: { ft: number; dDir: number; dSpd: number; dT: number | null }[] } | null;
  /** What a jumper comparing both pages at that minute would see. */
  unaligned?: { hoursDiffer: boolean; maxDir: number | null };
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
  };
  usairnet: {
    runs: number;
    unreadable: number;
    sameReport: number;
    /** `spread` is null for text fields and when no run recorded a gap. */
    fields: { name: string; n: number; agree: number; spread: Spread | null }[];
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
  const fieldMap = new Map<string, { n: number; agree: number; deltas: number[] }>();
  for (const r of usairReadable) {
    for (const f of r.fields!) {
      const c = fieldMap.get(f.name) ?? { n: 0, agree: 0, deltas: [] };
      c.n += 1;
      if (f.same) c.agree += 1;
      if (typeof f.delta === 'number' && Number.isFinite(f.delta)) c.deltas.push(f.delta);
      fieldMap.set(f.name, c);
    }
  }

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
    },
    usairnet: {
      runs: usair.length,
      unreadable: usair.length - usairReadable.length,
      sameReport: usairReadable.filter((r) => r.sameReport).length,
      fields: [...fieldMap.entries()].map(([name, c]) => ({ name, n: c.n, agree: c.agree, spread: spreadOf(c.deltas) })),
    },
  };
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
