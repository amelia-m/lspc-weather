/**
 * Summarise a multi-station cloud-cover file (scripts/cloudCoverFetch.py with
 * SITES set): each forecast against each station's own reports, and each
 * AWOS's reports against the nearby ASOS's. Usage:
 *
 *   npx tsx scripts/cloudCoverStations.ts data/parity/cloud-cover-stations-*.jsonl.gz
 *   npx tsx scripts/cloudCoverStations.ts --sites    # the SITES the fetch was given
 *
 * Prints Markdown tables, as docs/cloud-cover-stations.md quotes them. The
 * arithmetic is src/domain/cloudCoverSources.ts and
 * src/domain/stationPairs.ts (pure, tested); this file reads and prints.
 * Counts and spreads, never a grade.
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import {
  NWS_ISSUANCES,
  OBSERVED_CATEGORIES,
  OM_ROWS,
  parseCloudCoverLines,
  summarizeCloudCover,
  type CloudCoverRecord,
  type MetarRecord,
  type VsObserved,
} from '../src/domain/cloudCoverSources';
import { AUTOMATED_TOP_FT, comparePair, stationReports, type StationReport } from '../src/domain/stationPairs';
import { haversineMiles } from '../src/domain/geo';

/** The stations, at the FAA's coordinates (NASR AWOS file, 2026-10-01
 *  cycle), as the fetch read them: `--sites` prints them in the fetch
 *  script's SITES form, so a later fetch (Open-Meteo's, say) reads the same
 *  points. */
const STATIONS: Record<string, [lat: number, lon: number]> = {
  BTA: [41.4148, -96.109], MLE: [41.196, -96.1123], AUH: [40.8941, -97.9946], PMV: [40.9484, -95.9174],
  AHQ: [41.2406, -96.5946], LCG: [42.2416, -96.9823], CSB: [40.307, -100.1602], GGF: [40.8714, -101.7321],
  OMA: [41.3119, -95.9018], GRI: [40.9675, -98.3096], LNK: [40.8509, -96.7591], OFK: [41.9799, -97.4335],
  MCK: [40.204, -100.5904], IML: [40.5104, -101.6201],
};

/** Each AWOS beside the ASOS nearest it. The last two AWOS report FEW; the
 *  first six never did in September 2026. */
const PAIRS: readonly [awos: string, asos: string][] = [
  ['BTA', 'OMA'], ['MLE', 'OMA'], ['AUH', 'GRI'], ['PMV', 'OMA'],
  ['AHQ', 'LNK'], ['LCG', 'OFK'], ['CSB', 'MCK'], ['GGF', 'IML'],
];
const miles = (a: string, b: string): number =>
  Math.round(haversineMiles(STATIONS[a][0], STATIONS[a][1], STATIONS[b][0], STATIONS[b][1]) * 10) / 10;

if (process.argv[2] === '--sites') {
  console.log(Object.entries(STATIONS).map(([id, [lat, lon]]) => `${id}:${lat}:${lon}`).join(','));
  process.exit(0);
}

const records: CloudCoverRecord[] = [];
for (const file of process.argv.slice(2)) {
  const buf = readFileSync(file);
  // One push per record: a spread of half a million overflows the stack.
  for (const r of parseCloudCoverLines((file.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8'))) records.push(r);
}
const bySite = new Map<string, CloudCoverRecord[]>();
for (const r of records) {
  if (r.site == null) continue;
  const list = bySite.get(r.site);
  if (list) list.push(r);
  else bySite.set(r.site, [r]);
}

const pct = (a: number, b: number): string => (b === 0 ? '—' : `${Math.round((100 * a) / b)}%`);
const reached = (v: VsObserved | undefined, ceiling: boolean): string => {
  if (!v) return '—';
  const c = v.ceiling;
  return ceiling ? pct(c.bothYes, c.bothYes + c.reportedOnly) : pct(c.forecastOnly, c.forecastOnly + c.neither);
};
const agree = (v: VsObserved | undefined): string => {
  if (!v) return '—';
  const c = v.ceiling;
  return pct(c.bothYes + c.neither, c.bothYes + c.reportedOnly + c.forecastOnly + c.neither);
};
// Open-Meteo's columns only when the file has its records: its archive
// refused the station fetch for a day on 2026-10-10 ("Daily API request
// limit exceeded"), so a file can hold the METARs and NWS alone.
const hasOm = records.some((r) => r.src === 'om');
const rows: readonly (readonly [string, string])[] = [
  ['NWS', NWS_ISSUANCES[0].label],
  ...(hasOm
    ? ([
        ['OM start', OM_ROWS.startTotal],
        ['OM day ahead', OM_ROWS.dayBeforeTotal],
        ['OM low', OM_ROWS.startLow],
      ] as const)
    : []),
];

// Each station's reports read once, below 12,000 ft: the AWOS sees nothing
// higher, and a staffed ASOS's observer (KOMA's) reports cirrus at 25,000 ft.
const reportsOf = new Map<string, StationReport[]>();
const reports = (s: string): StationReport[] => {
  let r = reportsOf.get(s);
  if (!r) {
    r = stationReports((bySite.get(s) ?? []).filter((x): x is MetarRecord => x.src === 'metar'), AUTOMATED_TOP_FT);
    reportsOf.set(s, r);
  }
  return r;
};

const out: string[] = [];
const stations = [...new Set(PAIRS.flatMap(([a, b]) => [a, b]))];
// Every station read below 12,000 ft, so a staffed ASOS's observer's cirrus
// does not count against a forecast an AWOS is not held to.
const summaries = new Map(stations.map((s) => [s, summarizeCloudCover(bySite.get(s) ?? [], AUTOMATED_TOP_FT)]));

out.push('### Each forecast against each station, at 5/8, layers at or below 12,000 ft', '');
out.push(
  '| Station | Hours | FEW reports | Ceiling hours reached: ' + rows.map(([n]) => n).join(' / ') +
    ' | No-ceiling hours reached: ' + rows.map(([n]) => n).join(' / ') +
    ' | Ceiling call agreed: ' + rows.map(([n]) => n).join(' / ') + ' |',
);
out.push('|---|---|---|---|---|---|');
for (const s of stations) {
  const sum = summaries.get(s)!;
  const vs = (label: string) => sum.vs.find((x) => x.source === label);
  const withSky = reports(s).filter((r) => r.obs != null);
  const few = withSky.filter((r) => r.obs?.category === 'FEW').length;
  out.push(
    `| K${s} | ${sum.hoursWithReport - sum.hoursNoSkyGroup} | ${pct(few, withSky.length)} | ` +
      rows.map(([, l]) => reached(vs(l), true)).join(' / ') + ' | ' +
      rows.map(([, l]) => reached(vs(l), false)).join(' / ') + ' | ' +
      rows.map(([, l]) => agree(vs(l))).join(' / ') + ' |',
  );
}

out.push('', '### Median gap to the reported range (points), and share inside it', '');
out.push('| Station | ' + rows.map(([n]) => n).join(' | ') + ' |');
out.push('|---|' + rows.map(() => '---').join('|') + '|');
for (const s of stations) {
  const sum = summaries.get(s)!;
  const cell = (label: string) => {
    const v = sum.vs.find((x) => x.source === label);
    return v ? `${v.gap?.medianAbs ?? '—'}, ${pct(v.inside, v.n)}` : '—';
  };
  out.push(`| K${s} | ` + rows.map(([, l]) => cell(l)).join(' | ') + ' |');
}

out.push('', '### Each AWOS against its ASOS, same hour, layers at or below 12,000 ft', '');
out.push('| AWOS | ASOS | Miles | Hours | Same category | Ceiling: both / AWOS only / ASOS only / neither | ASOS FEW: AWOS CLR / FEW / SCT / BKN+ | AWOS SCT: ASOS CLR / FEW / SCT / BKN+ |');
out.push('|---|---|---|---|---|---|---|---|');
for (const [a, b] of PAIRS) {
  const p = comparePair(reports(a), reports(b));
  const t = p.table;
  const col = (asos: 'FEW') => {
    const n = OBSERVED_CATEGORIES.reduce((sum, c) => sum + t[c][asos], 0);
    const bknUp = t.BKN[asos] + t.OVC[asos] + t.VV[asos];
    return `${t.CLR[asos]} / ${t.FEW[asos]} / ${t.SCT[asos]} / ${bknUp} (n ${n})`;
  };
  const row = (awos: 'SCT') => {
    const r = t[awos];
    const n = OBSERVED_CATEGORIES.reduce((sum, c) => sum + r[c], 0);
    return `${r.CLR} / ${r.FEW} / ${r.SCT} / ${r.BKN + r.OVC + r.VV} (n ${n})`;
  };
  const c = p.ceiling;
  out.push(
    `| K${a} | K${b} | ${miles(a, b)} | ${p.hours} | ${pct(p.sameCategory, p.hours)} | ` +
      `${pct(c.both, p.hours)} / ${pct(c.aOnly, p.hours)} / ${pct(c.bOnly, p.hours)} / ${pct(c.neither, p.hours)} | ` +
      `${col('FEW')} | ${row('SCT')} |`,
  );
}
console.log(out.join('\n'));
