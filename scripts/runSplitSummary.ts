/**
 * Summarise the run-split sampler's records (scripts/runSplit.live.ts,
 * docs/run-split.md). Usage:
 *
 *   npx tsx scripts/runSplitSummary.ts <runsplit-*.jsonl[.gz]>...
 *
 * Prints the tables as Markdown, then the summary as JSON. The arithmetic is
 * src/domain/runSplit.ts (pure, tested); this file only reads and prints.
 * Counts only, never a grade.
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseRunSplitLines, summarizeRunSplit, type Cell, type RunSplitRecord } from '../src/domain/runSplit';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: runSplitSummary.ts <runsplit-*.jsonl[.gz]>...');
  process.exit(2);
}
// A sample seen in two files (an archive beside the artifacts) counts once.
const byAt = new Map<string, RunSplitRecord>();
for (const f of files) {
  const buf = readFileSync(f);
  for (const r of parseRunSplitLines((f.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8'))) byAt.set(r.at, r);
}
const s = summarizeRunSplit([...byAt.values()]);
const pct = (c: Cell): string =>
  c.n ? `${c.mismatched} of ${c.n} (${((100 * c.mismatched) / c.n).toFixed(1)}%)` : '—';
const out: string[] = [`${s.samples} samples, ${s.first} to ${s.last}`, ''];

out.push('## His request against the app’s first, by half of the hour', '');
out.push('| his request | minutes 0–29 | minutes 30–59 |', '|---|---|---|');
for (const offset of [0, 1] as const) {
  const at = (half: 'first' | 'second') => s.byOffsetAndHalf.find((c) => c.offset === offset && c.half === half)!.cell;
  out.push(`| ${offset === 0 ? 'hour in progress' : 'next hour'} | ${pct(at('first'))} | ${pct(at('second'))} |`);
}
out.push('', '## By ten-minute band', '');
out.push('| from minute | hour in progress | next hour | app against itself |', '|---|---|---|---|');
for (const b of s.selfByBand) {
  const at = (offset: 0 | 1) => s.byOffsetAndBand.find((c) => c.offset === offset && c.fromMin === b.fromMin)!.cell;
  out.push(`| ${b.fromMin} | ${pct(at(0))} | ${pct(at(1))} | ${pct(b.cell)} |`);
}
out.push(
  '',
  `Where his table and the app’s first answer were on different runs (${s.firstWasOddOneOut.of}), ` +
    `his matched the app’s second answer in ${s.firstWasOddOneOut.secondMatched}.`,
);
out.push('', '## By minutes since the newest HRRR run became available (both offsets)', '');
out.push('| since the newest run | different runs |', '|---|---|');
for (const b of s.byRunAge) {
  const label =
    b.toMin === Infinity
      ? `${b.fromMin} min or more`
      : b.fromMin === -Infinity
        ? `under ${b.toMin} min`
        : `${b.fromMin} to ${b.toMin} min`;
  out.push(`| ${label} | ${pct(b.cell)} |`);
}
console.log(out.join('\n'));
console.log(JSON.stringify(s, (_k, v) => (v === Infinity ? 'Infinity' : v === -Infinity ? '-Infinity' : v)));
