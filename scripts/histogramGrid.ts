/**
 * The docs' version of the #wind-errors figures: a grid of histograms, a
 * column per quantity and a row per source or lead, as one self-contained
 * SVG with light and dark colours by `prefers-color-scheme`, for a doc on
 * GitHub (scripts/windErrorsData.ts writes them). The binning and figures
 * are src/domain/windErrors.ts's `histogram`, the same the page draws. The
 * colours are the dataviz reference palette's single-series blue and its
 * neutrals, checked against both surfaces; the page uses the app's own.
 * Since 2026-10-27 the bars are filled by side of zero, as the page's are
 * (`barSide`): blue right of it, magenta left, grey for the zero bar, with
 * a key row under the subtitle and the sides named in the description.
 * Each bar is titled with its count, so a hover names it. Counts, never a
 * grade.
 */
import { barSide, histogramLine, signed, yStep, type WindErrorSection } from '../src/domain/windErrors';

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** The key the figure carries under its subtitle: a swatch and words per
 *  side, in the page's words, so a figure in a doc explains its own fills. */
function keyRow(x: number, y: number): string {
  const items: [string, string][] = [
    ['over', 'forecast above the report (right of the line)'],
    ['under', 'below it (left)'],
    ['zero', 'nearer zero than half a bin (neither)'],
  ];
  let cx = x;
  return items
    .map(([side, words]) => {
      const s = `<rect class="sw ${side}" x="${cx}" y="${y}" width="11" height="11" rx="2"/><text class="key" x="${cx + 16}" y="${y + 10}">${esc(words)}</text>`;
      cx += 16 + words.length * 6.2 + 18;
      return s;
    })
    .join('');
}

export function histogramGridSvg(o: {
  section: WindErrorSection;
  title: string;
  desc: string;
  subtitle: [string, string];
  note: string;
  /** The data's credit, drawn on its own line above the note: Open-Meteo's
   *  licence asks for one next to wherever its data are shown
   *  (open-meteo.com/en/licence, read 2026-10-23), a figure in the docs
   *  included. */
  credit?: string;
}): string {
  const { rows, unitWord } = o.section;
  const cols = rows[0]?.panels ?? [];
  // Small multiples: each column on one x scale, each panel on its own y
  // (counts differ: the gust has about a quarter of the pairs).
  const PW = 300;
  const PH = 150;
  const GX = 36;
  const GY = 64;
  const ML = 44;
  const MT = 112;
  const W = ML + cols.length * PW + (cols.length - 1) * GX + 16;
  const H = MT + rows.length * PH + (rows.length - 1) * GY + 72;
  const parts: string[] = [];
  rows.forEach((row, ri) => {
    row.panels.forEach((h, ci) => {
      const x0 = ML + ci * (PW + GX);
      const y0 = MT + ri * (PH + GY);
      const nb = h.counts.length;
      const step = yStep(Math.max(1, ...h.counts));
      const top = Math.ceil(Math.max(1, ...h.counts) / step) * step;
      const bw = PW / nb;
      const xOf = (v: number) => x0 + ((v - h.lo) / h.bin + 0.5) * bw;
      const yOf = (c: number) => y0 + PH - (c / top) * PH;
      if (ri === 0) parts.push(`<text class="h" x="${x0}" y="${MT - 32}">${esc(h.title)}</text>`);
      parts.push(`<text class="s" x="${x0}" y="${y0 - 10}">${esc(histogramLine(h))}</text>`);
      for (let c = step; c <= top; c += step) {
        parts.push(`<line class="grid" x1="${x0}" x2="${x0 + PW}" y1="${yOf(c)}" y2="${yOf(c)}"/>`);
        parts.push(`<text class="t" x="${x0 - 6}" y="${yOf(c) + 4}" text-anchor="end">${c}</text>`);
      }
      // Zero: where forecast and report agree.
      parts.push(`<line class="zero" x1="${xOf(0)}" x2="${xOf(0)}" y1="${y0 - 2}" y2="${y0 + PH}"/>`);
      h.counts.forEach((c, i) => {
        if (c === 0) return;
        const v = h.lo + i * h.bin;
        const x = x0 + i * bw + 1;
        const w = Math.max(1, bw - 2);
        const y = yOf(c);
        const r = Math.min(4, w / 2, y0 + PH - y);
        // Rounded at the data end, square on the baseline.
        parts.push(
          `<path class="bar ${barSide(v)}" d="M${x},${y0 + PH} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y0 + PH} Z">` +
            `<title>${signed(v)} ${h.unit}: ${c} ${unitWord}${c === 1 ? '' : 's'}</title></path>`,
        );
      });
      parts.push(`<line class="base" x1="${x0}" x2="${x0 + PW}" y1="${y0 + PH}" y2="${y0 + PH}"/>`);
      const tickEvery = h.bin === 1 ? 4 : 50;
      for (let v = Math.ceil(h.lo / tickEvery) * tickEvery; v <= h.hi; v += tickEvery) {
        parts.push(`<text class="t" x="${xOf(v)}" y="${y0 + PH + 16}" text-anchor="middle">${signed(v)}</text>`);
      }
      if (h.outside) {
        parts.push(`<text class="t" x="${x0 + PW}" y="${y0 + PH + 30}" text-anchor="end">${h.outside} beyond the axis</text>`);
      }
      if (ci === 0) {
        parts.push(
          `<text class="lead" x="12" y="${y0 + PH / 2}" transform="rotate(-90 12 ${y0 + PH / 2})" text-anchor="middle">${esc(row.label)}</text>`,
        );
      }
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">
<title id="t">${esc(o.title)}</title>
<desc id="d">${esc(o.desc)} Bars right of zero are blue (forecast above the report), left of it magenta (below), the zero bar grey (nearer zero than half a bin, on neither side).</desc>
<style>
  svg { --surface:#fcfcfb; --ink:#0b0b0b; --ink2:#52514e; --muted:#898781; --grid:#e1e0d9; --base:#c3c2b7;
        --bar:#2a78d6; --bar-under:#b8408f; --bar-zero:#a3a29b;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  @media (prefers-color-scheme: dark) {
    svg { --surface:#1a1a19; --ink:#f0efec; --ink2:#c3c2b7; --muted:#898781; --grid:#2c2c2a; --base:#383835;
          --bar:#3987e5; --bar-under:#d65db1; --bar-zero:#6b6a66; }
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
  .bar.under { fill: var(--bar-under); }
  .bar.zero { fill: var(--bar-zero); }
  .key { fill: var(--ink2); font-size: 11px; }
  .sw.over { fill: var(--bar); } .sw.under { fill: var(--bar-under); } .sw.zero { fill: var(--bar-zero); }
</style>
<rect class="bg" width="100%" height="100%"/>
<text class="h" x="${ML}" y="24">${esc(o.title)}</text>
<text class="s" x="${ML}" y="42">${esc(o.subtitle[0])}</text>
<text class="s" x="${ML}" y="58">${esc(o.subtitle[1])}</text>
${keyRow(ML, 70)}
${parts.join('\n')}
${o.credit ? `<text class="note" x="${ML}" y="${H - 30}">${esc(o.credit)}</text>\n` : ''}<text class="note" x="${ML}" y="${H - 14}">${esc(o.note)}</text>
</svg>
`;
}
