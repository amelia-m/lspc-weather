/**
 * The #parity page's charts: the summary's figures drawn as SVG, as the
 * tables print them. Pure: a function from figures to markup, nothing read
 * from the page or the clock, so a test can hold a mark to its figure.
 *
 * Four forms, one per kind of figure the summary holds. A spread (the
 * absolute differences' median, 90th percentile, smallest and largest) is a
 * row with a dot at the median, a bar from the median to the 90th
 * percentile and a thin line from the smallest to the largest. Two medians
 * side by side (the two ground rows in a block of the day) are a dumbbell.
 * The same two over the days are two lines. A count agreed of a count
 * compared (an observation field) is a bar of that share with its figures
 * printed beside it, since a share is read against its count.
 *
 * Every mark carries a <title> with the row's figures, so a hover or a long
 * press names it, and every chart sits above the table that holds the same
 * figures; the chart adds no figure the table does not have and the page's
 * rule holds: counts and spreads, never a grade. The marks take the app's
 * colour tokens through the stylesheet (`pty-*` classes, src/styles/app.css),
 * so nothing here names a colour; the two series hues are the ones
 * #wind-errors uses for its two sides, neither a warning colour.
 *
 * The x gridline step is `yStep` from windErrors.ts, the #wind-errors
 * charts' count step: the same few-ticks rule serves degrees, knots and
 * minutes here, so both pages' axes are stepped alike.
 */
import type { GroundDay, Spread } from './paritySummary';
import { yStep } from './windErrors';

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/** A figure as the tables print it: whole numbers with their thousands
 *  separator, others to a hundredth under 10 and a tenth from there. */
export const fmtFigure = (x: number): string =>
  Number.isInteger(x) ? x.toLocaleString('en-US') : x.toFixed(x < 10 ? 2 : 1);

/** Coordinates to a tenth of a viewBox unit: enough for a 320-wide chart,
 *  and short enough to read in a test. */
const r1 = (x: number): string => (Math.round(x * 10) / 10).toString();

/** The chart's width in viewBox units. Each chart scales to its cell
 *  (width 100%), so this is the width at which its type is 1:1; a phone
 *  cell is a little narrower, a desktop cell a little wider. */
export const CHART_W = 320;

/** The label column's width for a set of row labels: the longest label at
 *  the labels' 11 px type, allowing 6.6 units a character, which is DejaVu
 *  Sans's width (the GitHub runner's font, wider than the sandbox's Inter)
 *  for mixed text, plus the 6-unit gap before the axis. A caller's
 *  `labelWidth` is a floor, not a fixed width: "Newer run one side" was
 *  clipped at the left edge under a fixed 104 on 2026-11-11. */
export function labelColumn(labels: readonly string[], floor: number): number {
  const longest = labels.reduce((m, l) => Math.max(m, l.length), 0);
  return Math.max(floor, Math.ceil(longest * 6.6) + 6);
}

/** The gridline step and top of an axis that must reach `max`. */
function axis(max: number): { step: number; top: number } {
  const step = yStep(Math.max(1, max));
  return { step, top: Math.max(step, Math.ceil(max / step) * step) };
}

/** Vertical gridlines, a baseline and tick labels for an x axis from 0 to
 *  `top`, between `y0` and `base`. */
function xAxis(o: { x: (v: number) => number; step: number; top: number; y0: number; base: number; L: number; R: number }): string {
  const parts: string[] = [];
  for (let v = 0; v <= o.top; v += o.step) {
    if (v > 0) parts.push(`<line class="pty-grid" x1="${r1(o.x(v))}" x2="${r1(o.x(v))}" y1="${o.y0}" y2="${o.base}"/>`);
    parts.push(`<text class="pty-tick" x="${r1(o.x(v))}" y="${o.base + 13}" text-anchor="middle">${v}</text>`);
  }
  parts.push(`<line class="pty-base" x1="${o.L}" x2="${o.R}" y1="${o.base}" y2="${o.base}"/>`);
  return parts.join('');
}

const open = (W: number, H: number, label: string): string =>
  `<svg class="pty-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">`;

export interface SpreadRow {
  label: string;
  /** Null or undefined where the row has no runs yet: the row is drawn
   *  with its label and no marks, so a reader sees it is empty rather than
   *  missing. */
  spread: Spread | null | undefined;
}

/** The words a spread row's title gives for its figures, in the table's
 *  order, so a hover reads as the row does. */
export const spreadWords = (s: Spread, unit: string): string =>
  `median ${fmtFigure(s.medianAbs)}${unit}, 90th ${fmtFigure(s.p90Abs)}${unit}, ${fmtFigure(s.minAbs)} to ${fmtFigure(s.maxAbs)}${unit}, over ${s.n.toLocaleString('en-US')}`;

/**
 * One row per spread: a dot at the median, a bar from the median to the
 * 90th percentile, a thin line from the smallest to the largest absolute
 * difference. One x axis from 0 for every row; `axisMax` lets charts set
 * side by side share it (the direction charts of the two winds tables), so
 * a bar reads the same length for the same figure on both.
 */
export function spreadRowsSvg(o: {
  title: string;
  /** The figures' unit, as a suffix: "°", " kt", " min". */
  unit: string;
  rows: readonly SpreadRow[];
  /** The word for what `n` counts in a row's title: "runs", "reports". */
  unitWord: string;
  /** The label column's least width; it widens to the longest label
   *  (`labelColumn`). The labels are right-aligned to it. */
  labelWidth?: number;
  axisMax?: number;
}): string {
  const L = labelColumn(o.rows.map((r) => r.label), o.labelWidth ?? 52);
  const R = CHART_W - 10;
  const rowH = 18;
  const y0 = 4;
  const base = y0 + o.rows.length * rowH + 2;
  const H = base + 18;
  const maxOf = Math.max(0, o.axisMax ?? 0, ...o.rows.map((r) => r.spread?.maxAbs ?? 0));
  const { step, top } = axis(maxOf);
  const x = (v: number): number => L + (v / top) * (R - L);
  const parts: string[] = [open(CHART_W, H, `${o.title}: ${o.rows.length} rows`)];
  parts.push(xAxis({ x, step, top, y0, base, L, R }));
  o.rows.forEach((row, i) => {
    const cy = y0 + i * rowH + rowH / 2;
    parts.push(`<text class="pty-label" x="${L - 6}" y="${r1(cy + 4)}" text-anchor="end">${esc(row.label)}</text>`);
    const s = row.spread;
    if (s == null) {
      parts.push(`<text class="pty-tick" x="${L + 4}" y="${r1(cy + 4)}">no ${esc(o.unitWord)} yet</text>`);
      return;
    }
    parts.push(`<g><title>${esc(`${row.label}: ${spreadWords(s, o.unit)} ${o.unitWord}`)}</title>`);
    // The hit area is the whole row, wider than its marks.
    parts.push(`<rect class="pty-hit" x="${L}" y="${r1(cy - rowH / 2)}" width="${R - L}" height="${rowH}"/>`);
    parts.push(`<line class="pty-range" x1="${r1(x(s.minAbs))}" x2="${r1(x(s.maxAbs))}" y1="${r1(cy)}" y2="${r1(cy)}"/>`);
    const w = x(s.p90Abs) - x(s.medianAbs);
    if (w > 0) {
      parts.push(`<rect class="pty-core" x="${r1(x(s.medianAbs))}" y="${r1(cy - 4)}" width="${r1(w)}" height="8" rx="2"/>`);
    }
    parts.push(`<circle class="pty-median" cx="${r1(x(s.medianAbs))}" cy="${r1(cy)}" r="3.5"/>`);
    parts.push('</g>');
  });
  parts.push('</svg>');
  return parts.join('');
}

export interface DumbbellRow {
  label: string;
  /** The two figures, in the order of `names`; null where a side has none. */
  a: number | null;
  b: number | null;
  runs: number;
}

/**
 * One row per block: a dot per side joined by a line, so the gap between
 * the two medians is the line's length. A row with one side null draws
 * that dot alone; a row with no runs draws its label only.
 */
export function dumbbellSvg(o: {
  title: string;
  unit: string;
  rows: readonly DumbbellRow[];
  /** What the two dots are, in the title of each row: ["this dashboard", "Schulze's"]. */
  names: readonly [string, string];
  labelWidth?: number;
}): string {
  const L = labelColumn(o.rows.map((r) => r.label), o.labelWidth ?? 78);
  const R = CHART_W - 12;
  const rowH = 22;
  const y0 = 4;
  const base = y0 + o.rows.length * rowH + 2;
  const H = base + 18;
  const maxOf = Math.max(0, ...o.rows.flatMap((r) => [r.a ?? 0, r.b ?? 0]));
  const { step, top } = axis(maxOf);
  const x = (v: number): number => L + (v / top) * (R - L);
  const parts: string[] = [open(CHART_W, H, `${o.title}: ${o.names[0]} and ${o.names[1]}, ${o.rows.length} rows`)];
  parts.push(xAxis({ x, step, top, y0, base, L, R }));
  o.rows.forEach((row, i) => {
    const cy = y0 + i * rowH + rowH / 2;
    parts.push(`<text class="pty-label" x="${L - 6}" y="${r1(cy + 4)}" text-anchor="end">${esc(row.label)}</text>`);
    if (row.runs === 0 || (row.a == null && row.b == null)) {
      parts.push(`<text class="pty-tick" x="${L + 4}" y="${r1(cy + 4)}">no runs yet</text>`);
      return;
    }
    const fig = (v: number | null): string => (v == null ? '—' : `${fmtFigure(v)}${o.unit}`);
    parts.push(
      `<g><title>${esc(`${row.label}: ${o.names[0]} ${fig(row.a)}, ${o.names[1]} ${fig(row.b)}, ${row.runs.toLocaleString('en-US')} runs`)}</title>`,
    );
    parts.push(`<rect class="pty-hit" x="${L}" y="${r1(cy - rowH / 2)}" width="${R - L}" height="${rowH}"/>`);
    if (row.a != null && row.b != null) {
      parts.push(`<line class="pty-link" x1="${r1(x(row.a))}" x2="${r1(x(row.b))}" y1="${r1(cy)}" y2="${r1(cy)}"/>`);
    }
    // Equal medians would put one dot exactly over the other, and the row
    // would read as one side missing (the 12-3 PM block, both 10 kt, on
    // 2026-11-11). So the second dot is drawn smaller inside the first: a
    // two-tone dot says both sides are there and agree.
    const equal = row.a != null && row.a === row.b;
    if (row.a != null) parts.push(`<circle class="pty-dot ours" cx="${r1(x(row.a))}" cy="${r1(cy)}" r="5"/>`);
    if (row.b != null) parts.push(`<circle class="pty-dot theirs" cx="${r1(x(row.b))}" cy="${r1(cy)}" r="${equal ? 2.5 : 5}"/>`);
    parts.push('</g>');
  });
  parts.push('</svg>');
  return parts.join('');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 2" for "2026-10-02", from the parts: the summary's local date is
 *  not an instant, so it is never parsed as one. */
export const dayLabel = (ymd: string): string => {
  const [, m, d] = ymd.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
};

/** Days from the first date to this one, by the calendar: a day the
 *  summary has no runs for leaves a gap on the axis rather than closing up. */
const dayOffset = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * The two ground medians over the local days, one line each, on one y axis
 * from 0. Days are spaced by the calendar, so a day with no runs is a gap;
 * a day where a side has no median breaks that side's line. One hit area
 * per day carries both figures and the day's runs.
 */
export function dayLinesSvg(o: { title: string; unit: string; days: readonly GroundDay[]; names: readonly [string, string] }): string {
  const L = 26;
  const R = CHART_W - 8;
  const y0 = 6;
  const PH = 110;
  const base = y0 + PH;
  const H = base + 18;
  const first = o.days[0]?.date;
  const span = Math.max(1, first ? dayOffset(first, o.days[o.days.length - 1].date) : 1);
  const maxOf = Math.max(0, ...o.days.flatMap((d) => [d.medianOurKt ?? 0, d.medianTheirKt ?? 0]));
  const { step, top } = axis(maxOf);
  const x = (d: string): number => L + (dayOffset(first ?? d, d) / span) * (R - L);
  const y = (v: number): number => base - (v / top) * PH;
  const parts: string[] = [open(CHART_W, H, `${o.title}: ${o.names[0]} and ${o.names[1]} by day, ${o.days.length} days`)];
  for (let v = 0; v <= top; v += step) {
    if (v > 0) parts.push(`<line class="pty-grid" x1="${L}" x2="${R}" y1="${r1(y(v))}" y2="${r1(y(v))}"/>`);
    parts.push(`<text class="pty-tick" x="${L - 4}" y="${r1(y(v) + 3)}" text-anchor="end">${v}</text>`);
  }
  parts.push(`<line class="pty-base" x1="${L}" x2="${R}" y1="${base}" y2="${base}"/>`);
  // A date label about every week, at most six: the first day, then every
  // `every` days from it.
  if (first) {
    const every = Math.max(7, Math.ceil(span / 5 / 7) * 7);
    for (let off = 0; off <= span; off += every) {
      const d = new Date(Date.parse(`${first}T00:00:00Z`) + off * 86_400_000).toISOString().slice(0, 10);
      parts.push(`<text class="pty-tick" x="${r1(x(d))}" y="${base + 13}" text-anchor="${off === 0 ? 'start' : 'middle'}">${dayLabel(d)}</text>`);
    }
  }
  const line = (cls: string, pick: (d: GroundDay) => number | null): string => {
    let d = '';
    let pen = false;
    for (const day of o.days) {
      const v = pick(day);
      if (v == null) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${r1(x(day.date))},${r1(y(v))}`;
      pen = true;
    }
    return d ? `<path class="pty-line ${cls}" d="${d}"/>` : '';
  };
  parts.push(line('ours', (d) => d.medianOurKt));
  parts.push(line('theirs', (d) => d.medianTheirKt));
  const fig = (v: number | null): string => (v == null ? '—' : `${fmtFigure(v)}${o.unit}`);
  const half = (R - L) / span / 2;
  for (const day of o.days) {
    const cx = x(day.date);
    parts.push(
      `<g><title>${esc(`${dayLabel(day.date)}: ${o.names[0]} ${fig(day.medianOurKt)}, ${o.names[1]} ${fig(day.medianTheirKt)}, ${day.runs} runs`)}</title>` +
        `<rect class="pty-hit" x="${r1(Math.max(L, cx - half))}" y="${y0}" width="${r1(Math.min(R, cx + half) - Math.max(L, cx - half))}" height="${PH}"/></g>`,
    );
  }
  parts.push('</svg>');
  return parts.join('');
}

export interface ShareRow {
  label: string;
  agree: number;
  n: number;
  /** A heading printed once above the first row that carries it, in the
   *  table's grouping; rows with the same group follow each other. */
  group?: string;
}

/**
 * One row per field: its name, its agreed-of-compared figures and a bar of
 * that share on a track of the whole. The figures are printed because a
 * share is read against its count (1 of 1 and 1,343 of 1,344 are the same
 * bar), and the bar is a count's share of a count, never a judgement of it.
 */
export function shareBarsSvg(o: { title: string; rows: readonly ShareRow[] }): string {
  const L = 8;
  const R = CHART_W - 8;
  const rowH = 26;
  const headH = 18;
  let y = 4;
  const body: string[] = [];
  let group: string | undefined;
  for (const row of o.rows) {
    if (row.group != null && row.group !== group) {
      group = row.group;
      body.push(`<text class="pty-group" x="${L}" y="${y + 12}">${esc(group)}</text>`);
      y += headH;
    }
    const share = row.n === 0 ? 0 : row.agree / row.n;
    const figures = row.n === 0 ? 'no runs yet' : `${row.agree.toLocaleString('en-US')} of ${row.n.toLocaleString('en-US')}`;
    const pctWord = row.n === 0 ? '' : ` (${Math.round(share * 100)}%)`;
    body.push(`<g><title>${esc(`${row.label}: agreed on ${figures}${pctWord}`)}</title>`);
    body.push(`<rect class="pty-hit" x="${L}" y="${y}" width="${R - L}" height="${rowH}"/>`);
    body.push(`<text class="pty-label" x="${L}" y="${y + 11}">${esc(row.label)}</text>`);
    body.push(`<text class="pty-figure" x="${R}" y="${y + 11}" text-anchor="end">${esc(figures)}</text>`);
    body.push(`<rect class="pty-track" x="${L}" y="${y + 16}" width="${R - L}" height="5" rx="2"/>`);
    if (share > 0) {
      body.push(`<rect class="pty-share" x="${L}" y="${y + 16}" width="${r1((R - L) * share)}" height="5" rx="2"/>`);
    }
    body.push('</g>');
    y += rowH;
  }
  return `${open(CHART_W, y + 2, `${o.title}: ${o.rows.length} fields, the share of runs each agreed on`)}${body.join('')}</svg>`;
}
