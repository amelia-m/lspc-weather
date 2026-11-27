/**
 * Open-Meteo's two cloud-cover figures for the drop zone, the default model's
 * and the RRFS's, hour by hour against what KPMV reported.
 *
 * Reads only files on disk and makes no network request:
 *   - data/parity/parity-logs-<day>.jsonl.gz from 2026-11-20 on (the task's
 *     scope), through the repository's own parseParityLines;
 *   - KPMV's reports from IEM's ASOS archive as a CSV (the request
 *     scripts/cloudCoverFetch.py builds in metar_records, format=onlycomma)
 *     and a note of the URL and fetch time, kept under data/parity/ as
 *     rrfs-cloud-kpmv-metar-<span>.csv and .fetch.json.
 * Writes the reading it is told to and prints the same counts.
 *
 * Every reading of a report is the repository's: parseSkyGroups (normalize.ts)
 * for the sky groups, observedCoverBelow and isCeiling (cloudCoverSources.ts)
 * for "ceiling or none", reportNear and its REPORT_WINDOW_MIN for the pairing,
 * CEILING_EIGHTHS for the 62.5% line. Counts and a table, no grade.
 *
 * The first reading (2026-11-27, 13 paired hours):
 *   npx tsx scripts/rrfsCloudVsKpmv.ts data/parity/rrfs-cloud-kpmv-metar-2026-11-24-to-2026-11-26.csv \
 *     data/parity/rrfs-cloud-kpmv-metar-2026-11-24-to-2026-11-26.fetch.json \
 *     data/parity/rrfs-cloud-vs-kpmv-2026-11-27.md
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_RUN_DOMAIN,
  parityRecordKey,
  parseParityLines,
  validHourOf,
  type CloudPct,
  type ParityRecord,
  type SchulzeRecord,
} from '../src/domain/paritySummary';
import {
  CEILING_EIGHTHS,
  REPORT_WINDOW_MIN,
  isCeiling,
  observedCoverBelow,
  reportNear,
  stationReports,
  type MetarRecord,
  type ObservedCover,
} from '../src/domain/cloudCoverSources';
import { parseSkyGroups } from '../src/domain/normalize';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const PARITY_DIR = join(REPO, 'data', 'parity');
// The reports, their fetch note and the reading are named on the command
// line, so a later reading is a new dated file beside this one's.
const [IEM_CSV, IEM_META, REPORT] = process.argv.slice(2);
if (!IEM_CSV || !IEM_META || !REPORT) {
  console.error('usage: rrfsCloudVsKpmv.ts <KPMV reports csv> <its fetch note json> <report to write, md>');
  process.exit(2);
}
/** The first archive day read: the RRFS was first logged on 2026-11-24. */
const FIRST_FILE_DAY = '2026-11-20';
const LINE_PCT = CEILING_EIGHTHS * 12.5;
const BANDS = ['total', 'low', 'mid', 'high'] as const;
type Band = (typeof BANDS)[number];
const MODELS = ['rrfs', 'default'] as const;
type Model = (typeof MODELS)[number];
const MODEL_NAME: Record<Model, string> = { rrfs: 'RRFS', default: 'Default' };

const fail = (msg: string): never => {
  console.error(`rrfsCloudVsKpmv: ${msg}`);
  process.exit(1);
};

const iso = (t: number): string => new Date(t).toISOString().slice(0, 16).replace('T', ' ') + 'Z';

// ---- The archives -------------------------------------------------------

const files = readdirSync(PARITY_DIR)
  .map((name) => ({ name, day: /^parity-logs-(\d{4}-\d{2}-\d{2})\.jsonl\.gz$/.exec(name)?.[1] }))
  .filter((f): f is { name: string; day: string } => f.day != null && f.day >= FIRST_FILE_DAY)
  .sort((a, b) => a.day.localeCompare(b.day));
if (files.length === 0) fail(`no parity-logs files from ${FIRST_FILE_DAY} on in ${PARITY_DIR}`);

let nonEmptyLines = 0;
let parsedRecords = 0;
const byKey = new Map<string, ParityRecord>();
let repeatedKeys = 0;
for (const f of files) {
  const text = gunzipSync(readFileSync(join(PARITY_DIR, f.name))).toString('utf8');
  nonEmptyLines += text.split('\n').filter((l) => l.trim() !== '').length;
  const records = parseParityLines(text);
  parsedRecords += records.length;
  for (const r of records) {
    const k = parityRecordKey(r);
    if (byKey.has(k)) repeatedKeys++;
    else byKey.set(k, r);
  }
}
const schulze = [...byKey.values()].filter((r): r is SchulzeRecord => r.kind === 'schulze');
const withRrfs = schulze.filter((r) => r.rrfs != null);
const noCloud = withRrfs.filter((r) => r.rrfs!.cloud == null);
const withCloud = withRrfs.filter((r) => r.rrfs!.cloud != null);

// One hour per (valid hour, RRFS run init), the later record kept.
interface Hour {
  t: number;
  runInit: string | null;
  record: SchulzeRecord;
}
const hourByKey = new Map<string, Hour>();
const dropped: { kept: string; dropped: string; t: number; runInit: string | null }[] = [];
for (const record of [...withCloud].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
  const t = validHourOf(record);
  const runInit = record.rrfs!.run?.init ?? null;
  const key = `${t}|${runInit ?? 'run not logged'}`;
  const prior = hourByKey.get(key);
  if (prior) dropped.push({ kept: record.at, dropped: prior.record.at, t, runInit });
  hourByKey.set(key, { t, runInit, record });
}
const hours = [...hourByKey.values()].sort((a, b) => a.t - b.t || Date.parse(a.record.at) - Date.parse(b.record.at));
const validHoursSeenTwice = hours.length - new Set(hours.map((h) => h.t)).size;

// ---- KPMV's reports -----------------------------------------------------

const meta = JSON.parse(readFileSync(IEM_META, 'utf8')) as { url: string; fetchedUtc: string; firstDay: string; lastDay: string };
const csv = readFileSync(IEM_CSV, 'utf8').split('\n').filter((l) => l.trim() !== '');
if (csv[0] !== 'station,valid,metar') fail(`unexpected header in ${IEM_CSV}: ${csv[0]}`);
// As metar_records in scripts/cloudCoverFetch.py reads a line: station, time, text.
const metars: MetarRecord[] = csv.slice(1).map((line) => {
  const a = line.indexOf(',');
  const b = line.indexOf(',', a + 1);
  if (a < 0 || b < 0) fail(`unreadable line in ${IEM_CSV}: ${line}`);
  return { src: 'metar', obsAt: line.slice(a + 1, b).replace(' ', 'T') + 'Z', raw: line.slice(b + 1) };
});
if (metars.length === 0) fail(`no reports in ${IEM_CSV}`);

interface Report {
  t: number;
  raw: string;
  obs: ObservedCover | null;
}
const reports: Report[] = metars
  .map((r) => ({ t: Date.parse(r.obsAt), raw: r.raw, obs: observedCoverBelow(parseSkyGroups(r.raw), Infinity) }))
  .filter((r) => Number.isFinite(r.t))
  .sort((a, b) => a.t - b.t);
// The instrument checked against the repository's one place a METAR becomes a cover.
const viaRepo = stationReports(metars);
if (viaRepo.length !== reports.length || viaRepo.some((r, i) => r.t !== reports[i].t || r.obs?.category !== reports[i].obs?.category)) {
  fail('the reports read here differ from stationReports()');
}
// The file must cover every logged hour's day, or an unpaired hour would be the file's fault.
const dayOf = (t: number): string => new Date(t).toISOString().slice(0, 10);
for (const h of hours) {
  if (dayOf(h.t) < meta.firstDay || dayOf(h.t) > meta.lastDay) {
    fail(`the IEM file covers ${meta.firstDay} to ${meta.lastDay}, not ${iso(h.t)}; fetch the wider span`);
  }
}

/** The sky groups as the METAR text has them: the body's tokens that the
 *  repository's parseSkyGroups reads as a sky group. */
const skyText = (raw: string): string =>
  raw
    .split(' RMK ')[0]
    .split(/\s+/)
    .filter((tok) => parseSkyGroups(tok).length === 1)
    .join(' ');

// ---- Pairing and counting -----------------------------------------------

interface Row extends Hour {
  report: Report | null;
  cloud: { rrfs: CloudPct; default: CloudPct };
}
const rows: Row[] = hours.map((h) => ({ ...h, report: reportNear(reports, h.t), cloud: h.record.rrfs!.cloud! }));
const noReport = rows.filter((r) => r.report == null);
const noSky = rows.filter((r) => r.report != null && r.report.obs == null);
const paired = rows.filter((r) => r.report?.obs != null);
const ceilingRows = paired.filter((r) => isCeiling(r.report!.obs!.category));
const noCeilingRows = paired.filter((r) => !isCeiling(r.report!.obs!.category));
const nullBands = rows.flatMap((r) =>
  MODELS.flatMap((m) => BANDS.filter((b) => r.cloud[m][b] == null).map((b) => `${iso(r.t)} ${MODEL_NAME[m]} ${b}`)),
);

// The acceptance sums, checked, not only printed.
if (withRrfs.length !== withCloud.length + noCloud.length) fail('records with rrfs do not add up');
if (withCloud.length !== hours.length + dropped.length) fail('cloud pairs, distinct hours and duplicates do not add up');
if (hours.length !== paired.length + noReport.length + noSky.length) fail('distinct hours, paired and left out do not add up');
if (paired.length !== ceilingRows.length + noCeilingRows.length) fail('paired hours do not split into ceiling and none');

/** Of `group`, the hours with the model's band served, and those at or above the line. */
const atOrAbove = (group: readonly Row[], m: Model, b: Band): { n: number; hit: number } => {
  const xs = group.map((r) => r.cloud[m][b]).filter((x): x is number => x != null);
  return { n: xs.length, hit: xs.filter((x) => x >= LINE_PCT).length };
};
const exactly = (group: readonly Row[], m: Model, pct: number): number => group.filter((r) => r.cloud[m].total === pct).length;

// ---- The report ---------------------------------------------------------

const pct = (x: number | null): string => (x == null ? 'null' : String(x));
const ageH = (init: string | null | undefined, t: number): string => {
  const i = init ? Date.parse(init) : Number.NaN;
  return Number.isFinite(i) ? String(Math.round((t - i) / 360_000) / 10) : 'not logged';
};
const frac = (x: { n: number; hit: number }): string => `${x.hit} of ${x.n}`;

const out: string[] = [];
out.push('# Open-Meteo cloud cover, RRFS and default, against KPMV reports');
out.push('');
out.push('Weather data by [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0): the model percentages below are its figures as logged by this repository\'s comparison runs. Station reports from the Iowa Environmental Mesonet\'s ASOS archive.');
out.push('');
out.push('Counts and a table only. Nothing here says which model is nearer; that reading is the maintainer\'s.');
out.push('');
out.push('## Sources');
out.push('');
out.push(`- Logged hours: ${files.length} archive files, \`data/parity/${files[0].name}\` to \`${files[files.length - 1].name}\`, read with \`parseParityLines\`.`);
out.push(`- KPMV reports: one request, fetched ${meta.fetchedUtc} (UTC), ${reports.length} reports from ${iso(reports[0].t)} to ${iso(reports[reports.length - 1].t)}:`);
out.push(`  \`${meta.url}\``);
out.push('');
out.push('## How each figure was read');
out.push('');
out.push(`- Valid hour: \`validHourOf(record)\`. Paired report: \`reportNear\`, the report nearest the hour within ${REPORT_WINDOW_MIN} minutes either side (\`REPORT_WINDOW_MIN\`), a tie going to the earlier.`);
out.push('- Sky groups: the tokens of the METAR body (before `RMK`) that `parseSkyGroups` reads as a sky group, printed as the text has them.');
out.push('- Ceiling or none: `isCeiling(observedCoverBelow(layers, Infinity).category)`, the report\'s highest-ranked layer. BKN, OVC and VV are a ceiling (`CEILING_COVERS`); CLR, FEW and SCT are not. A vertical visibility (VV) is therefore read as a ceiling, 8/8, as the repository\'s cloud-cover comparison reads it.');
out.push(`- The line: ${LINE_PCT}% (\`CEILING_EIGHTHS\` × 12.5, 5/8 of the sky, the least a broken layer covers), "at or above", the same line \`cloudCoverSources.ts\` holds a forecast percentage to against a reported ceiling.`);
out.push('- An hour is counted once per distinct (valid hour, RRFS run initialisation), the later record kept.');
out.push('');
out.push('## Limits that bear on every row');
out.push('');
out.push('- KPMV is an automated station and reports cloud only up to 12,000 ft AGL: `CLR` means no cloud below 12,000 ft, not a clear sky. A model total made of high cloud is not contradicted by `CLR`. Open-Meteo\'s low band is cloud below 3 km and its mid band 3 to 8 km, so the band comparable with the station is mostly low and part of mid; the mid and high columns are printed so a total can be read against that. 3 km is about 9,800 ft, so by that description a reported base of 100 (10,000 ft AGL) or higher sits in the mid band and a lower one in the low band; the low band\'s limit is as the repository\'s docs/cloud-cover-sources.md gives it ("up to 3 km") and the mid band\'s 3 to 8 km as the task stated it, neither read again at Open-Meteo for this report, and whether a model\'s bands are cut by height or by pressure was not checked.');
out.push('- KPMV is about 11 miles from the drop zone\'s grid point; part of any difference is the distance.');
out.push('- The two models were not the same age at an hour. The "run age" columns give hours from each run\'s initialisation to the valid hour, from the run metadata the comparison logged (`rrfs.run.init`, and `omRuns.' + DEFAULT_RUN_DOMAIN + '.init` for the default; that the default answer was served from that run is the comparison\'s assumption, not checked here).');
out.push(`- ${paired.length} hours over ${paired.length > 0 ? `${iso(paired[0].t)} to ${iso(paired[paired.length - 1].t)}` : 'no span'}: a small sample from one spell of weather.`);
out.push('');
out.push('## Accounting');
out.push('');
out.push(`- Non-empty lines in the files: ${nonEmptyLines}. Records \`parseParityLines\` returned: ${parsedRecords} (lines not read as a record: ${nonEmptyLines - parsedRecords}). Records repeated across files and counted once: ${repeatedKeys}.`);
out.push(`- Schulze-comparison records: ${schulze.length}. Of those, with \`rrfs\`: **${withRrfs.length}**; without (before the RRFS was logged, or the default request failed): ${schulze.length - withRrfs.length}.`);
out.push(`- Of the ${withRrfs.length} with \`rrfs\`: with a cloud pair **${withCloud.length}**, no cloud pair logged **${noCloud.length}**.`);
out.push(`- Of the ${withCloud.length} with a cloud pair: dropped as a duplicate (valid hour, RRFS run) **${dropped.length}**, distinct hours **${hours.length}**.`);
out.push(`- Of the ${hours.length} distinct hours: paired with a report that has a sky group **${paired.length}**, no report within the window **${noReport.length}**, report with no sky group **${noSky.length}**.`);
out.push(`- Check: ${withCloud.length} + ${noCloud.length} = ${withRrfs.length}; ${hours.length} + ${dropped.length} = ${withCloud.length}; ${paired.length} + ${noReport.length} + ${noSky.length} = ${hours.length}.`);
out.push(`- Valid hours that appear under two different RRFS runs (each counted): ${validHoursSeenTwice}.`);
out.push('');
out.push('## Hour by hour');
out.push('');
out.push('Percent of sky. "Run age" is hours from the model run\'s initialisation to the valid hour.');
out.push('');
out.push('| Valid hour (UTC) | KPMV report | Sky groups | Ceiling | RRFS total | RRFS low | Default total | Default low | RRFS mid | RRFS high | Default mid | Default high | RRFS run age (h) | Default run age (h) |');
out.push('|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const r of rows) {
  const rep = r.report;
  const sky = rep == null ? 'no report in window' : rep.obs == null ? 'no sky group' : skyText(rep.raw);
  const ceil = rep?.obs == null ? 'left out' : isCeiling(rep.obs.category) ? 'ceiling' : 'none';
  out.push(
    `| ${iso(r.t)} | ${rep ? iso(rep.t) : ''} | ${sky} | ${ceil} | ${pct(r.cloud.rrfs.total)} | ${pct(r.cloud.rrfs.low)} | ${pct(r.cloud.default.total)} | ${pct(r.cloud.default.low)} | ${pct(r.cloud.rrfs.mid)} | ${pct(r.cloud.rrfs.high)} | ${pct(r.cloud.default.mid)} | ${pct(r.cloud.default.high)} | ${ageH(r.runInit, r.t)} | ${ageH(r.record.omRuns?.[DEFAULT_RUN_DOMAIN]?.init, r.t)} |`,
  );
}
out.push('');
out.push('## Counts');
out.push('');
out.push(`Hours paired: **${paired.length}**. KPMV reported a ceiling in **${ceilingRows.length}** and none in **${noCeilingRows.length}**.`);
out.push('');
out.push(`Hours with the model's figure at or above ${LINE_PCT}%, of the hours in the group that have that band:`);
out.push('');
out.push(`| KPMV | Hours | RRFS total | RRFS low | Default total | Default low |`);
out.push('|---|---:|---:|---:|---:|---:|');
for (const [label, group] of [['Ceiling reported (BKN, OVC or VV)', ceilingRows], ['No ceiling reported (CLR, FEW or SCT)', noCeilingRows]] as const) {
  out.push(`| ${label} | ${group.length} | ${frac(atOrAbove(group, 'rrfs', 'total'))} | ${frac(atOrAbove(group, 'rrfs', 'low'))} | ${frac(atOrAbove(group, 'default', 'total'))} | ${frac(atOrAbove(group, 'default', 'low'))} |`);
}
out.push('');
out.push('Hours each model\'s total was exactly 100% and exactly 0%:');
out.push('');
out.push('| Model | Paired hours | Exactly 100% | Exactly 0% | All distinct logged hours | Exactly 100% | Exactly 0% |');
out.push('|---|---:|---:|---:|---:|---:|---:|');
for (const m of MODELS) {
  out.push(`| ${MODEL_NAME[m]} | ${paired.length} | ${exactly(paired, m, 100)} | ${exactly(paired, m, 0)} | ${rows.length} | ${exactly(rows, m, 100)} | ${exactly(rows, m, 0)} |`);
}
out.push('');
out.push('## Left out, and listed');
out.push('');
out.push(`Records with \`rrfs\` and no cloud pair logged (${noCloud.length}):`);
out.push('');
for (const r of noCloud) out.push(`- run at ${r.at}, hour ${r.appHour ?? 'not logged'}${r.rrfs!.error ? `, rrfs error: ${r.rrfs!.error}` : ', no `rrfs.cloud` on the record'}`);
if (noCloud.length === 0) out.push('- none');
out.push('');
out.push(`Records dropped as a second log of the same (valid hour, RRFS run) (${dropped.length}):`);
out.push('');
for (const d of dropped) out.push(`- valid ${iso(d.t)}, RRFS run ${d.runInit ?? 'not logged'}: dropped the run at ${d.dropped}, kept the run at ${d.kept}`);
if (dropped.length === 0) out.push('- none');
out.push('');
out.push(`Hours with no KPMV report within ${REPORT_WINDOW_MIN} minutes (${noReport.length}):`);
out.push('');
for (const r of noReport) {
  // The neighbours are named so the gap can be seen; they are not counted.
  const before = [...reports].reverse().find((x) => x.t < r.t);
  const after = reports.find((x) => x.t > r.t);
  const side = (x: Report | undefined): string => (x ? `${iso(x.t)} ${skyText(x.raw) || 'no sky group'}` : 'none in the file');
  out.push(`- ${iso(r.t)}: the nearest reports in the file are ${side(before)} before and ${side(after)} after, both outside the window and not counted`);
}
if (noReport.length === 0) out.push('- none');
out.push('');
out.push(`Hours whose paired report has no sky group (${noSky.length}):`);
out.push('');
for (const r of noSky) out.push(`- ${iso(r.t)}: \`${r.report!.raw}\``);
if (noSky.length === 0) out.push('- none');
out.push('');
out.push(`Null bands, skipped for that band only (${nullBands.length}):`);
out.push('');
for (const s of nullBands) out.push(`- ${s}`);
if (nullBands.length === 0) out.push('- none');
out.push('');
out.push('## The paired reports in full');
out.push('');
for (const r of rows) if (r.report) out.push(`- ${iso(r.t)}: \`${r.report.raw}\``);
out.push('');

const text = out.join('\n');
if (text.includes(String.fromCharCode(0x2014))) fail('the report holds an em dash');
writeFileSync(REPORT, text);
console.log(text);
console.log(`wrote ${REPORT}`);
