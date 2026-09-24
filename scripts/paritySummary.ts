/**
 * Combine the live comparison logs into public/parity/summary.json.
 *
 * Run by .github/workflows/parity-summary.yml: it downloads every recent run's
 * @@parity lines (uploaded as artifacts by the comparison workflows), passes
 * the files here, and commits the result beside the site so the #parity page
 * can read it. Usage: `npx tsx scripts/paritySummary.ts logs/*.jsonl > summary.json`.
 * With no files it writes an empty summary, which the page shows as such.
 *
 * All the arithmetic is in src/domain/paritySummary.ts (pure, tested); this
 * file only reads files and prints JSON.
 */
import { readFileSync } from 'node:fs';
import { parseParityLines, summarizeParity, type ParityRecord } from '../src/domain/paritySummary';

const records: ParityRecord[] = [];
for (const file of process.argv.slice(2)) {
  records.push(...parseParityLines(readFileSync(file, 'utf8')));
}
// One record per run and kind: a re-run of the same workflow run uploads the
// same lines again, and a duplicate would double-count it.
const seen = new Set<string>();
const unique = records.filter((r) => {
  const key = `${r.kind}|${r.at}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
process.stdout.write(JSON.stringify(summarizeParity(unique, Date.now()), null, 2) + '\n');
