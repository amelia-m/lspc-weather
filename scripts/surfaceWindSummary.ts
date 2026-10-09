/**
 * Summarise a log of surface-wind comparison runs
 * (scripts/surfaceWindCompare.live.ts): how often each source's value
 * changed, how old it was when fetched, and how far each forecast sat from
 * the METAR. Usage:
 *
 *   npx tsx scripts/surfaceWindSummary.ts data/parity/surfacewind-*.log
 *
 * Prints a table, then the summary as JSON. The arithmetic is in
 * src/domain/surfaceWindSources.ts (pure, tested); this file only reads
 * files and prints. Counts and spreads, never a grade.
 */
import { readFileSync } from 'node:fs';
import { parseSurfaceWindLines, summarizeSurfaceWind, type SurfaceWindRecord } from '../src/domain/surfaceWindSources';
import type { Spread } from '../src/domain/paritySummary';

const records: SurfaceWindRecord[] = [];
for (const file of process.argv.slice(2)) records.push(...parseSurfaceWindLines(readFileSync(file, 'utf8')));
const s = summarizeSurfaceWind(records);

const out: string[] = [];
const sp = (x: Spread | null): string =>
  x == null ? '—' : `median ${x.medianAbs}, p90 ${x.p90Abs}, max ${x.maxAbs}, signed mean ${x.mean} (n ${x.n})`;
out.push(`${s.records} runs, ${s.firstAt} to ${s.lastAt}; ${s.metarReports} distinct METAR reports`);
out.push(`errors: ${JSON.stringify(s.errors)}`);
out.push(`current = 15-minute step at its time: ${s.currentIsM15.same} of ${s.currentIsM15.of}`);
out.push(`hourly = 15-minute step at the same hour: ${s.hourlyIsM15.same} of ${s.hourlyIsM15.of}`);
{
  const g = s.hourlyGustVsHourMax;
  out.push(`hourly gust vs the preceding hour's 15-minute maximum: ${g.equal} equal, ${g.below} below, ${g.above} above, of ${g.steps}`);
}
out.push(`default model = HRRR: ${s.defaultIsHrrr.same} of ${s.defaultIsHrrr.of}`);
for (const d of s.defaultIsHrrr.diffs) out.push(`  differed at ${d.at}: up to ${d.dir}°, ${d.spd} kt, gust ${d.gust} kt`);
out.push('', 'Cadence');
for (const c of s.cadence) {
  out.push(
    `  ${c.source.padEnd(10)} shown value changed ${c.shownChanges}/${c.shownPairs} run pairs; ` +
      `interval min median ${c.shownIntervalMin.median ?? '—'} (${c.shownIntervalMin.min ?? '—'}–${c.shownIntervalMin.max ?? '—'}); ` +
      `revisions ${c.revisionChanges}/${c.revisionPairs} valid-time pairs, ${c.revisionReverts} reverts, ${c.revisionDirOnlyByOne} direction-only ±1°, at ${c.revisions.length} runs`,
  );
}
out.push('', 'Staleness (minutes)');
for (const st of s.staleness) {
  out.push(`  ${st.source.padEnd(10)} median ${st.medianMin ?? '—'} (${st.minMin ?? '—'}–${st.maxMin ?? '—'}), n ${st.n}: ${st.basis}`);
}
out.push('', 'Against the METAR (forecast minus observed)');
for (const v of s.vsMetar) {
  out.push(`  ${v.source} (n ${v.n})`);
  out.push(`    speed kt   ${sp(v.spd)}`);
  out.push(`    dir °      ${sp(v.dir)}`);
  out.push(`    gust kt    ${sp(v.gust)}; METAR gusts ${v.metarGusts}, with a forecast gust ${v.forecastGustWhenMetarGust}; forecast gust with no METAR gust ${v.forecastGustWhenMetarNone}`);
}
out.push('', 'Model runs seen (init, availability, first run that saw it)');
for (const [d, runs] of Object.entries(s.modelRuns)) {
  for (const r of runs) out.push(`  ${d.padEnd(24)} ${r.init}  avail ${r.avail}  first seen ${r.firstSeenAt}`);
}
out.push('', 'NWS gridpoint updateTimes (first run that saw each; the hourly product’s updateTime then)');
for (const u of s.nwsUpdates) out.push(`  ${u.updateTime}  first seen ${u.firstSeenAt}  hourly product ${u.hourlyUpdateTime ?? '—'}`);
process.stdout.write(out.join('\n') + '\n\n' + JSON.stringify(s, null, 2) + '\n');
