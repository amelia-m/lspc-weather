/**
 * The steps of .github/workflows/ceiling-data-refresh.yml that need more
 * than a shell line: the archive files to build from, the days to fetch,
 * whether a fetch brought anything new, and whether the regenerated data
 * file holds at least what the published one does. The rules are
 * src/domain/ceilingRefresh.ts (pure, tested); this file reads the disk.
 * docs/ceiling-heights.md, "The chart", says why each is as it is.
 *
 *   npx tsx scripts/ceilingRefresh.ts inputs ceiling|cover [--dir data/parity]
 *     The files for ceilingChartData.ts's --ceiling or --cover, one a line,
 *     with their folder.
 *   npx tsx scripts/ceilingRefresh.ts window [--dir data/parity] [--now <ISO>]
 *     key=value lines for $GITHUB_OUTPUT: each part's start and end, the
 *     newest record already kept, skip=true when none needs a fetch, and
 *     om_wind_missing=true when the Open-Meteo wind archive holds nothing.
 *   npx tsx scripts/ceilingRefresh.ts fetched ceiling|metar|omwind <file> --since <ISO> --start <day> --end <day>
 *     Exits 1 unless the file holds a record newer than --since.
 *   npx tsx scripts/ceilingRefresh.ts check <published.json> <new.json>
 *     Exits 1 if the new file holds less than the published one.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parseCeilingLines } from '../src/domain/ceilingHeights';
import {
  chartInputs,
  type ChartData,
  fetchCoverage,
  newest,
  omWindNewest,
  refreshWindow,
  shrinkage,
} from '../src/domain/ceilingRefresh';
import { parseCloudCoverLines } from '../src/domain/cloudCoverSources';
import { OM_ARCHIVE_ROWS, parseOmWindLines } from '../src/domain/windErrors';

const [cmd, ...rest] = process.argv.slice(2);
const opts: Record<string, string> = {};
const pos: string[] = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) opts[rest[i].slice(2)] = rest[++i];
  else pos.push(rest[i]);
}
const dir = opts.dir ?? 'data/parity';

const fail = (msg: string): never => {
  console.error(msg);
  process.exit(1);
};

const read = (f: string): string => {
  const buf = readFileSync(f);
  return (f.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8');
};

/** When each NDFD ceiling issuance in the files was made. */
const issuedTimes = (files: string[]): string[] => files.flatMap((f) => parseCeilingLines(read(f)).map((r) => r.issued));

/** KPMV's reports in the files: the drop zone's, with no `site`, as the
 *  chart reads them. */
const reportTimes = (files: string[]): string[] =>
  files.flatMap((f) =>
    parseCloudCoverLines(read(f)).flatMap((r) => (r.src === 'metar' && r.site == null ? [r.obsAt] : [])),
  );

/** Open-Meteo's archived wind (data/parity/om-wind-*), the #wind-errors
 *  page's, not the chart's. */
const omWindFiles = (): string[] =>
  readdirSync(dir)
    .filter((n) => /^om-wind-.*\.jsonl\.gz$/.test(n))
    .sort()
    .map((n) => join(dir, n));
const omWindRecords = (files: string[]) => files.flatMap((f) => parseOmWindLines(read(f)));
const OM_RUNS = OM_ARCHIVE_ROWS.map((r) => r.run);

const inputs = () => {
  const found = chartInputs(readdirSync(dir));
  return { ceiling: found.ceiling.map((f) => join(dir, f)), cover: found.cover.map((f) => join(dir, f)) };
};

if (cmd === 'inputs') {
  const kind = pos[0];
  if (kind !== 'ceiling' && kind !== 'cover') fail('usage: ceilingRefresh.ts inputs ceiling|cover');
  const files = inputs()[kind as 'ceiling' | 'cover'];
  if (!files.length) fail(`no ${kind} archives under ${dir}`);
  console.log(files.join('\n'));
} else if (cmd === 'window') {
  const now = opts.now ? new Date(opts.now) : new Date();
  if (Number.isNaN(now.getTime())) fail(`not a time: ${opts.now}`);
  const files = inputs();
  const lastIssued = newest(issuedTimes(files.ceiling));
  const lastReport = newest(reportTimes(files.cover));
  const lastOmWind = omWindNewest(omWindRecords(omWindFiles()), OM_RUNS);
  const w = refreshWindow({ lastIssued, lastReport, lastOmWind, now });
  const lines = [
    `end=${w.end}`,
    `ceiling_newest=${lastIssued}`,
    `ceiling_start=${w.ceiling?.start ?? ''}`,
    `fetch_ceiling=${w.ceiling != null}`,
    `metar_newest=${lastReport}`,
    `metar_start=${w.metar?.start ?? ''}`,
    `fetch_metar=${w.metar != null}`,
    `om_wind_newest=${lastOmWind}`,
    `om_wind_start=${w.omWind?.start ?? ''}`,
    `fetch_om_wind=${w.omWind != null}`,
    `om_wind_missing=${w.omWindMissing}`,
    `skip=${w.ceiling == null && w.metar == null && w.omWind == null}`,
  ];
  console.log(lines.join('\n'));
  console.error(
    `newest NDFD issuance kept ${lastIssued}, newest KPMV report ${lastReport}, newest Open-Meteo wind hour ${lastOmWind}; ` +
      `ceilings ${w.ceiling ? `${w.ceiling.start} to ${w.ceiling.end}` : 'current'}, ` +
      `reports ${w.metar ? `${w.metar.start} to ${w.metar.end}` : 'current'}, ` +
      `Open-Meteo wind ${w.omWind ? `${w.omWind.start} to ${w.omWind.end}` : 'current'}`,
  );
} else if (cmd === 'fetched') {
  const [part, file] = pos;
  const { since, start, end } = opts;
  if ((part !== 'ceiling' && part !== 'metar' && part !== 'omwind') || !file || !since || !start || !end) {
    fail('usage: ceilingRefresh.ts fetched ceiling|metar|omwind <file> --since <ISO> --start <day> --end <day>');
  }
  const times =
    part === 'ceiling'
      ? issuedTimes([file])
      : part === 'metar'
        ? reportTimes([file])
        : omWindRecords([file]).map((r) => r.valid);
  const { newer, emptyDays } = fetchCoverage(times, since, { start, end });
  const what = part === 'ceiling' ? 'NDFD issuances' : part === 'metar' ? 'KPMV reports' : 'Open-Meteo wind hours';
  const distinct = part === 'metar' ? times.length : new Set(times).size;
  console.error(`${file}: ${distinct} ${what} (${times.length} records), ${newer} records newer than ${since}`);
  // GitHub shows a ::warning:: line on the run's page.
  for (const d of emptyDays) console.log(`::warning::no ${what} for ${d} in ${file}`);
  if (newer === 0) fail(`::error::the ${part} fetch for ${start} to ${end} returned nothing newer than ${since}`);
} else if (cmd === 'check') {
  const [publishedFile, nextFile] = pos;
  if (!publishedFile || !nextFile) fail('usage: ceilingRefresh.ts check <published.json> <new.json>');
  const published = JSON.parse(read(publishedFile)) as ChartData;
  const next = JSON.parse(read(nextFile)) as ChartData;
  const problems = shrinkage(published, next);
  for (const p of problems) console.log(`::error::${p}`);
  if (problems.length) fail(`${nextFile} holds less than ${publishedFile}; not replacing it`);
  console.error(
    `${nextFile}: ${next.reports.count} reports to ${next.reports.span?.to} (published ${published.reports.count} to ${published.reports.span?.to}); ` +
      next.points.map((p) => `${p.site} ${p.rows.map((r) => r.hours).join('/')} h`).join(', '),
  );
} else {
  fail('usage: ceilingRefresh.ts inputs|window|fetched|check …');
}
