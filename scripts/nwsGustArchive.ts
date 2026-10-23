/**
 * The NWS gust forecast from NOAA's NDFD archive against KPMV's reports
 * (docs/nws-gust-archive.md). Usage:
 *
 *   PARTS=wgust python3 scripts/cloudCoverFetch.py <start> <end> data/parity/ndfd-wgust-<start>-to-<end>.jsonl.gz
 *   npx tsx scripts/nwsGustArchive.ts --gust data/parity/ndfd-wgust-*.jsonl.gz \
 *     --reports data/parity/kept-forecasts-kpmv-reports-*.jsonl.gz data/parity/metar-*.jsonl.gz \
 *               data/parity/cloud-cover-2*.jsonl.gz [--from <ISO> --to <ISO>]
 *
 * --from and --to keep only the hours between them, both included: the
 * kept forecasts' window, to set this reading beside that one.
 * Prints the summary as text, then as JSON. The arithmetic is
 * src/domain/ndfdGust.ts (pure, tested); this file only reads and prints.
 * The limit counted against is the Student profile's surface-wind caution,
 * BSR 2-1 H's 14 mph read as 12 kt, the figure the forecast wind flag reads
 * the gust against for a student. Counts and spreads, never a grade.
 */
import { DEFAULT_THRESHOLDS } from '../src/config/thresholds';
import { SITE } from '../src/config/site';
import { pairGusts, summarizeGusts, type GroupMean } from '../src/domain/ndfdGust';
import { loadKpmvReports, loadNdfdGustRecords } from './keptInputs';

const args = process.argv.slice(2);
const flag = (name: string): string[] => {
  const i = args.indexOf(name);
  if (i < 0) return [];
  const out: string[] = [];
  for (let j = i + 1; j < args.length && !args[j].startsWith('--'); j++) out.push(args[j]);
  return out;
};
const gustFiles = flag('--gust');
const reportFiles = flag('--reports');
const [from] = flag('--from');
const [to] = flag('--to');
if (gustFiles.length === 0 || reportFiles.length === 0) {
  console.error('usage: nwsGustArchive.ts --gust <files> --reports <files>');
  process.exit(2);
}

const records = loadNdfdGustRecords(gustFiles);
const metars = loadKpmvReports(reportFiles);
const inWindow = (t: number): boolean => (from == null || t >= Date.parse(from)) && (to == null || t <= Date.parse(to));
const rows = pairGusts(records, metars).map((r) => ({ ...r, pairs: r.pairs.filter((p) => inWindow(p.t)) }));
// A day counts toward the day-to-day spread with at least three gusting
// hours, so one gusty report does not stand for a day.
const summary = summarizeGusts(rows, {
  timeZone: SITE.timeZone,
  limitKt: DEFAULT_THRESHOLDS.student.windCautionKt,
  minDayHours: 3,
});

const issued = [...new Set(records.map((r) => r.issued))].sort();
console.log(`${records.length} gust records, ${issued.length} issuances, ${issued[0]} to ${issued[issued.length - 1]}`);
console.log(`${metars.length} KPMV reports, ${metars[0]?.obsAt} to ${metars[metars.length - 1]?.obsAt}\n`);
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
    `  at ${s.atLimit.limitKt} kt: forecast gust at or over in ${s.atLimit.forecastAt} hours, KPMV too in ${s.atLimit.bothAt}; KPMV at or over with the forecast under in ${s.atLimit.reportOnly}`,
  );
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
