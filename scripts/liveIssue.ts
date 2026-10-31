/**
 * Turn a live run's Vitest JSON report into the issues the workflow opens:
 * one file per failed check under <out dir>, `<label>.json` with the
 * label, its description, a title and a body (src/domain/liveIssue.ts).
 *
 *   npx tsx scripts/liveIssue.ts <report.json> <run url> <out dir>
 *
 * A report that is not there (the run failed before the checks started)
 * still yields one issue, so the failure is not silent. Prints each
 * label written.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { liveIssues, type VitestJsonReport } from '../src/domain/liveIssue';

const [reportPath, runUrl, outDir] = process.argv.slice(2);
if (!reportPath || !runUrl || !outDir) {
  console.error('usage: tsx scripts/liveIssue.ts <report.json> <run url> <out dir>');
  process.exit(2);
}
const report: VitestJsonReport | null = existsSync(reportPath)
  ? (JSON.parse(readFileSync(reportPath, 'utf8')) as VitestJsonReport)
  : null;
const date = new Date().toISOString().slice(0, 10);
mkdirSync(outDir, { recursive: true });
for (const issue of liveIssues(report, { url: runUrl, date })) {
  writeFileSync(join(outDir, `${issue.label}.json`), JSON.stringify(issue, null, 2));
  console.log(issue.label);
}
