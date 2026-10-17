/**
 * The two drop-zone ceiling sources over the same hours: NDFD's archive
 * (read at the drop zone's grid point) and the API's own `ceilingHeight`
 * as the card fetched it (the `forecast-archive` snapshots), each scored
 * against KPMV's reports by summarizeCeilings and matched hour for hour.
 * The question (2026-10-17): is the kept source unlike the NDFD rows on
 * the chart because it is a different forecast, or because it covers
 * different days? docs/ceiling-heights.md, "The forecasts the card read,
 * kept hourly", has the answer.
 *
 *   npx tsx scripts/ceilingSameHours.ts \
 *     --ceiling data/parity/ceiling-2026-10-10-to-2026-10-17.jsonl.gz \
 *     --cover data/parity/metar-2026-10-10-to-2026-10-15.jsonl.gz data/parity/metar-2026-10-15-to-2026-10-17.jsonl.gz \
 *     --kept <forecast-archive checkout>/data
 *
 * Prints Markdown: every hour both sources scored with a ceiling on all
 * three sides, then a summary per issuance row. Reads and joins only; the
 * scoring is src/domain/ceilingHeights.ts.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import {
  keptCeilingRecords,
  parseCeilingLines,
  summarizeCeilings,
  type CeilingForecast,
  type KeptGridpointSnapshot,
} from '../src/domain/ceilingHeights';
import { parseCloudCoverLines, type MetarRecord } from '../src/domain/cloudCoverSources';
import { median } from '../src/domain/paritySummary';

const args: Record<string, string[]> = {};
let flag = '';
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) args[(flag = a.slice(2))] = [];
  else if (flag) args[flag].push(a);
}
if (!args.ceiling?.length || !args.cover?.length || !args.kept?.length) {
  console.error('usage: ceilingSameHours.ts --ceiling <files…> --cover <files…> --kept <files or folders…>');
  process.exit(2);
}
const read = (f: string): string => {
  const buf = readFileSync(f);
  return (f.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8');
};
const lines = (files: string[]): string => [...new Set(files.flatMap((f) => read(f).split('\n')).filter((l) => l.trim()))].join('\n');
const found: string[] = [];
const walk = (p: string): void => {
  if (statSync(p).isDirectory()) for (const e of readdirSync(p)) walk(join(p, e));
  else if (/\.json(\.gz)?$/.test(p)) found.push(p);
};
args.kept.forEach(walk);

const ndfd: CeilingForecast[] = parseCeilingLines(lines(args.ceiling)).filter((r) => r.site === 'DZ');
const kept: CeilingForecast[] = found
  .sort()
  .flatMap((f) => keptCeilingRecords(JSON.parse(read(f)) as KeptGridpointSnapshot, 'KEPT'));
const metars: MetarRecord[] = [];
for (const r of parseCloudCoverLines(lines(args.cover))) if (r.site == null && r.src === 'metar') metars.push(r);

const a = summarizeCeilings(ndfd, metars);
const b = summarizeCeilings(kept, metars);
const fmt = (v: number | 'none'): string => (v === 'none' ? 'none' : v.toLocaleString('en-US'));
const out: string[] = [];
a.forEach((rowA, i) => {
  const rowB = b[i];
  const byHour = new Map(rowB.pairs.map((p) => [p.valid, p]));
  const common = rowA.pairs.filter((p) => byHour.has(p.valid)).map((p) => ({ valid: p.valid, ndfd: p.forecast, kept: byHour.get(p.valid)!.forecast, reported: p.reported }));
  const allCeiling = common.filter((c) => c.ndfd !== 'none' && c.kept !== 'none' && c.reported !== 'none') as {
    valid: string; ndfd: number; kept: number; reported: number;
  }[];
  const same = common.filter((c) => c.ndfd === c.kept).length;
  const med = (xs: number[]) => (xs.length ? Math.round(median(xs) as number) : null);
  out.push(`### ${rowA.label}`, '');
  out.push(
    `Hours both sources scored: ${common.length} (NDFD ${rowA.hours}, kept ${rowB.hours}); ` +
      `the same forecast ceiling in ${same}. With a ceiling on all three sides: ${allCeiling.length}; ` +
      `median forecast − reported ${med(allCeiling.map((c) => c.ndfd - c.reported))} ft from NDFD, ` +
      `${med(allCeiling.map((c) => c.kept - c.reported))} ft from the kept source; ` +
      `median NDFD − kept ${med(allCeiling.map((c) => c.ndfd - c.kept))} ft.`,
    '',
  );
  if (i === 0 && common.length) {
    out.push('| Hour (UTC) | NDFD (ft) | Kept (ft) | Reported (ft) |', '|---|---|---|---|');
    for (const c of common) out.push(`| ${c.valid.slice(5, 16).replace('T', ' ')} | ${fmt(c.ndfd)} | ${fmt(c.kept)} | ${fmt(c.reported)} |`);
    out.push('');
  }
});
console.log(out.join('\n'));
