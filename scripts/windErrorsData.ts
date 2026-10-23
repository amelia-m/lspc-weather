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
 *     --out public/wind-errors/summary.json --check-against public/wind-errors/summary.json \
 *     [--figures docs/img]
 *
 * --reports takes KPMV's reports for the kept window (scripts/keptInputs.ts),
 * --sample the surface-wind sampler's logs. --figures draws the docs'
 * versions (scripts/histogramGrid.ts), named for the day of each section's
 * last pair, `kept-wind-errors-<day>.svg` and `surface-wind-errors-<day>.svg`:
 * a doc quotes the figures of one dated reading, so a new reading is a new
 * file beside it, never the one the doc's text describes. The weekly
 * refresh writes only the page's file. Exits with an error, writing nothing, when
 * either set pairs nothing (a wrong folder should not publish an empty
 * page), or, with --check-against, when the rebuild would hold less than
 * that published file (`windErrorsShrinkage`) or the file is not there:
 * the weekly refresh, .github/workflows/ceiling-data-refresh.yml, runs it
 * that way, and so should a rebuild by hand.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { NWS_ISSUANCES } from '../src/domain/cloudCoverSources';
import { pairInstants, prepareInstants } from '../src/domain/keptForecasts';
import {
  nwsKeptSection,
  spanDay,
  surfaceSampleSection,
  windErrorsShrinkage,
  type WindErrorsData,
} from '../src/domain/windErrors';
import { histogramGridSvg } from './histogramGrid';
import { loadKeptSnapshots, loadKpmvReports, loadSurfaceWindRecords } from './keptInputs';

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
const [checkAgainst] = flag('--check-against');
if (!kept || reports.length === 0 || sample.length === 0 || !out) {
  console.error(
    'usage: windErrorsData.ts --kept <dir> --reports <files> --sample <files> --out <json> [--check-against <published json>] [--figures <dir>]',
  );
  process.exit(2);
}

const prepared = prepareInstants(loadKeptSnapshots(kept), loadKpmvReports(reports));
const nws = nwsKeptSection(
  NWS_ISSUANCES.map(({ minLeadH, label }) => ({
    label: label.replace('NWS, ', ''),
    pairs: pairInstants(prepared, minLeadH),
  })),
);
const surface = surfaceSampleSection(loadSurfaceWindRecords(sample));
for (const s of [nws, surface]) {
  if (s.rows.every((r) => r.panels[0].n === 0)) {
    console.error(`${s.id}: nothing paired; check the inputs (is --kept the snapshots' data folder?)`);
    process.exit(1);
  }
}

const data: WindErrorsData = { generatedAt: new Date().toISOString(), sections: [nws, surface] };
if (checkAgainst) {
  if (!existsSync(checkAgainst)) {
    console.error(`--check-against ${checkAgainst}: no such file; nothing written`);
    process.exit(1);
  }
  const less = windErrorsShrinkage(JSON.parse(readFileSync(checkAgainst, 'utf8')) as WindErrorsData, data);
  if (less.length) {
    console.error(`the rebuild holds less than ${checkAgainst}; nothing written:\n  ${less.join('\n  ')}`);
    process.exit(1);
  }
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(data) + '\n');
console.log(`wrote ${out}`);

if (figures) {
  mkdirSync(figures, { recursive: true });
  const leads = NWS_ISSUANCES.map((i) => i.minLeadH).join(', ').replace(/, (\d+)$/, ' and $1');
  const files: [string, string][] = [
    [
      `kept-wind-errors-${(nws.last ?? '').slice(0, 10)}.svg`,
      histogramGridSvg({
        section: nws,
        title: `Kept NWS forecasts minus KPMV's reports, ${spanDay(nws.first)} to ${spanDay(nws.last)}`,
        desc: 'Histograms of forecast minus reported wind speed, gust and direction at three issuance leads. Hours counted per bin; the dashed line is zero.',
        subtitle: [
          'Hours per bin. Right of the dashed line the forecast was above the report, left of it below.',
          `Rows: the newest issuance at least ${leads} hours before the hour.`,
        ],
        note: 'Speeds in whole knots, as a METAR reports. Direction only where the report gave one (not calm or variable). Source: docs/kept-forecasts-vs-kpmv.md, scripts/windErrorsData.ts.',
      }),
    ],
    [
      `surface-wind-errors-${(surface.last ?? '').slice(0, 10)}.svg`,
      histogramGridSvg({
        section: surface,
        title: `Surface-wind sample: forecasts minus KPMV's reports, ${spanDay(surface.first)} to ${spanDay(surface.last)}`,
        desc: "Histograms of forecast minus reported wind speed, gust and direction for Open-Meteo's hourly, 15-minute and current 10 m wind and the NWS hour, each KPMV report once. The dashed line is zero.",
        subtitle: [
          'Reports per bin. Right of the dashed line the forecast was above the report, left of it below.',
          'Each forecast as it stood while the report was the newest. Rows: Open-Meteo’s three forms, then NWS on the same reports.',
        ],
        note: 'Every row to a tenth of a knot, binned to the knot; a tenth either side of zero counts on neither side. Direction only where the report gave one. Source: docs/surface-wind-sources.md, scripts/windErrorsData.ts.',
      }),
    ],
  ];
  for (const [name, svg] of files) {
    writeFileSync(join(figures, name), svg);
    console.log(`wrote ${join(figures, name)}`);
  }
}
