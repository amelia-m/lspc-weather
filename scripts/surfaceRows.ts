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
 * --logs takes any files of comparison lines (`@@parity {json}` or bare
 * JSON, gzipped or not): the archive under data/parity/, and the parity-*
 * artifacts the comparison workflows upload (kept 14 days; archive the
 * Schulze lines under data/parity/ before they expire). A line in two files
 * counts once. --kpmv takes IEM's ASOS CSV for KPMV, routine and special
 * reports, wind speed only:
 *   https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?station=PMV&data=sknt&tz=Etc/UTC&format=onlycomma&latlon=no&missing=M&report_type=3&report_type=4&year1=…
 * --split (default the DZ point's move to the landing area) adds a table
 * for the hours before it and one for the hours from it.
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { SITE } from '../src/config/site';
import { groundHours, surfaceRowsTable, type SchulzeGroundRecord, type WindReport } from '../src/domain/surfaceRows';

const args: Record<string, string[]> = {};
let flag = '';
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) args[(flag = a.slice(2))] = [];
  else if (flag) args[flag].push(a);
}
if (!args.logs?.length || !args.kpmv?.length) {
  console.error('usage: surfaceRows.ts --logs <files…> --kpmv <IEM csv files…> [--split <ISO time>]');
  process.exit(2);
}
// The commit that moved SITE.dz to the landing area reached main at this
// time (c62f263); comparison runs from then on read the new point.
const SPLIT = Date.parse(args.split?.[0] ?? '2026-10-08T04:17:08Z');

const read = (f: string): string => {
  const buf = readFileSync(f);
  return (f.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8');
};

const seen = new Set<string>();
const records: SchulzeGroundRecord[] = [];
for (const f of args.logs) {
  for (const line of read(f).split('\n')) {
    const json = line.replace(/^.*?@@parity /, '').trim();
    if (!json.startsWith('{') || seen.has(json)) continue;
    seen.add(json);
    try {
      const r = JSON.parse(json) as SchulzeGroundRecord;
      if (r.kind === 'schulze') records.push(r);
    } catch {
      // A line cut short in a log is not a record.
    }
  }
}

const reports: WindReport[] = [];
for (const f of args.kpmv) {
  for (const line of read(f).split('\n').slice(1)) {
    const [, valid, sknt] = line.split(',');
    const kt = Number(sknt);
    if (!valid || !Number.isFinite(kt)) continue;
    reports.push({ t: Date.parse(valid.replace(' ', 'T') + 'Z'), kt });
  }
}

const hours = groundHours(records);
const fmt = (x: number) => (x > 0 ? '+' : '') + x.toFixed(1);
const table = (title: string, hs: typeof hours) => {
  const rows = surfaceRowsTable(hs, reports, SITE.timeZone);
  const out = [`### ${title}`, '', '| hours | n | KPMV median | this app: bias, mean abs error | Schulze: bias, mean abs error | nearer (this app, Schulze, tied) |', '|---|---|---|---|---|---|'];
  for (const r of rows) {
    const side = (s: typeof r.ours) => (s ? `${fmt(s.bias)}, ${s.mae.toFixed(1)} kt` : '–');
    out.push(`| ${r.label} | ${r.n} | ${r.measuredMedian == null ? '–' : r.measuredMedian.toFixed(1) + ' kt'} | ${side(r.ours)} | ${side(r.theirs)} | ${r.nearer.ours}, ${r.nearer.theirs}, ${r.nearer.tied} |`);
  }
  return out.join('\n') + '\n';
};
const span = (hs: typeof hours) => (hs.length ? `${new Date(hs[0].t).toISOString().slice(0, 13)}Z to ${new Date(hs.at(-1)!.t).toISOString().slice(0, 13)}Z` : 'none');
const before = hours.filter((h) => h.t < SPLIT);
const after = hours.filter((h) => h.t >= SPLIT);
console.log(
  [
    `${records.length} Schulze records, ${hours.length} valid hours with both rows (${span(hours)}); ${reports.length} KPMV reports.`,
    '',
    table(`Every hour (${span(hours)})`, hours),
    table(`At the old point, before ${new Date(SPLIT).toISOString()} (${span(before)})`, before),
    table(`At the landing area, from ${new Date(SPLIT).toISOString()} (${span(after)})`, after),
  ].join('\n'),
);
