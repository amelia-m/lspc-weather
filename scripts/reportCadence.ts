/**
 * How often the METAR station reports, from the archived reports: the gaps
 * between consecutive report times in data/parity/metar-*.jsonl.gz. The
 * figure behind `reportIntervalMin` in src/config/site.ts, which the cards'
 * "reports overdue" line states (src/domain/reportAge.ts).
 *
 *   npx tsx scripts/reportCadence.ts
 *
 * Prints the count of reports, the commonest gaps, how many gaps ran past
 * one and two of the configured intervals, and the longest. Exits non-zero
 * when no report is found, or when the commonest gap is not the configured
 * interval.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { SITE } from '../src/config/site';

const dir = 'data/parity';
const station = SITE.metarStation.id;
const interval = SITE.metarStation.reportIntervalMin;
const files = readdirSync(dir).filter((n) => /^metar-.*\.jsonl\.gz$/.test(n)).sort();
const times = new Set<number>();
for (const f of files) {
  for (const line of gunzipSync(readFileSync(`${dir}/${f}`)).toString('utf8').split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as { obsAt: string | number; raw?: string };
    if ((r.raw ?? '').startsWith(station)) times.add(new Date(r.obsAt).getTime());
  }
}
const sorted = [...times].sort((a, b) => a - b);
if (sorted.length < 2) {
  console.error(`no ${station} reports found in ${files.length} files under ${dir}`);
  process.exit(1);
}
const gaps = sorted.slice(1).map((t, i) => Math.round((t - sorted[i]) / 60_000));
const counts = new Map<number, number>();
for (const g of gaps) counts.set(g, (counts.get(g) ?? 0) + 1);
const common = [...counts.entries()].sort((a, b) => b[1] - a[1]);
const iso = (t: number): string => new Date(t).toISOString().slice(0, 16) + 'Z';
console.log(`${station}: ${sorted.length} reports in ${files.length} files, ${iso(sorted[0])} to ${iso(sorted[sorted.length - 1])}`);
console.log(`commonest gaps (min: count): ${common.slice(0, 6).map(([g, n]) => `${g}: ${n}`).join(', ')}`);
console.log(`configured interval ${interval} min: ${counts.get(interval) ?? 0} of ${gaps.length} gaps`);
console.log(`longer than ${interval} min: ${gaps.filter((g) => g > interval).length}; longer than ${2 * interval} min: ${gaps.filter((g) => g > 2 * interval).length}`);
const longest = Math.max(...gaps);
console.log(`longest: ${longest} min, after ${iso(sorted[gaps.indexOf(longest)])}`);
if (common[0][0] !== interval) {
  console.error(`the commonest gap is ${common[0][0]} min, not the configured ${interval}`);
  process.exit(1);
}
