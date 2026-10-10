import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SurfaceWindPanel } from '../src/components/SurfaceWindPanel';
import { resolveThresholds, type WindProfileId } from '../src/config/thresholds';
import { normalizeMetar } from '../src/domain/normalize';
import { METAR_FIXTURE } from '../src/api/fixtures/metar';

/* The maintainer, 2026-10-10: on one bar it was not clear the yellow tick
 * was the gust, or what the red and purple marks were. Each limit now has
 * its own row saying which reading it is held to and how far under it that
 * is, or that it is at or above it. The waiver's 21+ tier: caution 15.6 kt,
 * gust ceiling 17.4 kt. */
const card = (wspd: number, wgst: number | null, profile: WindProfileId = 'waiver:21+') =>
  renderToStaticMarkup(
    createElement(SurfaceWindPanel, {
      current: normalizeMetar({ ...METAR_FIXTURE[0], wspd, wgst }),
      thresholds: resolveThresholds(profile),
      label: 'test',
      unit: 'kt',
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
    expect(statuses(card(11, null, 'student'))[0]).toMatch(/^wind 11 kt: 1(\.0)? kt under$/);
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
});
