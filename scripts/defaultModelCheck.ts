/**
 * Say, from the surface-wind sampler's records, whether Open-Meteo's default
 * model for the drop zone changed yesterday: the sampler asks the default,
 * the HRRR by name and the RRFS by name each run and records whether the
 * numbers were the same (`om.sameAsHrrr`, `om.sameAsRrfs`). Run daily by
 * parity-summary.yml, which opens one issue from the notice this writes.
 *
 *   npx tsx scripts/defaultModelCheck.ts --logs data/parity/surfacewind-*.jsonl.gz swlogs/*.jsonl --out model-switch.json
 *
 * Prints the last seven days. Writes --out only on the first day the change
 * shows (`defaultModelNotice`, src/domain/surfaceWindSources.ts, pure and
 * tested); writes nothing otherwise. Never fails the workflow it runs in:
 * a file it cannot read is named and skipped.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import {
  defaultModelByDay,
  defaultModelNotice,
  parseSurfaceWindLines,
  type SurfaceWindRecord,
} from '../src/domain/surfaceWindSources';

const args: Record<string, string[]> = {};
let flag = '';
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) args[(flag = a.slice(2))] = [];
  else if (flag) args[flag].push(a);
}
const [out] = args.out ?? [];
if (!out || !args.logs?.length) {
  console.error('usage: defaultModelCheck.ts --logs <files…> --out <notice.json>');
  process.exit(2);
}

const records: SurfaceWindRecord[] = [];
for (const f of args.logs) {
  try {
    const buf = readFileSync(f);
    records.push(...parseSurfaceWindLines((f.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8')));
  } catch (e) {
    console.log(`could not read ${f}: ${(e as Error).message}`);
  }
}
const days = defaultModelByDay(records);
const today = new Date().toISOString().slice(0, 10);
console.log(`${records.length} records, ${days.length} days; today is ${today} (UTC)`);
for (const d of days.slice(-7)) {
  console.log(
    `${d.day}: differed from the HRRR ${d.notHrrr} of ${d.hrrrCompared}; same as the RRFS ${d.isRrfs} of ${d.rrfsCompared}` +
      (d.switched ? '; reads as switched' : ''),
  );
}
const notice = defaultModelNotice(days, today);
if (notice) {
  writeFileSync(out, JSON.stringify(notice));
  console.log(`notice written to ${out}: ${notice.title}`);
} else {
  console.log('no notice: the default did not change on the last whole day, or the change was already raised');
}
