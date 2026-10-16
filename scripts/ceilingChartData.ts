/**
 * Write the data file the ceiling-error chart reads (docs/ceiling-heights.md,
 * "The chart"): for each grid point and NWS issuance, the hours by each
 * side's band and the spread of forecast minus reported, grouped both ways.
 * The arithmetic is src/domain/ceilingHeights.ts, as for
 * scripts/ceilingSummary.ts; this file reads, joins and writes.
 *
 *   npx tsx scripts/ceilingChartData.ts \
 *     --ceiling data/parity/ceiling-2026-04-01-to-2026-10-09.jsonl.gz \
 *     --cover data/parity/cloud-cover-2026-04-01-to-2026-10-09.jsonl.gz \
 *     --kept <forecast-archive checkout>/data \
 *     --out data/parity/ceiling-errors.json
 *
 * More data is more files: each flag takes any number, so a later fetch
 * (scripts/cloudCoverFetch.py with PARTS=cig and SITES for both points,
 * and PARTS=metar for KPMV's reports) is added by naming it beside the
 * first. A line that appears in two files counts once.
 *
 * `--kept` (optional) takes the hourly snapshots scripts/forecastKeep.ts
 * commits to the `forecast-archive` branch, as files or folders to search:
 * the API's own `ceilingHeight` at the drop zone, as the card read it.
 * They become a third forecast source beside the two NDFD grid points,
 * never merged into them.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import {
  CEILING_BANDS,
  densityCurve,
  DIFF_BINS,
  type DiffDistribution,
  diffDistribution,
  FLIGHT_BANDS,
  keptCeilingRecords,
  parseCeilingLines,
  type CeilingForecast,
  type KeptGridpointSnapshot,
  summarizeCeilings,
} from '../src/domain/ceilingHeights';
import { parseCloudCoverLines, type MetarRecord } from '../src/domain/cloudCoverSources';

const args: Record<string, string[]> = {};
let flag = '';
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) args[(flag = a.slice(2))] = [];
  else if (flag) args[flag].push(a);
}
const [out] = args.out ?? [];
if (!args.ceiling?.length || !args.cover?.length || !out) {
  console.error('usage: ceilingChartData.ts --ceiling <files…> --cover <files…> [--kept <files or folders…>] --out <file>');
  process.exit(2);
}

const read = (f: string): string => {
  const buf = readFileSync(f);
  return (f.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8');
};

/** Every distinct line of the files, so overlapping fetches count once. */
const lines = (files: string[]): string => {
  const seen = new Set<string>();
  for (const f of files) {
    for (const line of read(f).split('\n')) if (line.trim()) seen.add(line);
  }
  return [...seen].join('\n');
};

/** The kept snapshot files under each path, in name (so time) order. */
const keptFiles = (paths: string[]): string[] => {
  const found: string[] = [];
  const walk = (p: string) => {
    if (statSync(p).isDirectory()) for (const e of readdirSync(p)) walk(join(p, e));
    else if (/\.json(\.gz)?$/.test(p)) found.push(p);
  };
  paths.forEach(walk);
  return [...new Set(found)].sort();
};

const ndfd = parseCeilingLines(lines(args.ceiling));
const forecasts: CeilingForecast[] = [...ndfd];
// The kept gridpoint is the drop zone's (the card's); site KEPT keeps it
// apart from the NDFD records read at the same point. A snapshot whose
// fetch failed gives none and is not counted.
let keptUsed = 0;
for (const f of keptFiles(args.kept ?? [])) {
  const recs = keptCeilingRecords(JSON.parse(read(f)) as KeptGridpointSnapshot, 'KEPT');
  if (recs.length) keptUsed++;
  for (const r of recs) forecasts.push(r);
}
const metars: MetarRecord[] = [];
// The drop zone's archive only (no `site`): KPMV's reports.
for (const r of parseCloudCoverLines(lines(args.cover))) {
  if (r.site == null && r.src === 'metar') metars.push(r);
}


// `short` labels the page's control; `place` is what the grid point is
// nearest, for its "km from … to the grid point read" line.
const POINTS = [
  { site: 'DZ', short: 'Drop zone', place: 'the drop zone' },
  { site: 'PMV', short: 'KPMV', place: 'KPMV' },
  { site: 'KEPT', short: 'Drop zone, as the card read it', place: 'the drop zone' },
] as const;

/** Each band's density curves for the chart's clouds: the difference in
 *  ft (kernel no narrower than 50 ft, half a report's 100 ft step), and
 *  forecast ÷ reported in log2, the scale the chart draws it on (kernel no
 *  narrower than 0.1, about a 7% step). Null where a band has too few
 *  hours for a curve (DENSITY_MIN_N). Rounded so the file stays small. */
const withDensity = (d: Record<string, DiffDistribution>) =>
  Object.fromEntries(
    Object.entries(d).map(([band, v]) => {
      const ft = densityCurve(v.values, 50);
      const ratio = densityCurve(v.ratios.filter((r) => r > 0).map(Math.log2), 0.1);
      const round = (c: [number, number][], dx: number) =>
        c.map(([x, y]) => [Math.round(x * dx) / dx, Number(y.toPrecision(4))]);
      return [band, { ...v, density: { ft: ft && round(ft.curve, 1), log2Ratio: ratio && round(ratio.curve, 1000) } }];
    }),
  );

/** An ISO time in UTC as the records write it, so "+00:00" and "Z" sort together. */
const iso = (t: string): string => new Date(t).toISOString().replace(/:\d\d\.\d{3}Z$/, 'Z');

/** First and last of a set of ISO times, without spreading the whole set
 *  into one call (an archive of a few hundred thousand overflows the stack). */
const span = (ts: string[]): { from: string; to: string } | null => {
  let from: string | null = null;
  let to: string | null = null;
  for (const t of ts) {
    if (from == null || t < from) from = t;
    if (to == null || t > to) to = t;
  }
  return from == null || to == null ? null : { from, to };
};

const points = POINTS.map(({ site, short, place }) => {
  const mine = forecasts.filter((r) => r.site === site);
  const rows = summarizeCeilings(mine, metars).map((r) => ({
    label: r.label,
    minLeadH: r.minLeadH,
    hours: r.hours,
    leadH: r.leadH,
    call: r.call,
    bands: r.bands,
    byForecast: withDensity(diffDistribution(r.pairs, 'forecast')),
    byReported: withDensity(diffDistribution(r.pairs, 'reported')),
  }));
  // NDFD records carry their distance to the grid point; kept ones do not
  // (the API names its grid cell, not how far its centre is).
  const gridKm = ndfd.reduce<number | null>((m, r) => (r.site === site && (m == null || r.gridKm > m) ? r.gridKm : m), null);
  const issued = new Set(mine.map((r) => r.issued));
  return { site, short, place, gridKm, issuances: { count: issued.size, span: span([...issued].map(iso)) }, rows };
}).filter((p) => p.rows.some((r) => r.hours > 0));

// Version 2 holds every hour's value and the density curves (the chart's
// rainclouds); the page refuses a version 1 file.
const data = {
  version: 2,
  generatedAt: new Date().toISOString(),
  sources: {
    ceiling: args.ceiling.map((f) => basename(f)),
    cover: args.cover.map((f) => basename(f)),
    kept: keptUsed,
  },
  reports: { station: 'KPMV', count: metars.length, span: span(metars.map((r) => r.obsAt)) },
  bands: FLIGHT_BANDS,
  ceilingBands: CEILING_BANDS,
  bins: DIFF_BINS,
  points,
};
// One key a line, so a regenerated file diffs by field, but each array of
// numbers (or of [x, y] pairs) on one line: one number a line was 930 KB.
const NUM = String.raw`-?\d+(?:\.\d+)?(?:e[-+]?\d+)?`;
const flat = (re: RegExp) => (json: string) => json.replace(re, (m) => m.replace(/\s+/g, ''));
const text = [
  flat(new RegExp(String.raw`\[\s*${NUM}(?:,\s*${NUM})*\s*\]`, 'g')),
  flat(new RegExp(String.raw`\[\s*\[[^\[\]]*\](?:,\s*\[[^\[\]]*\])*\s*\]`, 'g')),
].reduce((j, f) => f(j), JSON.stringify(data, null, 1));
writeFileSync(out, text + '\n');
console.log(
  `wrote ${out}: ${points.map((p) => `${p.site} ${p.rows.map((r) => r.hours).join('/')} h`).join(', ')}`,
);
