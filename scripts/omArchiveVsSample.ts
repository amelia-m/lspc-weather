/**
 * Why Open-Meteo's archived "start of run" 10 m wind and the surface-wind
 * sample's Open-Meteo hourly value read differently against KPMV over the
 * same days (docs/surface-wind-sources.md, "Not the same as the sample, on
 * the same days": the archive's speed mean 0.0 kt where the sample's read
 * +0.8). The two readings pair differently and read different runs, and
 * this script takes the two apart from the data on file, no fetch:
 *
 *   1. the sample as its summary pairs it: every report against the hourly
 *      value nearest it, from the first run that had the report, to the
 *      tenth (`pairsVsMetar`);
 *   2. the same sample pairs cut to the archive's rule: one report per
 *      hour, within REPORT_WINDOW_MIN of it, the forecast rounded to whole
 *      knots (`windDiffs`), so only the run differs;
 *   3. the archive's start of run on exactly those hours, the same rule;
 *   4. forecast against forecast on those hours: the value the live API
 *      served while the report was newest, minus the archive's.
 *
 * Usage:
 *   npx tsx scripts/omArchiveVsSample.ts --from 2026-10-09 --to 2026-10-21 \
 *     --sample data/parity/surfacewind-*.jsonl.gz \
 *     --om data/parity/om-wind-*.jsonl.gz \
 *     --reports data/parity/metar-*.jsonl.gz data/parity/kept-forecasts-kpmv-reports-*.jsonl.gz
 *
 * --to is inclusive, whole UTC days. Prints counts and spreads only.
 */
import { REPORT_WINDOW_MIN, reportNear } from '../src/domain/cloudCoverSources';
import { reportsByHour, windDiffs } from '../src/domain/keptForecasts';
import { median } from '../src/domain/paritySummary';
import { orderedRuns, pairsVsMetar } from '../src/domain/surfaceWindSources';
import type { OmWindRecord } from '../src/domain/windErrors';
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
  console.error('usage: omArchiveVsSample.ts --from <day> --to <day> --sample <files> --om <files> --reports <files>');
  process.exit(2);
}
const MS_H = 3_600_000;
const t0 = Date.parse(`${from}T00:00:00Z`);
const t1 = Date.parse(`${to}T00:00:00Z`) + 24 * MS_H;
const inWindow = (ms: number): boolean => ms >= t0 && ms < t1;

const r1 = (x: number): number => Math.round(x * 10) / 10;
const r2 = (x: number): number => Math.round(x * 100) / 100;
const mean = (xs: readonly number[]): number | null => (xs.length ? r2(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const line = (label: string, xs: readonly number[]): void => {
  const above = xs.filter((x) => x > 0).length;
  const below = xs.filter((x) => x < 0).length;
  console.log(
    `${label.padEnd(58)} n=${String(xs.length).padStart(5)}  mean ${String(mean(xs)).padStart(6)}  median ${String(median(xs)).padStart(5)}  above/zero/below ${above}/${xs.length - above - below}/${below}`,
  );
};

// 1. The sample as summarised: every report, to the tenth.
const runs = orderedRuns(loadSurfaceWindRecords(sampleFiles)).filter((r) => inWindow(Date.parse(r.at)));
const { pairs } = pairsVsMetar(runs, 'omHourly');
const all = pairs.filter((p) => p.fc.spd != null && p.obs.spd != null);
line(`sample, every report, to the tenth (${from} to ${to})`, all.map((p) => r1(p.fc.spd! - p.obs.spd!)));

// 2. The same pairs on the archive's rule: the report nearest a whole hour
// within REPORT_WINDOW_MIN of it, one per hour, forecast rounded.
const sampleByHour = new Map<number, { t: number; spd: number; gust: number | null; dir: number | null; fcSpd: number }[]>();
for (const p of all) {
  const t = Date.parse(p.obsAt);
  const h = Math.round(t / MS_H) * MS_H;
  if (Math.abs(t - h) > REPORT_WINDOW_MIN * 60_000) continue;
  sampleByHour.set(h, [...(sampleByHour.get(h) ?? []), { t, spd: p.obs.spd!, gust: p.obs.gust ?? null, dir: p.obs.dir ?? null, fcSpd: p.fc.spd! }]);
}
const hourly = new Map<number, { obsSpd: number; fcSpd: number }>();
for (const [h, list] of sampleByHour) {
  const near = reportNear(list, h);
  if (near) hourly.set(h, { obsSpd: near.spd, fcSpd: near.fcSpd });
}
const hours = [...hourly.keys()].sort((a, b) => a - b);
line('sample, one report per hour, to the tenth', hours.map((h) => r1(hourly.get(h)!.fcSpd - hourly.get(h)!.obsSpd)));
line('sample, one report per hour, forecast rounded to the knot', hours.map((h) => Math.round(hourly.get(h)!.fcSpd) - hourly.get(h)!.obsSpd));

// 3. The archive's start of run on those hours, as the page pairs it
// (`reportNear` over every report on file, `windDiffs`), and on the same
// reports the sample saw, to show the two report sets are the same.
const latest = new Map<number, OmWindRecord>();
for (const r of loadOmWindRecords(omFiles)) {
  if (r.run !== 'historical') continue;
  const t = Date.parse(r.valid);
  if (!inWindow(t)) continue;
  const had = latest.get(t);
  latest.set(t, had ? { ...r, spd: r.spd ?? had.spd } : r);
}
const byHour = reportsByHour(loadKpmvReports(reportFiles));
const pageDiffs: number[] = [];
for (const [t, r] of latest) {
  const obs = reportNear(byHour.get(t) ?? [], t);
  if (!obs || r.spd == null) continue;
  const d = windDiffs({ fc: { windSpeed: r.spd }, obs });
  if (d.speed != null) pageDiffs.push(d.speed);
}
line('archive start of run, every hour on file, as the page pairs it', pageDiffs);
const both = hours.filter((h) => latest.get(h)?.spd != null);
line('archive start of run, the sample\'s hours, forecast rounded', both.map((h) => Math.round(latest.get(h)!.spd!) - hourly.get(h)!.obsSpd));
line('archive start of run, the sample\'s hours, to the tenth', both.map((h) => r1(latest.get(h)!.spd! - hourly.get(h)!.obsSpd)));

// 4. Forecast against forecast, no report involved.
const fcDiffs = both.map((h) => r1(hourly.get(h)!.fcSpd - latest.get(h)!.spd!));
line('live hourly value minus archive start of run, same hour', fcDiffs);
const same = fcDiffs.filter((d) => d === 0).length;
const within = fcDiffs.filter((d) => Math.abs(d) <= 0.5).length;
console.log(`  equal to the tenth in ${same} of ${both.length}; within 0.5 kt in ${within}; |diff| median ${median(fcDiffs.map(Math.abs))}, p90 ${p(fcDiffs.map(Math.abs), 0.9)}`);
// By hour of day (UTC), since the archive's lean was read as day/night.
const byUtcHour = new Map<number, number[]>();
for (const h of both) {
  const hh = new Date(h).getUTCHours();
  byUtcHour.set(hh, [...(byUtcHour.get(hh) ?? []), r1(hourly.get(h)!.fcSpd - latest.get(h)!.spd!)]);
}
const night = both.filter((h) => { const hh = new Date(h).getUTCHours(); return hh >= 1 && hh <= 12; });
const day = both.filter((h) => !night.includes(h));
line('  of which 01Z to 12Z (night, as the archive doc splits it)', night.map((h) => r1(hourly.get(h)!.fcSpd - latest.get(h)!.spd!)));
line('  of which 13Z to 00Z (day)', day.map((h) => r1(hourly.get(h)!.fcSpd - latest.get(h)!.spd!)));

function p(xs: readonly number[], q: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}
