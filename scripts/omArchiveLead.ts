/**
 * Is it lead time? Open-Meteo's live hourly 10 m wind against its own
 * archive's "start of run" value, by when in the hour the app asked and
 * by the lead of each hourly value (docs/surface-wind-sources.md, "Worked
 * out 2026-11-12" and its addendum of 2026-11-13).
 *
 * `scripts/omArchiveVsSample.ts` found the live value about 0.6 kt over
 * the archive's for the same hour, mostly at night. The hypothesis: the
 * live value is from a run one and a half to two hours old, the archive's
 * from a run started at the hour. A new HRRR run reaches Open-Meteo's
 * servers between about :20 and :59 (docs/run-split.md), so if lead is
 * the cause, requests late in an hour should read nearer the archive than
 * requests early in the same hour. Four readings, from the files on disk,
 * no fetch:
 *
 *   1. the hour under way, by the request's minute band (20 and 10 min);
 *   2. the same, by the lead the HRRR 15-minute metadata gives it;
 *   3. the same, split at the first request in each clock hour whose
 *      value moved (a new run seen from the sample alone);
 *   4. every hourly value in every record, by its lead, −1 to 4 h, which
 *      says which lead the archive's value is.
 *
 * Usage:
 *   npx tsx scripts/omArchiveLead.ts --from 2026-10-09 --to 2026-11-08 \
 *     --sample data/parity/surfacewind-*.jsonl.gz \
 *     --om data/parity/om-wind-*.jsonl.gz \
 *     --reports data/parity/metar-*.jsonl.gz data/parity/kept-forecasts-kpmv-reports-*.jsonl.gz
 *
 * --to is inclusive, whole UTC days, on the request's time. Prints counts
 * and spreads only.
 */
import { reportsByHour } from '../src/domain/keptForecasts';
import {
  hourUnderWaySamples,
  isNightUtc,
  liveVsArchiveRows,
  liveVsArchiveSamples,
  minuteBand,
  splitAtFirstChange,
  type LiveVsArchiveRow,
  type LiveVsArchiveSample,
} from '../src/domain/liveVsArchive';
import { orderedRuns } from '../src/domain/surfaceWindSources';
import { loadKpmvReports, loadOmWindRecords, loadSurfaceWindRecords } from './keptInputs';

const args = process.argv.slice(2);
const flag = (name: string): string[] => {
  const i = args.indexOf(name);
  if (i < 0) return [];
  const out: string[] = [];
  for (let j = i + 1; j < args.length && !args[j].startsWith('--'); j++) out.push(args[j]);
  return out;
};
const [from] = flag('--from');
const [to] = flag('--to');
const sampleFiles = flag('--sample');
const omFiles = flag('--om');
const reportFiles = flag('--reports');
if (!from || !to || !sampleFiles.length || !omFiles.length || !reportFiles.length) {
  console.error('usage: omArchiveLead.ts --from <day> --to <day> --sample <files> --om <files> --reports <files>');
  process.exit(2);
}
const MS_H = 3_600_000;
const t0 = Date.parse(`${from}T00:00:00Z`);
const t1 = Date.parse(`${to}T00:00:00Z`) + 24 * MS_H;

const runs = orderedRuns(loadSurfaceWindRecords(sampleFiles)).filter((r) => {
  const t = Date.parse(r.at);
  return t >= t0 && t < t1;
});
// The archive's start of run; an hour fetched twice keeps the last record.
const archive = new Map<number, number>();
for (const r of loadOmWindRecords(omFiles)) if (r.run === 'historical' && r.spd != null) archive.set(Date.parse(r.valid), r.spd);
const reports = reportsByHour(loadKpmvReports(reportFiles));
const samples = liveVsArchiveSamples(runs, archive, reports);
const current = hourUnderWaySamples(samples);
console.log(
  `${runs.length} runs ${from} to ${to}; ${samples.length} hourly values the archive also holds, ${current.length} of them the hour under way over ${new Set(current.map((s) => s.valid)).size} hours; ${current.filter((s) => s.lead == null).length} without run metadata`,
);

const f = (x: number | null): string => (x == null ? '   –' : (x >= 0 ? '+' : '') + x.toFixed(2)).padStart(6);
const header = (): void => {
  console.log(
    `${'group'.padEnd(26)} ${'n'.padStart(5)}  live−archive: mean  median  above/eq/below  (=tenth, ≤0.5)   with report: n  live−rep  arch−rep`,
  );
};
// Rows in the order of the first number in their key (a lead, a minute),
// then the key: the groups are met in the order the sample runs, which
// reads jumbled.
const firstNumber = (key: string): number => Number(/-?\d+/.exec(key)?.[0] ?? 0);
const print = (rows: readonly LiveVsArchiveRow[]): void => {
  for (const r of [...rows].sort((a, b) => firstNumber(a.key) - firstNumber(b.key) || a.key.localeCompare(b.key))) {
    const a = r.liveMinusArchive;
    console.log(
      `${r.key.padEnd(26)} ${String(a.n).padStart(5)}  ${f(a.mean)}  ${f(a.median)}  ${String(a.above).padStart(5)}/${String(a.zero).padStart(3)}/${String(a.below).padStart(5)}  (${String(a.equal).padStart(5)}, ${String(a.withinHalf).padStart(5)})   ${String(r.liveMinusReport.n).padStart(5)}  ${f(r.liveMinusReport.mean)}  ${f(r.archiveMinusReport.mean)}`,
    );
  }
};
const byNight = (key: (s: LiveVsArchiveSample) => string | null): ((s: LiveVsArchiveSample) => string | null) => {
  return (s) => {
    const k = key(s);
    return k == null ? null : `${k} ${isNightUtc(s.valid) ? 'night' : 'day'}`;
  };
};
const section = (title: string, list: readonly LiveVsArchiveSample[], key: (s: LiveVsArchiveSample) => string | null): void => {
  console.log(`\n${title}`);
  header();
  print(liveVsArchiveRows(list, key));
  print(liveVsArchiveRows(list, byNight(key)));
};

section('1. The hour under way, by the request\'s minute (20-minute bands)', current, (s) => `minute ${minuteBand(s.at, 20)}`);
section('   ... and 10-minute bands', current, (s) => `minute ${minuteBand(s.at, 10)}`);
section('2. The hour under way, by its lead from the HRRR 15-minute run the metadata named', current, (s) => (s.lead == null ? null : `lead ${s.lead} h`));
console.log('\n   ... which lead each minute band mostly is');
header();
print(liveVsArchiveRows(current, (s) => (s.lead == null ? null : `minute ${minuteBand(s.at, 20)}, lead ${s.lead} h`)));

const split = splitAtFirstChange(samples);
console.log(`\n3. The hour under way, split at the first request in the clock hour whose value moved: ${split.hoursChanged} of ${split.hoursWithTwo} hours with two or more requests moved`);
header();
print(liveVsArchiveRows([...split.before, ...split.after, ...split.unchanged], (s) => (split.before.includes(s) ? 'before the change' : split.after.includes(s) ? 'from the change' : 'never moved')));
print(liveVsArchiveRows([...split.before, ...split.after], byNight((s) => (split.before.includes(s) ? 'before the change' : 'from the change'))));

section('4. Every hourly value in every record, by its lead (valid hour minus run initialisation)', samples, (s) => (s.lead == null ? null : `lead ${s.lead} h`));
