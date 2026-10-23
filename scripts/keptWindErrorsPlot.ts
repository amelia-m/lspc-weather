/**
 * Draws how far the kept NWS wind forecasts sat from KPMV's reports, as
 * histograms: speed, gust (where the station reported one) and direction,
 * forecast minus reported, at each issuance lead (docs/kept-forecasts-vs-kpmv.md,
 * "The spread, drawn"). Usage:
 *
 *   npx tsx scripts/keptWindErrorsPlot.ts <kept snapshots dir> <out.svg> <metar jsonl[.gz]>...
 *
 * The pairs are the comparison's own (prepareInstants, pairInstants), so the
 * figure and the doc's tables count the same hours. One self-contained SVG,
 * light and dark by `prefers-color-scheme`, each bar titled with its count
 * so a hover names it. Counts, never a grade.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { KeptGridpointSnapshot } from '../src/domain/ceilingHeights';
import { NWS_ISSUANCES, type MetarRecord } from '../src/domain/cloudCoverSources';
import { pairInstants, prepareInstants, type InstantPair } from '../src/domain/keptForecasts';
import { angular } from '../src/domain/surfaceWindSources';

const [keptDir, outPath, ...metarFiles] = process.argv.slice(2);
if (!keptDir || !outPath || metarFiles.length === 0) {
  console.error('usage: keptWindErrorsPlot.ts <kept snapshots dir> <out.svg> <metar jsonl[.gz]>...');
  process.exit(2);
}
const read = (f: string): string => {
  const buf = readFileSync(f);
  return (f.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8');
};
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json.gz') ? [p] : [];
  });
const snaps = walk(keptDir).map((f) => JSON.parse(read(f)) as KeptGridpointSnapshot);
const byKey = new Map<string, MetarRecord>();
for (const f of metarFiles) {
  for (const line of read(f).split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as MetarRecord;
    if (r.src === 'metar' && (r.site == null || r.site === 'KPMV')) byKey.set(`${r.obsAt}|${r.raw}`, r);
  }
}
const metars = [...byKey.values()];
const prepared = prepareInstants(snaps, metars);

/** The three quantities drawn, each read as the comparison reads it: speeds
 *  in whole knots, as a METAR reports and the card prints them; the gust
 *  only where the station reported one; direction only where the report
 *  gave one (not calm, not VRB), the short way round. */
const PANELS: {
  title: string;
  unit: string;
  bin: number;
  lo: number;
  hi: number;
  diff: (p: InstantPair) => number | null;
}[] = [
  {
    title: 'Wind speed',
    unit: 'kt',
    bin: 1,
    lo: -8,
    hi: 8,
    diff: (p) => (p.fc.windSpeed != null && p.obs.spd != null ? Math.round(p.fc.windSpeed) - p.obs.spd : null),
  },
  {
    title: 'Gust, where KPMV reported one',
    unit: 'kt',
    bin: 1,
    lo: -6,
    hi: 14,
    diff: (p) => (p.fc.windGust != null && p.obs.gust != null ? Math.round(p.fc.windGust) - p.obs.gust : null),
  },
  {
    title: 'Direction',
    unit: '°',
    bin: 10,
    lo: -100,
    hi: 100,
    diff: (p) => (p.fc.windDirection != null && p.obs.dir != null ? angular(p.fc.windDirection, p.obs.dir) : null),
  },
];

// Layout. Small multiples: a column per quantity, a row per lead, each
// column on one x scale and each panel on its own y (counts differ: the gust
// has a quarter of the hours).
const PW = 300;
const PH = 150;
const GX = 36;
const GY = 64;
const ML = 44;
const MT = 112;
const W = ML + 3 * PW + 2 * GX + 16;
const H = MT + 3 * PH + 2 * GY + 56;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const signed = (x: number) => (x > 0 ? `+${x}` : x < 0 ? `−${-x}` : '0');
const r1 = (x: number) => Math.round(x * 10) / 10;

const parts: string[] = [];
const rows = NWS_ISSUANCES.map(({ minLeadH, label }) => ({ minLeadH, label, pairs: pairInstants(prepared, minLeadH) }));
rows.forEach((row, ri) => {
  PANELS.forEach((panel, ci) => {
    const x0 = ML + ci * (PW + GX);
    const y0 = MT + ri * (PH + GY);
    const ds = row.pairs.map(panel.diff).filter((d): d is number => d != null);
    const nb = Math.round((panel.hi - panel.lo) / panel.bin) + 1;
    const counts = new Array<number>(nb).fill(0);
    let outside = 0;
    for (const d of ds) {
      const i = Math.round((d - panel.lo) / panel.bin);
      if (i < 0 || i >= nb) outside += 1;
      else counts[i] += 1;
    }
    const max = Math.max(1, ...counts);
    const step = max <= 10 ? 2 : max <= 25 ? 5 : max <= 60 ? 10 : 20;
    const top = Math.ceil(max / step) * step;
    const bw = PW / nb;
    const xOf = (v: number) => x0 + ((v - panel.lo) / panel.bin + 0.5) * bw;
    const yOf = (c: number) => y0 + PH - (c / top) * PH;
    const sorted = [...ds].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : 0;
    const mean = ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : 0;
    const above = ds.filter((d) => d > 0).length;
    const below = ds.filter((d) => d < 0).length;

    if (ri === 0) parts.push(`<text class="h" x="${x0}" y="${MT - 32}">${esc(panel.title)}</text>`);
    parts.push(
      `<text class="s" x="${x0}" y="${y0 - 10}">n ${ds.length} · median ${signed(median)} ${panel.unit} · mean ${signed(r1(mean))} ${panel.unit} · ${above} above, ${below} below</text>`,
    );
    for (let c = step; c <= top; c += step) {
      parts.push(`<line class="grid" x1="${x0}" x2="${x0 + PW}" y1="${yOf(c)}" y2="${yOf(c)}"/>`);
      parts.push(`<text class="t" x="${x0 - 6}" y="${yOf(c) + 4}" text-anchor="end">${c}</text>`);
    }
    // Zero: where forecast and report agree.
    parts.push(`<line class="zero" x1="${xOf(0)}" x2="${xOf(0)}" y1="${y0 - 2}" y2="${y0 + PH}"/>`);
    counts.forEach((c, i) => {
      if (c === 0) return;
      const v = panel.lo + i * panel.bin;
      const x = x0 + i * bw + 1;
      const w = Math.max(1, bw - 2);
      const y = yOf(c);
      const h = y0 + PH - y;
      const r = Math.min(4, w / 2, h);
      // Rounded at the data end, square on the baseline.
      parts.push(
        `<path class="bar" d="M${x},${y0 + PH} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y0 + PH} Z">` +
          `<title>${signed(v)} ${panel.unit}: ${c} hour${c === 1 ? '' : 's'}</title></path>`,
      );
    });
    parts.push(`<line class="base" x1="${x0}" x2="${x0 + PW}" y1="${y0 + PH}" y2="${y0 + PH}"/>`);
    const tickEvery = panel.bin === 1 ? 4 : 50;
    for (let v = Math.ceil(panel.lo / tickEvery) * tickEvery; v <= panel.hi; v += tickEvery) {
      parts.push(`<text class="t" x="${xOf(v)}" y="${y0 + PH + 16}" text-anchor="middle">${signed(v)}</text>`);
    }
    if (outside) parts.push(`<text class="t" x="${x0 + PW}" y="${y0 + PH + 30}" text-anchor="end">${outside} beyond the axis</text>`);
    if (ci === 0) {
      parts.push(
        `<text class="lead" x="${12}" y="${y0 + PH / 2}" transform="rotate(-90 12 ${y0 + PH / 2})" text-anchor="middle">${esc(row.label.replace('NWS, ', ''))}</text>`,
      );
    }
  });
});

const first = new Date(Math.min(...rows.flatMap((r) => r.pairs.map((p) => p.t)))).toISOString().slice(0, 10);
const last = new Date(Math.max(...rows.flatMap((r) => r.pairs.map((p) => p.t)))).toISOString().slice(0, 10);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">
<title id="t">Kept NWS wind forecasts minus KPMV's reports</title>
<desc id="d">Histograms of forecast minus reported wind speed, gust and direction at three issuance leads, ${first} to ${last}. Hours counted per bin; the dashed line is zero.</desc>
<style>
  svg { --surface:#fcfcfb; --ink:#0b0b0b; --ink2:#52514e; --muted:#898781; --grid:#e1e0d9; --base:#c3c2b7; --bar:#2a78d6;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  @media (prefers-color-scheme: dark) {
    svg { --surface:#1a1a19; --ink:#f0efec; --ink2:#c3c2b7; --muted:#898781; --grid:#2c2c2a; --base:#383835; --bar:#3987e5; }
  }
  .bg { fill: var(--surface); }
  .h { fill: var(--ink); font-size: 15px; font-weight: 600; }
  .lead { fill: var(--ink2); font-size: 12px; font-weight: 600; }
  .s { fill: var(--ink2); font-size: 11px; }
  .t { fill: var(--muted); font-size: 11px; }
  .note { fill: var(--muted); font-size: 11px; }
  .grid { stroke: var(--grid); stroke-width: 1; }
  .base { stroke: var(--base); stroke-width: 1; }
  .zero { stroke: var(--ink2); stroke-width: 1.5; stroke-dasharray: 4 3; }
  .bar { fill: var(--bar); }
</style>
<rect class="bg" width="100%" height="100%"/>
<text class="h" x="${ML}" y="24">Kept NWS forecasts minus KPMV's reports, ${first} to ${last}</text>
<text class="s" x="${ML}" y="42">Hours per bin. Right of the dashed line the forecast was above the report, left of it below.</text>
<text class="s" x="${ML}" y="58">Rows: the newest issuance at least 0, 6 and 24 hours before the hour.</text>
${parts.join('\n')}
<text class="note" x="${ML}" y="${H - 14}">Speeds in whole knots, as a METAR reports. Direction only where the report gave one (not calm or variable). Source: docs/kept-forecasts-vs-kpmv.md, scripts/keptWindErrorsPlot.ts.</text>
</svg>
`;
writeFileSync(outPath, svg);
console.log(`wrote ${outPath}: ${rows.map((r) => `${r.label} ${r.pairs.length} hours`).join('; ')}`);
