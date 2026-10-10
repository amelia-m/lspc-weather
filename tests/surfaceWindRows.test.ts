import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SurfaceWindPanel } from '../src/components/SurfaceWindPanel';
import { spreadLabels } from '../src/components/format';
import { profileShortLabel, resolveThresholds, withOverrides, type Thresholds, type WindProfileId } from '../src/config/thresholds';
import { normalizeMetar } from '../src/domain/normalize';
import { METAR_FIXTURE } from '../src/api/fixtures/metar';

/* The maintainer, 2026-10-10: on one bar it was not clear the yellow tick
 * was the gust, or what the red and purple marks were; then, with a row and
 * a bar per limit, that the card was busy. Now one bar with every mark
 * labelled by its figure, and one line per limit saying what it is held to
 * and how far the reading is from it. The waiver's 21+ tier: caution
 * 15.6 kt, gust ceiling 17.4 kt. */
const card = (
  wspd: number,
  wgst: number | null,
  profile: WindProfileId | Thresholds = 'waiver:21+',
  unit: 'kt' | 'mph' = 'kt',
) =>
  renderToStaticMarkup(
    createElement(SurfaceWindPanel, {
      current: normalizeMetar({ ...METAR_FIXTURE[0], wspd, wgst }),
      thresholds: typeof profile === 'string' ? resolveThresholds(profile) : profile,
      label: typeof profile === 'string' ? profileShortLabel(profile) : 'test',
      unit,
      onUnitChange: () => {},
    }),
  );
/** Each limit line as "label · held to | status [over]". */
const checks = (html: string) =>
  [
    ...html.matchAll(
      /<span class="wind-check-label">(.*?) <span class="muted">· (.*?)<\/span><\/span><span class="wind-check-status( over)?">([^<]*)<\/span>/g,
    ),
  ].map((m) => `${m[1]} · ${m[2]} | ${m[4]}${m[3] ? ' [over]' : ''}`);
/** The figures printed on the bar, by class, with their positions. */
const barLabels = (html: string) =>
  [...html.matchAll(/class="wind-scale-label ([\w-]+)" style="left:([\d.]+)%">([^<]*)</g)].map((m) => ({
    cls: m[1],
    left: Number(m[2]),
    text: m[3],
  }));

describe('Surface wind card', () => {
  it('labels every mark on one bar with its figure', () => {
    const labels = barLabels(card(15, 21, 'waiver:21+', 'mph'));
    expect(labels.map((l) => `${l.cls} ${l.text}`)).toEqual([
      'band-caution-text 18',
      'band-gust-text 20',
      'wind-label 17',
      'gust-label 24',
    ]);
    // One bar, not one per limit, and no key to read it by.
    expect(card(15, 21).match(/class="wind-bar"/g)).toHaveLength(1);
    expect(card(15, 21)).not.toContain('wind-key');
  });

  it('lists each limit with what it is held to, and how far the reading is from it', () => {
    // 12 kt gusting 16: the caution is held to the gust, the higher.
    expect(checks(card(12, 16))).toEqual([
      'Caution ≥ 15.6 kt · wind or gust | 0.4 kt over [over]',
      'Gust ceiling 17.4 kt · gust | 1.4 kt under',
    ]);
    expect(checks(card(10, null))).toEqual([
      'Caution ≥ 15.6 kt · wind or gust | 5.6 kt under',
      'Gust ceiling 17.4 kt · gust | no gust reported',
    ]);
  });

  it('says "at or above" on the limit, which the flag counts as reached', () => {
    // The student caution is a whole 12 kt (the BSR's 14 mph, rounded in
    // thresholds.ts), so a whole-knot reading can sit exactly on it.
    expect(checks(card(12, null, 'student'))[0]).toBe('Caution ≥ 12 kt · wind or gust | at or above [over]');
    expect(checks(card(11, null, 'student'))[0]).toBe('Caution ≥ 12 kt · wind or gust | 1 kt under');
    // In mph, 16 kt (18.4) is past the 21+ caution (15.6 kt, 18.0) but both
    // print as 18: the line says what the flag says, not "at the limit".
    expect(checks(card(16, null, 'waiver:21+', 'mph'))[0]).toBe('Caution ≥ 18 mph · wind or gust | at or above [over]');
  });

  it('prints distances that add up with the reading and the limit as shown, in either unit', () => {
    // Every limit from 10 to 22 kt in tenths, against readings either side,
    // with and without a higher gust: the reading the caution is held to
    // (the gust when higher) ± distance is the limit as printed, or the
    // line says "just under" / "at or above" where the two round to the same
    // figure.
    for (const unit of ['kt', 'mph'] as const) {
      for (const [wspd, wgst] of [[10, null], [16, null], [20, null], [8, 13], [12, 19]] as const) {
        for (let tenths = 100; tenths <= 220; tenths++) {
          const html = card(wspd, wgst, withOverrides(resolveThresholds('licensed'), { windCautionKt: tenths / 10 }), unit);
          const limit = Number(/Your limit ≥ ([\d.]+)/.exec(html)![1]);
          const held = wgst != null ? 'gust-label' : 'wind-label';
          const shown = Number(barLabels(html).find((l) => l.cls === held)!.text);
          const status = checks(html)[0].split(' | ')[1];
          const m = /^([\d.]+) \w+ (over|under)/.exec(status);
          if (m) {
            const sum = m[2] === 'over' ? shown - Number(m[1]) : shown + Number(m[1]);
            expect(Number(sum.toFixed(1))).toBe(limit);
          } else expect(status).toMatch(/^(at or above \[over\]|just under)$/);
        }
      }
    }
  });

  it('keeps close figures apart: the waiver’s 18 and 20 mph, a wind just under its gust', () => {
    const labels = barLabels(card(15, 16, 'waiver:21+', 'mph'));
    const left = (cls: string) => labels.find((l) => l.cls === cls)!.left;
    expect(left('band-gust-text') - left('band-caution-text')).toBeGreaterThanOrEqual(14);
    expect(left('gust-label') - left('wind-label')).toBeGreaterThanOrEqual(14);
    for (const l of labels) {
      expect(l.left).toBeGreaterThanOrEqual(6);
      expect(l.left).toBeLessThanOrEqual(94);
    }
  });

  it('draws the gust tick inside the bar when the gust is the highest mark', () => {
    const lefts = [...card(12, 22).matchAll(/wind-gust-tick" style="left:([\d.]+)%/g)].map((m) => Number(m[1]));
    expect(lefts).toHaveLength(1);
    expect(lefts[0]).toBeLessThan(97);
  });

  it('on Licensed with no limit, draws the bar and its figures and lists nothing', () => {
    const html = card(25, 35, 'licensed');
    expect(html).not.toContain('wind-checks');
    expect(barLabels(html).map((l) => l.text)).toEqual(['25', '35']);
  });

  it('with a gust ceiling alone, still draws the steady wind and names the ceiling as the reader’s', () => {
    const html = card(35, null, withOverrides(resolveThresholds('licensed'), { gustCautionKt: 20 }));
    expect(html).not.toContain('band-caution');
    expect(html).toContain('wind-fill');
    expect(checks(html)).toEqual(['Your gust ceiling 20 kt · gust | no gust reported']);
  });

  it('calls an own wind limit the reader’s', () => {
    expect(checks(card(10, 14, withOverrides(resolveThresholds('licensed'), { windCautionKt: 18 })))[0]).toBe(
      'Your limit ≥ 18 kt · wind or gust | 4 kt under',
    );
  });

  it('subtitles a waiver tier in a few words', () => {
    expect(profileShortLabel('waiver:21+')).toBe('Student · LSPC waiver 21+');
    expect(profileShortLabel('student')).toBe('Student · USPA BSR');
    expect(profileShortLabel('licensed')).toBe('Licensed');
    expect(card(10, null)).toContain('Student · LSPC waiver 21+');
    expect(card(10, null)).not.toContain('flag bands');
  });
});

describe('spreadLabels', () => {
  it('pushes close positions apart, keeps their order and stays inside the ends', () => {
    expect(spreadLabels([50, 52], 14, 6, 94)).toEqual([50, 64]);
    expect(spreadLabels([52, 50], 14, 6, 94)).toEqual([64, 50]);
    expect(spreadLabels([90, 92], 14, 6, 94)).toEqual([80, 94]);
    expect(spreadLabels([1], 14, 6, 94)).toEqual([6]);
    expect(spreadLabels([20, 70], 14, 6, 94)).toEqual([20, 70]);
    // Pushed back from the end, a label moves only as far as its neighbour
    // needs; ones with room stay where they were.
    expect(spreadLabels([10, 90, 92], 14, 6, 94)).toEqual([10, 80, 94]);
    expect(spreadLabels([5, 20, 90, 92], 14, 6, 94)).toEqual([6, 20, 80, 94]);
  });
});
