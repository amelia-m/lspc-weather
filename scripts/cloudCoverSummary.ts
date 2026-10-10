/**
 * Summarise the cloud-cover records scripts/cloudCoverFetch.py gathered:
 * each forecast's percentage against KPMV's reported cover at the same hours,
 * and the two forecasts against each other. Usage:
 *
 *   npx tsx scripts/cloudCoverSummary.ts data/parity/cloud-cover-*.jsonl.gz
 *
 * Prints Markdown tables, then the summary as JSON. The arithmetic is in
 * src/domain/cloudCoverSources.ts (pure, tested); this file only reads files
 * and prints. Counts and spreads, never a grade.
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import {
  OBSERVED_CATEGORIES,
  parseCloudCoverLines,
  summarizeCloudCover,
  type CloudCoverRecord,
} from '../src/domain/cloudCoverSources';

const records: CloudCoverRecord[] = [];
for (const file of process.argv.slice(2)) {
  const buf = readFileSync(file);
  records.push(...parseCloudCoverLines((file.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8')));
}
const s = summarizeCloudCover(records);
const pct = (a: number, b: number): string => (b === 0 ? '—' : `${Math.round((a / b) * 100)}%`);
const v = (x: number | null): string => (x == null ? '—' : String(Math.round(x)));

const out: string[] = [];
out.push(
  `${s.reports} reports; ${s.hoursWithReport} forecast hours with a report within the window, ` +
    `${s.hoursNoSkyGroup} of them with no sky group; ${s.firstHour} to ${s.lastHour}`,
);
out.push(`Observed: ${OBSERVED_CATEGORIES.map((c) => `${c} ${s.observed[c]}`).join(', ')}`);
out.push('');
out.push('| Forecast | Hours | Lead (h) | Inside the reported range | Below | Above | Median gap | 90th pct gap | Signed mean |');
out.push('|---|---|---|---|---|---|---|---|---|');
for (const x of s.vs) {
  out.push(
    `| ${x.source} | ${x.n} | ${x.leadH ? `${x.leadH.min}–${x.leadH.max}` : '—'} | ${x.inside} (${pct(x.inside, x.n)}) | ` +
      `${x.below} (${pct(x.below, x.n)}) | ${x.above} (${pct(x.above, x.n)}) | ${x.gap?.medianAbs ?? '—'} | ` +
      `${x.gap?.p90Abs ?? '—'} | ${x.gap?.mean ?? '—'} |`,
  );
}
out.push('');
out.push('SCT hours with the forecast at or below 50% (SCT for a station that reports no FEW):');
for (const x of s.vs) out.push(`  ${x.source}: ${x.sctAtOrBelowHalf} of ${x.byObserved.SCT.n} (${pct(x.sctAtOrBelowHalf, x.byObserved.SCT.n)})`);
out.push('');
out.push('| Forecast | Ceiling reported, forecast ≥ 5/8 | Ceiling reported, forecast below | No ceiling, forecast ≥ 5/8 | Neither |');
out.push('|---|---|---|---|---|');
for (const x of s.vs) {
  const c = x.ceiling;
  out.push(`| ${x.source} | ${c.bothYes} | ${c.reportedOnly} | ${c.forecastOnly} | ${c.neither} |`);
}
for (const x of s.vs) {
  out.push('', `**${x.source}**, by what KPMV reported`, '');
  out.push('| Reported | Hours | Inside | Median | 10th–90th pct | 0s | 10s | 20s | 30s | 40s | 50s | 60s | 70s | 80s | 90–100 |');
  out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of OBSERVED_CATEGORIES) {
    const r = x.byObserved[c];
    if (r.n === 0) continue;
    out.push(
      `| ${c} | ${r.n} | ${pct(r.inside, r.n)} | ${v(r.median)} | ${v(r.p10)}–${v(r.p90)} | ${r.deciles.join(' | ')} |`,
    );
  }
}
out.push('');
const d = s.nwsVsOpenMeteo;
out.push(
  `NWS latest minus Open-Meteo start of run, same hours: ` +
    (d ? `median ${d.medianAbs}, 90th pct ${d.p90Abs}, signed mean ${d.mean} (n ${d.n})` : '—'),
);
const b = s.bothInside;
const n = b.both + b.nwsOnly + b.omOnly + b.neither;
out.push(
  `Inside the reported range: both ${b.both} (${pct(b.both, n)}), NWS only ${b.nwsOnly} (${pct(b.nwsOnly, n)}), ` +
    `Open-Meteo only ${b.omOnly} (${pct(b.omOnly, n)}), neither ${b.neither} (${pct(b.neither, n)})`,
);
out.push(
  `Open-Meteo high band on CLR hours: median ${v(s.omHighWhenClear.median)}, 90th pct ${v(s.omHighWhenClear.p90)} (n ${s.omHighWhenClear.n})`,
);
console.log(out.join('\n'));
console.log('\n' + JSON.stringify(s));
