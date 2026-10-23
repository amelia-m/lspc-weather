/**
 * Builds the #wind-errors page's data file and the docs' figures from it:
 * the kept NWS forecasts against KPMV, by lead, and the surface-wind
 * sample's forecasts against KPMV, by source (src/domain/windErrors.ts).
 * Usage:
 *
 *   npx tsx scripts/windErrorsData.ts \
 *     --kept <forecast-archive>/data \
 *     --reports data/parity/kept-forecasts-kpmv-reports-*.jsonl.gz \
 *     --sample data/parity/surfacewind-*.jsonl.gz \
 *     --out public/wind-errors/summary.json --figures docs/img
 *
 * --reports takes KPMV's reports for the kept window (scripts/keptInputs.ts),
 * --sample the surface-wind sampler's logs. The figures are
 * docs/img/kept-wind-errors.svg and docs/img/surface-wind-errors.svg
 * (scripts/histogramGrid.ts). Exits with an error, writing nothing, when
 * either set pairs nothing: a wrong folder should not publish an empty page.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { NWS_ISSUANCES } from '../src/domain/cloudCoverSources';
import { pairInstants, prepareInstants } from '../src/domain/keptForecasts';
import { parseSurfaceWindLines } from '../src/domain/surfaceWindSources';
import { nwsKeptSection, surfaceSampleSection, type WindErrorsData } from '../src/domain/windErrors';
import { histogramGridSvg } from './histogramGrid';
import { loadKeptSnapshots, loadKpmvReports } from './keptInputs';

const args = process.argv.slice(2);
const flag = (name: string): string[] => {
  const i = args.indexOf(name);
  if (i < 0) return [];
  const out: string[] = [];
  for (let j = i + 1; j < args.length && !args[j].startsWith('--'); j++) out.push(args[j]);
  return out;
};
const [kept] = flag('--kept');
const reports = flag('--reports');
const sample = flag('--sample');
const [out] = flag('--out');
const [figures] = flag('--figures');
if (!kept || reports.length === 0 || sample.length === 0 || !out) {
  console.error('usage: windErrorsData.ts --kept <dir> --reports <files> --sample <files> --out <json> [--figures <dir>]');
  process.exit(2);
}

const prepared = prepareInstants(loadKeptSnapshots(kept), loadKpmvReports(reports));
const nws = nwsKeptSection(
  NWS_ISSUANCES.map(({ minLeadH, label }) => ({
    label: label.replace('NWS, ', ''),
    pairs: pairInstants(prepared, minLeadH),
  })),
);
const read = (f: string): string => {
  const buf = readFileSync(f);
  return (f.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8');
};
const surface = surfaceSampleSection(sample.flatMap((f) => parseSurfaceWindLines(read(f))));
for (const s of [nws, surface]) {
  if (s.rows.every((r) => r.panels[0].n === 0)) {
    console.error(`${s.id}: nothing paired; check the inputs (is --kept the snapshots' data folder?)`);
    process.exit(1);
  }
}

const data: WindErrorsData = { generatedAt: new Date().toISOString(), sections: [nws, surface] };
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(data) + '\n');
console.log(`wrote ${out}`);

if (figures) {
  mkdirSync(figures, { recursive: true });
  const day = (iso: string | null) => (iso ?? '').slice(0, 10);
  const leads = NWS_ISSUANCES.map((i) => i.minLeadH).join(', ').replace(/, (\d+)$/, ' and $1');
  const files: [string, string][] = [
    [
      'kept-wind-errors.svg',
      histogramGridSvg({
        section: nws,
        title: `Kept NWS forecasts minus KPMV's reports, ${day(nws.first)} to ${day(nws.last)}`,
        desc: 'Histograms of forecast minus reported wind speed, gust and direction at three issuance leads. Hours counted per bin; the dashed line is zero.',
        subtitle: [
          'Hours per bin. Right of the dashed line the forecast was above the report, left of it below.',
          `Rows: the newest issuance at least ${leads} hours before the hour.`,
        ],
        note: 'Speeds in whole knots, as a METAR reports. Direction only where the report gave one (not calm or variable). Source: docs/kept-forecasts-vs-kpmv.md, scripts/windErrorsData.ts.',
      }),
    ],
    [
      'surface-wind-errors.svg',
      histogramGridSvg({
        section: surface,
        title: `Surface-wind sample: forecasts minus KPMV's reports, ${day(surface.first)} to ${day(surface.last)}`,
        desc: "Histograms of forecast minus reported wind speed, gust and direction for Open-Meteo's hourly, 15-minute and current 10 m wind and the NWS hour, each KPMV report once. The dashed line is zero.",
        subtitle: [
          'Reports per bin. Right of the dashed line the forecast was above the report, left of it below.',
          'Each forecast as it stood while the report was the newest. Rows: Open-Meteo’s three forms, then NWS on the same reports.',
        ],
        note: 'Open-Meteo to a tenth of a knot, binned to the knot. Direction only where the report gave one. Source: docs/surface-wind-sources.md, scripts/windErrorsData.ts.',
      }),
    ],
  ];
  for (const [name, svg] of files) {
    writeFileSync(join(figures, name), svg);
    console.log(`wrote ${join(figures, name)}`);
  }
}
