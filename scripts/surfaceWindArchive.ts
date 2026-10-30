/**
 * Keep the surface-wind sampler's records past their artifacts' thirty
 * days: write every sample in the fresh logs that no archive under
 * data/parity/ holds yet into one gzipped archive for the month, oldest
 * first (unarchivedSurfaceWindLines, src/domain/surfaceWindSources.ts).
 * Run daily by parity-summary.yml beside the comparison archive; the
 * weekly ceiling data refresh then rebuilds the #wind-errors page's sample
 * section from every data/parity/surfacewind-*.jsonl.gz, so the section
 * keeps growing (the maintainer, 2026-10-30: the sample is to continue
 * over seasons, times of day and kinds of weather).
 *
 *   npx tsx scripts/surfaceWindArchive.ts --fresh swlogs/*.jsonl \
 *     --archives data/parity/surfacewind-*.jsonl.gz --out data/parity/surfacewind-<YYYY-MM>.jsonl.gz
 *
 * An archive named in --out that already exists (the month's later days)
 * keeps its lines, and the new ones are merged in by run time. The parity
 * summary reads only `*logs-*.jsonl.gz`, so these files never feed the
 * #parity page. Prints how many records it added; writes nothing when
 * there are none.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { mergeSurfaceWindLines, unarchivedSurfaceWindLines } from '../src/domain/surfaceWindSources';

const args: Record<string, string[]> = {};
let flag = '';
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) args[(flag = a.slice(2))] = [];
  else if (flag) args[flag].push(a);
}
const [out] = args.out ?? [];
if (!out || !args.fresh) {
  console.error('usage: surfaceWindArchive.ts --fresh <logs…> [--archives <archives…>] --out <file.jsonl.gz>');
  process.exit(2);
}

const read = (f: string): string => {
  const buf = readFileSync(f);
  return (f.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8');
};

const existing = existsSync(out) ? read(out) : '';
const archived = [...new Set(args.archives ?? [])].filter((f) => f !== out).map(read).join('\n') + '\n' + existing;
const added = unarchivedSurfaceWindLines(args.fresh.map(read).join('\n'), archived);
if (added.length) {
  writeFileSync(out, gzipSync(mergeSurfaceWindLines(existing, added).join('\n') + '\n', { level: 9 }));
}
console.log(`${added.length} records added to ${out}`);
