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
 *     --out data/parity/ceiling-errors.json
 *
 * More data is more files: each flag takes any number, so a later fetch
 * (scripts/cloudCoverFetch.py with PARTS=cig and SITES for both points,
 * and the drop zone's cloud-cover archive for the reports) is added by
 * naming it beside the first. A line that appears in two files counts once.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { gunzipSync } from 'node:zlib';
import {
  CEILING_BANDS,
  DIFF_BINS,
  diffDistribution,
  FLIGHT_BANDS,
  parseCeilingLines,
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
  console.error('usage: ceilingChartData.ts --ceiling <files…> --cover <files…> --out <file>');
  process.exit(2);
}

/** Every distinct line of the files, so overlapping fetches count once. */
const lines = (files: string[]): string => {
  const seen = new Set<string>();
  for (const f of files) {
    const buf = readFileSync(f);
    for (const line of (f.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8').split('\n')) {
      if (line.trim()) seen.add(line);
    }
  }
  return [...seen].join('\n');
};

const forecasts = parseCeilingLines(lines(args.ceiling));
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
] as const;

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
    byForecast: diffDistribution(r.pairs, 'forecast'),
    byReported: diffDistribution(r.pairs, 'reported'),
  }));
  const gridKm = mine.reduce<number | null>((m, r) => (m == null || r.gridKm > m ? r.gridKm : m), null);
  return { site, short, place, gridKm, rows };
});

const data = {
  version: 1,
  generatedAt: new Date().toISOString(),
  sources: { ceiling: args.ceiling.map((f) => basename(f)), cover: args.cover.map((f) => basename(f)) },
  reports: { station: 'KPMV', count: metars.length, span: span(metars.map((r) => r.obsAt)) },
  bands: FLIGHT_BANDS,
  ceilingBands: CEILING_BANDS,
  bins: DIFF_BINS,
  points,
};
writeFileSync(out, JSON.stringify(data, null, 1) + '\n');
console.log(
  `wrote ${out}: ${points.map((p) => `${p.site} ${p.rows.map((r) => r.hours).join('/')} h`).join(', ')}`,
);
