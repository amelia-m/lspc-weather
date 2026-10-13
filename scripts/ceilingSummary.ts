/**
 * Summarise the NWS ceiling records scripts/cloudCoverFetch.py gathered
 * (PARTS=cig, SITES for KPMV's point and the drop zone's) against KPMV's
 * reports, and Open-Meteo's bands by reported ceiling. Usage:
 *
 *   npx tsx scripts/ceilingSummary.ts \
 *     data/parity/ceiling-2026-04-01-to-2026-10-09.jsonl.gz \
 *     data/parity/cloud-cover-2026-04-01-to-2026-10-09.jsonl.gz
 *
 * The first file is the ceiling records, the second the drop zone's
 * cloud-cover archive, which holds KPMV's reports and Open-Meteo's bands.
 * Prints Markdown tables, as docs/ceiling-heights.md quotes them. The
 * arithmetic is src/domain/ceilingHeights.ts (pure, tested); this file
 * reads and prints. Counts and spreads, never a grade.
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import {
  CEILING_BANDS,
  openMeteoByCeilingBand,
  parseCeilingLines,
  summarizeCeilings,
  type NdfdCeilingRecord,
} from '../src/domain/ceilingHeights';
import {
  parseCloudCoverLines,
  type MetarRecord,
  type OpenMeteoCloudRecord,
} from '../src/domain/cloudCoverSources';

const read = (file: string): string => {
  const buf = readFileSync(file);
  return (file.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8');
};
const [ceilingFile, coverFile] = process.argv.slice(2);
const forecasts = parseCeilingLines(read(ceilingFile));
const metars: MetarRecord[] = [];
const om: OpenMeteoCloudRecord[] = [];
// The drop zone's archive only (no `site`); one push per record, since a
// spread of half a million overflows the stack.
for (const r of parseCloudCoverLines(read(coverFile))) {
  if (r.site != null) continue;
  if (r.src === 'metar') metars.push(r);
  else if (r.src === 'om') om.push(r);
}

const pct = (a: number, b: number): string => (b === 0 ? '—' : `${Math.round((100 * a) / b)}%`);
const out: string[] = [];
const points: readonly [string, string][] = [
  ['DZ', "the drop zone's grid point (the card's)"],
  ['PMV', "KPMV's grid point"],
];
for (const [site, name] of points) {
  const rows = summarizeCeilings(
    forecasts.filter((r: NdfdCeilingRecord) => r.site === site),
    metars,
  );
  out.push(`### NWS ceiling at ${name}, against KPMV`, '');
  out.push(
    '| Issuance | Hours | Lead (h) | Both a ceiling | Forecast only | Reported only | Neither | Same band | Forecast − reported (ft): median, 10th–90th | Median size |',
  );
  out.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    const c = r.call;
    const d = r.diffFt;
    out.push(
      `| ${r.label} | ${r.hours} | ${r.leadH ? `${r.leadH.min.toFixed(1)}–${r.leadH.max.toFixed(1)}` : '—'} | ` +
        `${c.both} | ${c.forecastOnly} | ${c.reportedOnly} | ${c.neither} | ${pct(r.sameBand, r.hours)} | ` +
        `${d ? `${d.median}, ${d.p10} to ${d.p90}` : '—'} | ${d ? d.medianAbs : '—'} |`,
    );
  }
  for (const [key, by] of [
    ['diffByBand', "the reported ceiling's band"],
    ['diffByForecastBand', "the forecast ceiling's band"],
  ] as const) {
    out.push('', `Forecast − reported (ft), median, by ${by} (hours both had a ceiling):`, '');
    out.push('| Issuance | LIFR | IFR | MVFR | VFR |');
    out.push('|---|---|---|---|---|');
    for (const r of rows) {
      const b = r[key];
      const cell = (k: 'LIFR' | 'IFR' | 'MVFR' | 'VFR') => (b[k].median == null ? '—' : `${b[k].median} (n ${b[k].n})`);
      out.push(`| ${r.label} | ${cell('LIFR')} | ${cell('IFR')} | ${cell('MVFR')} | ${cell('VFR')} |`);
    }
  }
  for (const r of rows) {
    out.push('', `**${r.label}**, hours by band (rows: KPMV reported; columns: forecast)`, '');
    out.push('| Reported \\ Forecast | ' + CEILING_BANDS.join(' | ') + ' | Same band |');
    out.push('|---|' + CEILING_BANDS.map(() => '---').join('|') + '|---|');
    for (const rb of CEILING_BANDS) {
      const row = r.bands[rb];
      const n = CEILING_BANDS.reduce((s, fb) => s + row[fb], 0);
      out.push(`| ${rb} | ` + CEILING_BANDS.map((fb) => String(row[fb])).join(' | ') + ` | ${pct(row[rb], n)} of ${n} |`);
    }
  }
  out.push('');
}

out.push("### Open-Meteo's start of run on hours KPMV reported a ceiling, by the ceiling's band", '');
out.push('| Reported ceiling | Hours | Low band ≥ 5/8 | Mid band ≥ 5/8 | Total ≥ 5/8 |');
out.push('|---|---|---|---|---|');
for (const r of openMeteoByCeilingBand(om, metars)) {
  out.push(`| ${r.band} | ${r.hours} | ${pct(r.low, r.hours)} | ${pct(r.mid, r.hours)} | ${pct(r.total, r.hours)} |`);
}
console.log(out.join('\n'));
