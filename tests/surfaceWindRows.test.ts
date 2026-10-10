import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SurfaceWindPanel } from '../src/components/SurfaceWindPanel';
import { resolveThresholds, withOverrides, type Thresholds, type WindProfileId } from '../src/config/thresholds';
import { normalizeMetar } from '../src/domain/normalize';
import { METAR_FIXTURE } from '../src/api/fixtures/metar';

/* The maintainer, 2026-10-10: on one bar it was not clear the yellow tick
 * was the gust, or what the red and purple marks were. Each limit now has
 * its own row saying which reading it is held to and how far under it that
 * is, or that it is at or above it. The waiver's 21+ tier: caution 15.6 kt,
 * gust ceiling 17.4 kt. */
const card = (wspd: number, wgst: number | null, profile: WindProfileId | Thresholds = 'waiver:21+', unit: 'kt' | 'mph' = 'kt') =>
  renderToStaticMarkup(
    createElement(SurfaceWindPanel, {
      current: normalizeMetar({ ...METAR_FIXTURE[0], wspd, wgst }),
      thresholds: typeof profile === 'string' ? resolveThresholds(profile) : profile,
      label: 'test',
      unit,
      onUnitChange: () => {},
    }),
  );
const statuses = (html: string) =>
  [...html.matchAll(/<span class="wind-check-status( over)?">([^<]*)<\/span>/g)].map((m) => `${m[2]}${m[1] ? ' [over]' : ''}`);

describe('Surface wind limit rows', () => {
  it('holds the caution to the steady wind when there is no gust, and the gust ceiling says none was reported', () => {
    const html = card(10, null);
    expect(statuses(html)).toEqual(['wind 10 kt: 5.6 kt under', 'no gust reported']);
    expect(html).toContain('Caution ≥ 15.6 kt');
    expect(html).toContain('Gust ceiling 17.4 kt');
  });

  it('holds the caution to the gust when the gust is higher, as its flag does', () => {
    // 12 kt gusting 16: under the caution on the steady wind, over it on the gust.
    expect(statuses(card(12, 16))).toEqual(['gust 16 kt: at or above [over]', 'gust 16 kt: 1.4 kt under']);
  });

  it('marks at-or-above exactly at the limit, not only past it', () => {
    // The student caution is a whole 12 kt (the BSR's 14 mph, rounded in
    // thresholds.ts), so a whole-knot reading can sit exactly on it.
    expect(statuses(card(12, null, 'student'))[0]).toBe('wind 12 kt: at or above [over]');
    expect(statuses(card(11, null, 'student'))[0]).toBe('wind 11 kt: 1 kt under');
  });

  it('draws no limit row on Licensed, where no limit is set, and still keys the fill and tick', () => {
    const html = card(25, 35, 'licensed');
    expect(html).not.toContain('wind-check');
    expect(html).toContain('wind-bar');
    expect(html).toMatch(/key-gust[^>]*><\/span> gust<\/p>/);
  });

  it('keys the fill and the tick, so the yellow tick reads as the gust', () => {
    const html = card(10, 14);
    expect(html).toMatch(/key-fill[^>]*><\/span> steady wind/);
    expect(html).toMatch(/key-gust[^>]*><\/span> gust/);
  });

  it('draws the gust tick inside the bar when the gust is the highest mark', () => {
    // 22 kt over the 21+ tier's 17.4 kt ceiling: the scale's top was the
    // gust, so its tick sat at left 100%, past the bar's edge.
    const lefts = [...card(12, 22).matchAll(/wind-gust-tick" style="left:([\d.]+)%/g)].map((m) => Number(m[1]));
    expect(lefts.length).toBeGreaterThan(0);
    for (const l of lefts) expect(l).toBeLessThan(97);
  });

  it('with a gust ceiling alone, still draws the steady wind', () => {
    // Licensed, own gust ceiling, no wind limit: the gust row is the card's
    // only bar, and the steady wind the key names has to be on it.
    const html = card(35, null, withOverrides(resolveThresholds('licensed'), { gustCautionKt: 20 }));
    expect(html).not.toContain('band-caution');
    expect(html).toContain('wind-fill');
    expect(html).toMatch(/key-fill[^>]*><\/span> steady wind/);
  });

  it('calls an own wind limit the reader’s in the key, not the caution', () => {
    const html = card(10, 14, withOverrides(resolveThresholds('licensed'), { windCautionKt: 18 }));
    expect(html).toContain('your limit counts whichever is higher');
    expect(html).not.toContain('the caution counts');
  });

  it('prints a distance that adds up with the reading and the limit as shown, in either unit', () => {
    // Every whole-knot reading under every limit from 10 to 22 kt in tenths:
    // reading + distance is the limit as printed, or the row says "just
    // under" where an mph reading rounds up to a limit it is still under.
    for (const unit of ['kt', 'mph'] as const) {
      for (let tenths = 100; tenths <= 220; tenths++) {
        const t = withOverrides(resolveThresholds('licensed'), { windCautionKt: tenths / 10 });
        const html = card(10, null, t, unit);
        const limit = Number(/Your limit ≥ ([\d.]+)/.exec(html)![1]);
        const [status] = statuses(html);
        const m = /^wind (\d+) \w+: ([\d.]+) \w+ under$/.exec(status);
        if (m) expect(Number((Number(m[1]) + Number(m[2])).toFixed(1))).toBe(limit);
        else expect(status).toMatch(/at or above|just under/);
      }
    }
  });
});
