/**
 * Whether the winds-aloft comparison's "different forecast run" flag
 * follows Open-Meteo's new runs (docs/open-questions.md, "Which forecast run
 * the winds-aloft request is served"). The counting is
 * src/domain/runAge.ts; this reads the files and prints Markdown.
 *
 *   npx tsx scripts/runAge.ts --logs data/parity/parity-logs-*.jsonl.gz <parity-* artifacts…>
 *
 * --logs takes any files of comparison lines (`@@parity {json}` or bare
 * JSON, gzipped or not). A line in two files counts once. Only records from
 * 2026-10-21 on carry the run metadata (`omRuns`); older ones are skipped.
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseParityLines, type SchulzeRecord } from '../src/domain/paritySummary';
import { mismatchByRunAge, mismatchBySplit } from '../src/domain/runAge';

const args: Record<string, string[]> = {};
let flag = '';
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) args[(flag = a.slice(2))] = [];
  else if (flag) args[flag].push(a);
}
if (!args.logs?.length) {
  console.error('usage: runAge.ts --logs <files…>');
  process.exit(2);
}
const read = (f: string): string => {
  const buf = readFileSync(f);
  return (f.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8');
};
const lines = new Set<string>();
for (const f of args.logs) for (const line of read(f).split('\n')) if (line.includes('@@parity ')) lines.add(line.slice(line.indexOf('@@parity ')));
const records = parseParityLines([...lines].join('\n')).filter(
  (r): r is SchulzeRecord => r.kind === 'schulze' && r.omRuns != null,
);

const band = (from: number, to: number): string =>
  `${from === -Infinity ? 'under' : `${from} to`} ${to === Infinity ? 'more' : `${to} min`}`.replace('under 15 min', 'under 15 min (or arriving)').replace(/^60 to more$/, '60 min or more');
const out = [`${records.length} comparisons with run metadata.`, ''];
for (const domain of ['ncep_hrrr_conus', 'ncep_gfs025']) {
  out.push(`## ${domain}`, '', '| since the newest run | judged | flagged as different runs |', '|---|---:|---:|');
  for (const r of mismatchByRunAge(records, domain)) out.push(`| ${band(r.fromMin, r.toMin)} | ${r.n} | ${r.mismatched} |`);
  out.push('', '| metadata reads | judged | flagged as different runs |', '|---|---:|---:|');
  for (const r of mismatchBySplit(records, domain)) out.push(`| ${r.serversDisagreed ? 'disagreed' : 'agreed'} | ${r.n} | ${r.mismatched} |`);
  out.push('');
}
console.log(out.join('\n'));
