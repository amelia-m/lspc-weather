/**
 * Which forecast Surface row sat nearer KPMV's measured wind: this app's or
 * Mark Schulze's (docs/markschulze-altitude-reference.md, "Which Surface
 * row is nearer the measured wind"). The arithmetic is
 * src/domain/surfaceRows.ts; this reads the files and prints Markdown.
 *
 *   npx tsx scripts/surfaceRows.ts \
 *     --logs data/parity/logs-to-2026-10-05.jsonl.gz data/parity/schulze-logs-2026-10-04-to-2026-10-17.jsonl.gz \
 *     --kpmv data/parity/kpmv-wind-2026-09-23-to-2026-10-17.csv.gz
 *
 * --logs takes any files of comparison lines (`@@parity {json}`, gzipped
 * or not; other lines are skipped): the archive under data/parity/, and the parity-*
 * artifacts the comparison workflows upload (kept 14 days; archive the
 * Schulze lines under data/parity/ before they expire). A record in two
 * files counts once. --kpmv takes IEM's ASOS CSV for KPMV, routine and special
 * reports, wind speed only:
 *   https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?station=PMV&data=sknt&tz=Etc/UTC&format=onlycomma&latlon=no&missing=M&report_type=3&report_type=4&year1=…
 * The hours are tabled by the point each record was read at (its `dz`;
 * records without one are the point before 2026-10-08).
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { uniqueParityRecords, type SchulzeRecord } from '../src/domain/paritySummary';
import { groundHours, OLD_POINT, surfaceRowsTable, type WindReport } from '../src/domain/surfaceRows';

const args: Record<string, string[]> = {};
let flag = '';
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) args[(flag = a.slice(2))] = [];
  else if (flag) args[flag].push(a);
}
if (!args.logs?.length || !args.kpmv?.length) {
  console.error('usage: surfaceRows.ts --logs <files…> --kpmv <IEM csv files…>');
  process.exit(2);
}
const read = (f: string): string => {
  const buf = readFileSync(f);
  return (f.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8');
};

// One record per kind and run time, the first seen kept, as the summary
// counts them (uniqueParityRecords): the same run can come from an artifact
// and from the archive, where its line may differ by trailing whitespace.
const records = uniqueParityRecords(args.logs.map(read)).filter((r): r is SchulzeRecord => r.kind === 'schulze');

// One report per time, so two IEM files that overlap count each once.
const byTime = new Map<number, number>();
for (const f of args.kpmv) {
  for (const line of read(f).split('\n').slice(1)) {
    const [, valid, sknt] = line.split(',');
    const kt = Number(sknt);
    const t = Date.parse(`${valid?.replace(' ', 'T')}Z`);
    if (Number.isFinite(t) && sknt !== 'M' && Number.isFinite(kt)) byTime.set(t, kt);
  }
}
const reports: WindReport[] = [...byTime].map(([t, kt]) => ({ t, kt }));

const hours = groundHours(records);
// Rounded before the sign is chosen, so a bias under 0.05 kt prints 0.0.
const fmt = (x: number) => {
  const r = Math.round(x * 10) / 10;
  return (r > 0 ? '+' : '') + (r === 0 ? 0 : r).toFixed(1);
};
const table = (title: string, hs: typeof hours) => {
  const rows = surfaceRowsTable(hs, reports);
  const out = [`### ${title}`, '', '| hours | n | KPMV median | this app: bias, mean abs error | Schulze: bias, mean abs error | nearer (this app, Schulze, tied) |', '|---|---|---|---|---|---|'];
  for (const r of rows) {
    const side = (s: typeof r.ours) => (s ? `${fmt(s.bias)}, ${s.mae.toFixed(1)} kt` : '–');
    out.push(`| ${r.label} | ${r.n} | ${r.measuredMedian == null ? '–' : r.measuredMedian.toFixed(1) + ' kt'} | ${side(r.ours)} | ${side(r.theirs)} | ${r.nearer.ours}, ${r.nearer.theirs}, ${r.nearer.tied} |`);
  }
  return out.join('\n') + '\n';
};
const span = (hs: typeof hours) => (hs.length ? `${new Date(hs[0].t).toISOString().slice(0, 13)}Z to ${new Date(hs.at(-1)!.t).toISOString().slice(0, 13)}Z` : 'none');
const points = [...new Set(hours.map((h) => h.point))].sort((a, b) => (a === OLD_POINT ? -1 : b === OLD_POINT ? 1 : a.localeCompare(b)));
console.log(
  [
    // Open-Meteo's credit, where its data are shown (docs/open-meteo-terms.md).
    "Weather data by Open-Meteo.com (https://open-meteo.com/), under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/): both Surface rows here are worked from its forecast, this app's interpolated to 10 m and Mark Schulze's as his tool serves it. KPMV's reports beside them are NOAA's.",
    '',
    `${records.length} Schulze records, ${hours.length} valid hours with both rows (${span(hours)}); ${reports.length} KPMV reports.`,
    '',
    table(`Every hour (${span(hours)})`, hours),
    ...points.map((p) => {
      const hs = hours.filter((h) => h.point === p);
      return table(`At ${p}${p === OLD_POINT ? ', the point before 2026-10-08' : ''} (${span(hs)})`, hs);
    }),
  ].join('\n'),
);
