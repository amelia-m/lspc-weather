/**
 * The kept NWS gridpoint forecasts against KPMV's reports: wind, gust,
 * direction, temperature, visibility and rainfall
 * (docs/kept-forecasts-vs-kpmv.md). Usage:
 *
 *   git fetch origin forecast-archive
 *   git worktree add --detach <dir> origin/forecast-archive
 *   npx tsx scripts/keptForecastsVsKpmv.ts <dir>/data data/parity/metar-*.jsonl.gz
 *
 * The first argument is a folder of kept snapshots (`.json.gz`, searched
 * recursively); the rest are METAR record files (`.jsonl` or `.jsonl.gz`,
 * `{src: 'metar', obsAt, raw}` lines, KPMV's only). Prints the summary as
 * text, then as JSON. The arithmetic is src/domain/keptForecasts.ts (pure,
 * tested); this file only reads files and prints. Spreads and counts, never
 * a grade.
 */
import { summarizeInstants, summarizeRain } from '../src/domain/keptForecasts';
import type { Spread } from '../src/domain/paritySummary';
import { loadKeptSnapshots, loadKpmvReports } from './keptInputs';

const [keptDir, ...metarFiles] = process.argv.slice(2);
if (!keptDir || metarFiles.length === 0) {
  console.error('usage: keptForecastsVsKpmv.ts <kept snapshots dir> <metar jsonl[.gz]>...');
  process.exit(2);
}

const snaps = loadKeptSnapshots(keptDir);
const metars = loadKpmvReports(metarFiles);

const instants = summarizeInstants(snaps, metars);
const rain = summarizeRain(snaps, metars);

const sp = (x: Spread | null, unit: string): string =>
  x == null
    ? '—'
    : `signed mean ${x.mean} ${unit}, median |d| ${x.medianAbs}, p90 |d| ${x.p90Abs}, max |d| ${x.maxAbs} (n ${x.n})`;
const out: string[] = [];
const ok = snaps.filter((s) => s.nwsGridpoint && !('error' in s.nwsGridpoint));
out.push(`${snaps.length} snapshots (${ok.length} with the gridpoint), ${snaps.map((s) => s.at).sort()[0]} to ${snaps.map((s) => s.at).sort().at(-1)}`);
out.push(`${metars.length} reports, ${metars[0]?.obsAt} to ${metars.at(-1)?.obsAt}`);
for (const r of instants) {
  out.push('', `## ${r.label}: ${r.hours} hours, ${r.first} to ${r.last}, lead ${r.leadH?.min}–${r.leadH?.max} h`);
  out.push(`speed (kt, forecast − reported): ${sp(r.speed, 'kt')}; means ${r.speedMeans?.fc} vs ${r.speedMeans?.obs}`);
  out.push(`  by UTC hour: ${r.speedByUtcHour.map((h) => `${h.hour}:${h.mean}`).join(' ')}`);
  out.push(`gust, reported (${r.gustReported.hours} of ${r.gustReported.of} hours): ${sp(r.gustWhenReported, 'kt')}`);
  out.push(`  forecast above / equal / below: ${r.gustSide.above} / ${r.gustSide.equal} / ${r.gustSide.below}`);
  out.push(`gust, none reported, forecast gust − reported speed: ${sp(r.gustWhenNone, 'kt')}`);
  out.push(`direction, reported under 10 kt: ${sp(r.direction.under10kt, '°')}`);
  out.push(`direction, reported 10 kt or more: ${sp(r.direction.from10kt, '°')}`);
  out.push(`temperature (°C): ${sp(r.temperature, '°C')}`);
  out.push(`  by UTC hour: ${r.temperatureByUtcHour.map((h) => `${h.hour}:${h.mean}`).join(' ')}`);
  const v = r.visibility;
  out.push(
    `visibility under 10 SM: reported ${v.reportedUnder}, forecast ${v.forecastUnder}, both ${v.bothUnder}; ${sp(v.spread, 'SM')}`,
  );
}
out.push('', '## Rainfall, six-hour periods (in.)');
for (const r of rain) {
  const wet = r.periods.filter((p) => p.fc > 0 || p.obs > 0);
  out.push(`${r.label}: ${r.periods.length} periods, forecast ${r.fcTotal} vs measured ${r.obsTotal}`);
  for (const p of wet) out.push(`  ${p.start}: forecast ${p.fc}, measured ${p.obs} (issued ${p.issued})`);
}
console.log(out.join('\n'));
console.log(JSON.stringify({ instants: instants, rain }));
