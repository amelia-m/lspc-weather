/**
 * Keep the comparison logs past their artifacts' fourteen days: write every
 * `@@parity` record in the fresh logs that no archive under data/parity/
 * holds yet into one gzipped archive, oldest first (unarchivedLines,
 * src/domain/paritySummary.ts). Run daily by parity-summary.yml before it
 * combines the summary, and the #parity page then reads the archives with
 * the artifacts. Without it, everything after the sampler's archive
 * (2026-10-05) dropped off the page and out of reach a day at a time.
 *
 *   npx tsx scripts/parityArchive.ts --fresh logs/*.jsonl \
 *     --archives data/parity/*logs-*.jsonl.gz --out data/parity/parity-logs-<day>.jsonl.gz
 *
 * An archive file named in --out that already exists (a second run the same
 * day) keeps its lines, and the new ones are merged in by run time.
 *
 * Comparison-log archives are named `*logs-*.jsonl.gz` (logs-to-2026-10-05,
 * schulze-logs-…, parity-logs-<day>): the summary workflow reads those
 * and no other file under data/parity/, which also holds large forecast
 * archives. An archive named otherwise is invisible to both the page and
 * this script.
 *
 * Prints how many records it added; writes nothing when there are none.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { mergeArchiveLines, unarchivedLines } from '../src/domain/paritySummary';

const args: Record<string, string[]> = {};
let flag = '';
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) args[(flag = a.slice(2))] = [];
  else if (flag) args[flag].push(a);
}
const [out] = args.out ?? [];
if (!out || !args.fresh) {
  console.error('usage: parityArchive.ts --fresh <logs…> [--archives <archives…>] --out <file.jsonl.gz>');
  process.exit(2);
}

const read = (f: string): string => {
  const buf = readFileSync(f);
  return (f.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8');
};

// The out file is read once, as an archive like the others and as the
// lines it keeps.
const existing = existsSync(out) ? read(out) : '';
const archived = [...new Set(args.archives ?? [])].filter((f) => f !== out).map(read).join('\n') + '\n' + existing;
const added = unarchivedLines(args.fresh.map(read).join('\n'), archived);
if (added.length) {
  writeFileSync(out, gzipSync(mergeArchiveLines(existing, added).join('\n') + '\n', { level: 9 }));
}
console.log(`${added.length} records added to ${out}`);
