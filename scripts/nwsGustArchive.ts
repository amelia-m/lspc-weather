/**
 * The NWS gust forecast from NOAA's NDFD archive against KPMV's reports
 * (docs/nws-gust-archive.md). Usage:
 *
 *   PARTS=wspd,wgust,wdir python3 scripts/cloudCoverFetch.py <start> <end> data/parity/ndfd-wind-<start>-to-<end>.jsonl.gz
 *   npx tsx scripts/nwsGustArchive.ts --ndfd data/parity/ndfd-wgust-*.jsonl.gz data/parity/ndfd-wind-*.jsonl.gz \
 *     --reports data/parity/kept-forecasts-kpmv-reports-*.jsonl.gz data/parity/metar-*.jsonl.gz \
 *               data/parity/cloud-cover-2*.jsonl.gz [--from <ISO> --to <ISO>]
 *
 * --from and --to keep only the hours between them, both included: the
 * kept forecasts' window, to set this reading beside that one.
 * Prints the summary as text, then as JSON. The arithmetic is
 * src/domain/ndfdGust.ts (pure, tested); this file only reads and prints.
 * The limit counted against is the Student profile's surface-wind caution,
 * BSR 2-1 H's 14 mph read as 12 kt, read as the forecast wind flag reads
 * it: the higher of the forecast wind and gust (the wind from the
 * archive's speed records, where the files hold them). Counts and spreads,
 * never a grade.
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { DEFAULT_THRESHOLDS } from '../src/config/thresholds';
import { SITE } from '../src/config/site';
import { pairGusts, summarizeGusts, type GroupMean } from '../src/domain/ndfdGust';
import { loadKpmvReports, loadNdfdWind } from './keptInputs';

const args = process.argv.slice(2);
const flag = (name: string): string[] => {
  const i = args.indexOf(name);
  if (i < 0) return [];
  const out: string[] = [];
  for (let j = i + 1; j < args.length && !args[j].startsWith('--'); j++) out.push(args[j]);
  return out;
};
const gustFiles = flag('--ndfd');
const reportFiles = flag('--reports');
const [from] = flag('--from');
const [to] = flag('--to');
for (const [name, v] of [['--from', from], ['--to', to]] as const) {
  if (v != null && Number.isNaN(Date.parse(v))) {
    console.error(`${name} ${v}: not a time`);
    process.exit(2);
  }
}
if (gustFiles.length === 0 || reportFiles.length === 0) {
  console.error('usage: nwsGustArchive.ts --ndfd <files> --reports <files> [--from <ISO> --to <ISO>]');
  process.exit(2);
}

const wind = loadNdfdWind(gustFiles);
const records = wind.gust;
const truncated = gustFiles.flatMap((f) =>
  (f.endsWith('.gz') ? gunzipSync(readFileSync(f)) : readFileSync(f))
    .toString('utf8')
    .split('\n')
    .filter((l) => l.includes('"src":"ndfd-truncated"')),
);
const metars = loadKpmvReports(reportFiles);
const inWindow = (t: number): boolean => (from == null || t >= Date.parse(from)) && (to == null || t <= Date.parse(to));
const rows = pairGusts(records, metars, wind.spd).map((r) => ({ ...r, pairs: r.pairs.filter((p) => inWindow(p.t)) }));
// A day counts toward the day-to-day spread with at least three gusting
// hours, so one gusty report does not stand for a day.
const summary = summarizeGusts(rows, {
  timeZone: SITE.timeZone,
  limitKt: DEFAULT_THRESHOLDS.student.windCautionKt,
  minDayHours: 3,
});

const issued = [...new Set(records.map((r) => r.issued))].sort();
console.log(`${records.length} gust records, ${issued.length} issuances, ${issued[0]} to ${issued[issued.length - 1]}; ${wind.spd.length} speed records`);
console.log(`${metars.length} KPMV reports, ${metars[0]?.obsAt} to ${metars[metars.length - 1]?.obsAt}`);
for (const t of truncated) console.log(`cut short in the archive: ${t}`);
console.log(from || to ? `hours from ${from ?? 'the start'} to ${to ?? 'the end'} only\n` : '');
const signed = (x: number | null): string => (x == null ? '—' : x > 0 ? `+${x}` : `${x}`);
const line = (g: GroupMean): string =>
  `  ${g.key.padEnd(14)} n ${String(g.n).padStart(4)}  mean ${signed(g.mean).padStart(6)}  above ${g.side.above}, same ${g.side.equal}, below ${g.side.below}`;
for (const s of summary) {
  console.log(`== ${s.label}: ${s.hours} hours, lead ${s.lead?.min} to ${s.lead?.max} h, KPMV gust reported in ${s.gustHours}`);
  console.log(
    `  gust, where reported: mean ${signed(s.spread?.mean ?? null)} kt, median miss ${s.spread?.medianAbs}, p90 ${s.spread?.p90Abs}, largest ${s.spread?.maxAbs}; above ${s.side.above}, same ${s.side.equal}, below ${s.side.below}`,
  );
  console.log(`  no gust reported: forecast gust over the reported steady wind, mean ${signed(s.overSteady?.mean ?? null)} kt (${s.overSteady?.n} hours)`);
  console.log(
    `  at ${s.atLimit.limitKt} kt: forecast (higher of wind and gust) at or over in ${s.atLimit.forecastAt} hours, KPMV too in ${s.atLimit.bothAt}; KPMV at or over with the forecast under in ${s.atLimit.reportOnly}`,
  );
  console.log(`  forecast wind given in ${s.gustUnderWind.compared} hours; over the forecast gust in ${s.gustUnderWind.under}`);
  console.log(' by month:');
  s.byMonth.forEach((g) => console.log(line(g)));
  console.log(' by UTC block:');
  s.byUtcBlock.forEach((g) => console.log(line(g)));
  console.log(' by reported gust:');
  s.bySize.forEach((g) => console.log(line(g)));
  console.log(
    ` days with 3+ gusting hours: ${s.dayMeans?.n}; daily mean from ${signed(s.dayMeans?.min ?? null)} to ${signed(s.dayMeans?.max ?? null)}, median ${signed(s.dayMeans?.median ?? null)}; under −2 kt ${s.dayMeans?.under}, within 2 kt ${s.dayMeans?.near}, over +2 kt ${s.dayMeans?.over}`,
  );
  console.log('');
}
console.log(JSON.stringify(summary));
