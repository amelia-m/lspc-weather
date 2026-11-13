import { describe, expect, it } from 'vitest';
import type { Spread } from '../src/domain/paritySummary';
import { CHART_W, dayLabel, dayLinesSvg, dumbbellSvg, fmtFigure, labelColumn, shareBarsSvg, spreadRowsSvg, spreadWords } from '../src/domain/paritySvg';

/* Each test holds a mark to the figure it draws, by the coordinate the
 * figure maps to on the chart's axis: the axis runs from 0 at the label
 * column's right edge to its top at the right margin, so a mark's x is
 * worked here from the same figures and the chart's own constants. The
 * charts set no colour and no verdict class; the stylesheet colours them. */

const spread = (o: Partial<Spread> & { medianAbs: number; p90Abs: number; minAbs: number; maxAbs: number }): Spread => ({
  n: 2,
  meanAbs: o.medianAbs,
  mean: 0,
  ...o,
});

/** The x the chart gives figure `v` with the label column `L` wide and the
 *  axis top `top` (the right margin is 10 on a spread chart). */
const xOn = (v: number, top: number, L: number, R: number): number => Math.round((L + (v / top) * (R - L)) * 10) / 10;

describe('spreadRowsSvg', () => {
  const rows = [
    { label: '9,000', spread: spread({ medianAbs: 1, p90Abs: 2, minAbs: 0, maxAbs: 10 }) },
    { label: '1,000', spread: spread({ medianAbs: 0, p90Abs: 0, minAbs: 0, maxAbs: 0 }) },
    { label: 'Surface', spread: null },
  ];
  const svg = spreadRowsSvg({ title: 'Direction', unit: '°', unitWord: 'runs', rows });

  it('draws the median as a dot, median to 90th as a bar and smallest to largest as a line', () => {
    // The largest figure is 10, so the axis tops at 10 in steps of 2.
    const L = labelColumn(rows.map((r) => r.label), 52);
    const R = CHART_W - 10;
    const x = (v: number) => xOn(v, 10, L, R);
    expect(svg).toContain(`<circle class="pty-median" cx="${x(1)}" cy="13" r="3.5"/>`);
    expect(svg).toContain(`<rect class="pty-core" x="${x(1)}" y="9" width="${Math.round((x(2) - x(1)) * 10) / 10}" height="8" rx="2"/>`);
    expect(svg).toContain(`<line class="pty-range" x1="${x(0)}" x2="${x(10)}" y1="13" y2="13"/>`);
    // Ticks at every step, labelled bare; the unit is in the caption and the titles.
    for (const v of [0, 2, 4, 6, 8, 10]) expect(svg).toContain(`text-anchor="middle">${v}</text>`);
    expect(svg).not.toContain('>12</text>');
  });

  it('draws a row whose figures are all zero as a dot alone, and an empty row as its label', () => {
    // Second row: no bar (zero width) and a dot at 0; third row: no marks.
    const second = svg.slice(svg.indexOf('>1,000<'), svg.indexOf('>Surface<'));
    expect(second).not.toContain('pty-core');
    expect(second).toContain(`<circle class="pty-median" cx="${labelColumn(rows.map((r) => r.label), 52)}" cy="31"`);
    const third = svg.slice(svg.indexOf('>Surface<'));
    expect(third).not.toContain('pty-median');
    expect(third).toContain('no runs yet');
  });

  it('titles each row with the table’s figures, in its unit, so a hover reads as the row does', () => {
    expect(svg).toContain('<title>9,000: median 1°, 90th 2°, 0 to 10°, over 2 runs</title>');
    expect(spreadWords(spread({ n: 1903, medianAbs: 0.5, p90Abs: 12.34, minAbs: 0, maxAbs: 178 }), ' kt')).toBe(
      'median 0.50 kt, 90th 12.3 kt, 0 to 178 kt, over 1,903',
    );
  });

  it('shares an axis when told to, so two charts side by side draw the same figure the same length', () => {
    const own = spreadRowsSvg({ title: 'Speed', unit: ' kt', unitWord: 'runs', rows: [rows[0]] });
    const shared = spreadRowsSvg({ title: 'Speed', unit: ' kt', unitWord: 'runs', rows: [rows[0]], axisMax: 100 });
    const L = labelColumn([rows[0].label], 52);
    const R = CHART_W - 10;
    expect(own).toContain(`cx="${xOn(1, 10, L, R)}"`);
    expect(shared).toContain(`cx="${xOn(1, 100, L, R)}"`);
    expect(shared).toContain('text-anchor="middle">100</text>');
  });

  it('escapes a label and names no colour and no verdict', () => {
    const s = spreadRowsSvg({ title: 'a <b> & c', unit: '°', unitWord: 'runs', rows: [{ label: '<1', spread: rows[0].spread }] });
    expect(s).toContain('&lt;1');
    expect(s).toContain('aria-label="a &lt;b> &amp; c: 1 rows"');
    expect(s).not.toMatch(/fill="|stroke="|#[0-9a-f]{3}/i);
    expect(s).not.toMatch(/caution|watch|warn/);
  });
});

describe('dumbbellSvg', () => {
  const rows = [
    { label: '9 PM–12 AM', a: 5, b: 9, runs: 2 },
    { label: '12–3 AM', a: null, b: null, runs: 0 },
    { label: '3–6 AM', a: 6, b: null, runs: 1 },
  ];
  const svg = dumbbellSvg({ title: 'Ground row', unit: ' kt', names: ['this dashboard', 'Schulze’s'], rows });
  const L = labelColumn(rows.map((r) => r.label), 78);
  const R = CHART_W - 12;
  // The largest figure is 9, so the axis tops at 10 in steps of 2.
  const x = (v: number) => xOn(v, 10, L, R);

  it('joins the two medians with a line and a dot per side', () => {
    expect(svg).toContain(`<line class="pty-link" x1="${x(5)}" x2="${x(9)}" y1="15" y2="15"/>`);
    expect(svg).toContain(`<circle class="pty-dot ours" cx="${x(5)}" cy="15" r="5"/>`);
    expect(svg).toContain(`<circle class="pty-dot theirs" cx="${x(9)}" cy="15" r="5"/>`);
    expect(svg).toContain('<title>9 PM–12 AM: this dashboard 5 kt, Schulze’s 9 kt, 2 runs</title>');
  });

  it('draws a block with no runs as its label and a one-sided block as one dot, no line', () => {
    const second = svg.slice(svg.indexOf('>12–3 AM<'), svg.indexOf('>3–6 AM<'));
    expect(second).toContain('no runs yet');
    expect(second).not.toContain('pty-dot');
    const third = svg.slice(svg.indexOf('>3–6 AM<'));
    expect(third).toContain(`<circle class="pty-dot ours" cx="${x(6)}"`);
    expect(third).not.toContain('pty-dot theirs');
    expect(third).not.toContain('pty-link');
    expect(third).toContain('Schulze’s —, 1 runs');
  });
});

describe('dayLinesSvg', () => {
  const days = [
    { date: '2026-09-24', runs: 3, medianOurKt: 6, medianTheirKt: 8.5, medianGapKt: 3 },
    { date: '2026-09-25', runs: 2, medianOurKt: null, medianTheirKt: 11, medianGapKt: null },
    { date: '2026-09-27', runs: 4, medianOurKt: 10, medianTheirKt: 10, medianGapKt: 1 },
  ];
  const svg = dayLinesSvg({ title: 'Ground row by local day', unit: ' kt', names: ['this dashboard', 'Schulze’s'], days });
  const L = 26;
  const R = CHART_W - 8;
  const PH = 110;
  const base = 6 + PH;
  // Three calendar days from the first to the last; the largest figure is
  // 11, so the top is 15 in steps of 5.
  const x = (off: number) => Math.round((L + (off / 3) * (R - L)) * 10) / 10;
  const y = (v: number) => Math.round((base - (v / 15) * PH) * 10) / 10;

  it('spaces the days by the calendar, so a day with no runs is a gap', () => {
    // Sep 27 is three days after Sep 24, not the third of three points.
    expect(svg).toContain(`<path class="pty-line theirs" d="M${x(0)},${y(8.5)}L${x(1)},${y(11)}L${x(3)},${y(10)}"/>`);
  });

  it('breaks a line where a side has no median that day', () => {
    expect(svg).toContain(`<path class="pty-line ours" d="M${x(0)},${y(6)}M${x(3)},${y(10)}"/>`);
  });

  it('titles each day with both figures and its runs, and labels the first day', () => {
    expect(svg).toContain('<title>Sep 25: this dashboard —, Schulze’s 11 kt, 2 runs</title>');
    expect(svg).toContain('text-anchor="start">Sep 24</text>');
    expect(dayLabel('2026-10-02')).toBe('Oct 2');
  });
});

describe('shareBarsSvg', () => {
  const svg = shareBarsSvg({
    title: 'Same observation on both sides',
    rows: [
      { label: 'wind mph', agree: 1343, n: 1344, group: 'Surface wind' },
      { label: 'wind dir °', agree: 1, n: 4, group: 'Surface wind' },
      { label: 'clouds', agree: 0, n: 0, group: 'Sky and visibility' },
    ],
  });

  it('draws each field’s agreed share on a track of the whole, with its figures printed', () => {
    const W = CHART_W - 16;
    expect(svg).toContain(`<rect class="pty-track" x="8" y="38" width="${W}" height="5" rx="2"/>`);
    expect(svg).toContain(`<rect class="pty-share" x="8" y="38" width="${Math.round((W * 1343) / 1344 * 10) / 10}" height="5" rx="2"/>`);
    expect(svg).toContain(`<rect class="pty-share" x="8" y="64" width="${W / 4}" height="5" rx="2"/>`);
    expect(svg).toContain('text-anchor="end">1,343 of 1,344</text>');
    expect(svg).toContain('<title>wind dir °: agreed on 1 of 4 (25%)</title>');
  });

  it('prints each group heading once, above its first field', () => {
    expect(svg.match(/pty-group/g)).toHaveLength(2);
    expect(svg.indexOf('>Surface wind<')).toBeLessThan(svg.indexOf('>wind mph<'));
    expect(svg.indexOf('>wind dir °<')).toBeLessThan(svg.indexOf('>Sky and visibility<'));
  });

  it('draws a field with no runs as its label and an empty track', () => {
    const last = svg.slice(svg.indexOf('>clouds<'));
    expect(last).toContain('no runs yet');
    expect(last).not.toContain('pty-share"');
  });
});

describe('fmtFigure', () => {
  it('prints figures as the tables do', () => {
    expect(fmtFigure(1903)).toBe('1,903');
    expect(fmtFigure(0.69)).toBe('0.69');
    expect(fmtFigure(18.28)).toBe('18.3');
  });
});

describe('labelColumn', () => {
  it('widens the label column to the longest label, and never below the floor', () => {
    // "Newer run one side" (18 characters) was clipped at the left edge
    // under a fixed column of 104 on 2026-11-11: at 6.6 units a character
    // it needs 125 with the gap.
    expect(labelColumn(['Same run', 'Newer run one side', 'One hour apart'], 104)).toBe(125);
    expect(labelColumn(['9,000', '1,000'], 52)).toBe(52);
  });

  it('moves every label and the axis origin right when a label is long', () => {
    const rows = [{ label: 'Newer run one side', spread: spread({ medianAbs: 1, p90Abs: 2, minAbs: 0, maxAbs: 4 }) }];
    const svg = spreadRowsSvg({ title: 'Direction', unit: '°', unitWord: 'runs', rows, labelWidth: 104 });
    expect(svg).toContain('x="119" y="'); // the label's right edge, 125 - 6
    expect(svg).toMatch(/pty-tick" x="125" y="\d+" text-anchor="middle">0</);
  });
});

describe('dumbbellSvg with equal medians', () => {
  it('draws the second dot smaller inside the first, so neither side reads as missing', () => {
    const svg = dumbbellSvg({ title: 'Ground row', unit: ' kt', names: ['this dashboard', 'Schulze’s'], rows: [{ label: '12–3 PM', a: 10, b: 10, runs: 264 }] });
    const L = labelColumn(['12–3 PM'], 78);
    const cx = xOn(10, 10, L, CHART_W - 12);
    expect(svg).toContain(`<circle class="pty-dot ours" cx="${cx}" cy="15" r="5"/>`);
    expect(svg).toContain(`<circle class="pty-dot theirs" cx="${cx}" cy="15" r="2.5"/>`);
    expect(svg).toContain('this dashboard 10 kt, Schulze’s 10 kt, 264 runs');
  });
});
