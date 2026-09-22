import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WindsAloftPanel } from '../src/components/WindsAloftPanel';
import type { WindsAloftLevel } from '../src/domain/types';
import { interpAngle, interpolateWindsAloft, type RawWindSample } from '../src/domain/windsAloft';

describe('interpAngle', () => {
  it('takes the short arc across north', () => {
    expect(((interpAngle(350, 10, 0.5) % 360) + 360) % 360).toBeCloseTo(0, 5);
  });
  it('interpolates linearly within a quadrant', () => {
    expect(interpAngle(90, 180, 0.5)).toBeCloseTo(135, 5);
  });
});

describe('interpolateWindsAloft', () => {
  const samples: RawWindSample[] = [
    { heightFtMsl: 1200, speedKt: 10, directionDeg: 200 },
    { heightFtMsl: 4200, speedKt: 30, directionDeg: 220 },
  ];

  it('interpolates speed at a midpoint altitude', () => {
    const out = interpolateWindsAloft(samples, 1182, [1518]); // 1182+1518=2700 MSL, midpoint
    expect(out).toHaveLength(1);
    expect(out[0].speedKt).toBe(20);
    expect(out[0].altitudeFtMsl).toBe(2700);
  });

  it('drops altitudes outside the sampled range rather than clamping to it', () => {
    // Both of these used to come back clamped — 10 kt at the ground and 30 kt
    // at 100,000 ft — from samples that say nothing about either height.
    const out = interpolateWindsAloft(samples, 0, [0, 100000]);
    expect(out).toEqual([]);
  });

  /* The NOAA FD bulletin's lowest level is 3,000 ft MSL, about 1,800 ft above
   * this DZ, and it carries no surface level. Clamping filled the Surface and
   * 1,000 ft rows from it: live on 2026-09-22 the card read "Surface E 9 kt"
   * while the KPMV METAR reported NE 3 kt. These assert the rows are absent in
   * exactly that arrangement. */
  describe('a bulletin with no surface level', () => {
    const fd: RawWindSample[] = [
      { heightFtMsl: 3000, speedKt: 9, directionDeg: 90 },
      { heightFtMsl: 6000, speedKt: 4, directionDeg: 328 },
      { heightFtMsl: 9000, speedKt: 10, directionDeg: 284 },
    ];

    it('lists no level below its lowest', () => {
      const out = interpolateWindsAloft(fd, 1182, [0, 1000, 2000, 3000]);
      expect(out.map((l) => l.altitudeFtAgl)).toEqual([2000, 3000]);
    });

    it('does not report the 3,000 ft MSL wind as the surface wind', () => {
      const out = interpolateWindsAloft(fd, 1182, [0]);
      expect(out).toEqual([]);
    });
  });

  /* Open-Meteo's 10 m sample IS the ground wind, so it may fill the short gap
   * down to the published field elevation — the model's surface height and the
   * DZ's field elevation differ by a few tens of feet, which is not a layer of
   * atmosphere. Without this the primary path would lose its Surface row.
   *
   * The surface sample sits ABOVE the field elevation here, which is what puts
   * the target below the lowest sample and so actually reaches the isSurface
   * branch. An earlier version of this test used 1,178 ft against a 1,182 ft
   * field: the target was above the sample, the value came from the
   * interpolation loop, and the test passed identically with the flag deleted —
   * it pinned nothing. The paired case below is what proves the flag is load
   * bearing. */
  const SURFACE_ABOVE_FIELD: RawWindSample[] = [
    { heightFtMsl: 1200, speedKt: 6, directionDeg: 36, isSurface: true },
    { heightFtMsl: 4200, speedKt: 30, directionDeg: 220 },
  ];

  it('fills down to field elevation from a surface sample', () => {
    const out = interpolateWindsAloft(SURFACE_ABOVE_FIELD, 1182, [0]);
    expect(out).toHaveLength(1);
    expect(out[0].speedKt).toBe(6);
    expect(out[0].directionDeg).toBe(36);
  });

  it('drops the same row when the lowest sample is not the surface wind', () => {
    const notSurface: RawWindSample[] = SURFACE_ABOVE_FIELD.map((s) => ({
      heightFtMsl: s.heightFtMsl,
      speedKt: s.speedKt,
      directionDeg: s.directionDeg,
    }));
    expect(interpolateWindsAloft(notSurface, 1182, [0])).toEqual([]);
  });

  /* A target sitting exactly ON a sample is a value the source states, so it is
   * kept at both ends. The bottom test was `<=` and dropped it there while the
   * top kept it — at a field elevation on the whole-thousand grid that quietly
   * deleted the bulletin's own lowest row. */
  it('keeps a target that lands exactly on the lowest or highest sample', () => {
    const fd: RawWindSample[] = [
      { heightFtMsl: 3000, speedKt: 9, directionDeg: 90 },
      { heightFtMsl: 6000, speedKt: 4, directionDeg: 328 },
    ];
    const out = interpolateWindsAloft(fd, 1000, [2000, 5000]);
    expect(out.map((l) => l.altitudeFtAgl)).toEqual([2000, 5000]);
    expect(out[0].speedKt).toBe(9); // the 3,000 ft MSL row, verbatim
    expect(out[1].speedKt).toBe(4); // the 6,000 ft MSL row, verbatim
  });

  it('returns nothing when there are no samples', () => {
    expect(interpolateWindsAloft([], 1182, [3000])).toEqual([]);
  });

  it('interpolates temperature when present and is null when absent', () => {
    const withTemp: RawWindSample[] = [
      { heightFtMsl: 1200, speedKt: 10, directionDeg: 200, tempC: 20 },
      { heightFtMsl: 4200, speedKt: 30, directionDeg: 220, tempC: 0 },
    ];
    const out = interpolateWindsAloft(withTemp, 1182, [1518]); // midpoint
    expect(out[0].tempC).toBe(10);

    const noTemp = interpolateWindsAloft(samples, 1182, [1518]);
    expect(noTemp[0].tempC).toBeNull();
  });
});

/**
 * The collapsed winds table keeps a fixed set of key altitudes, chosen for the
 * primary path where the lowest row is the surface. The NOAA FD fallback's
 * profile starts at 2,000 ft AGL — not in that set — so the collapsed view
 * opened at 3,000 ft and hid the lowest wind the bulletin actually offers,
 * while the note beneath it said levels below the bulletin's floor are not
 * listed. A reader would read 3,000 ft as the floor.
 */
describe('the collapsed winds table never hides the lowest available level', () => {
  const rows = (levels: WindsAloftLevel[], source: 'open-meteo' | 'nws-fd'): string[] => {
    const html = renderToStaticMarkup(
      createElement(WindsAloftPanel, {
        levels,
        source,
        validity: { validMs: Date.parse('2026-09-22T04:00:00Z') },
        unit: 'kt',
        onUnitChange: () => {},
      } as never),
    );
    return [...html.matchAll(/>([\d,]+ ft|Surface)</g)].map((m) => m[1]);
  };
  const level = (agl: number): WindsAloftLevel => ({
    altitudeFtAgl: agl,
    altitudeFtMsl: 1182 + agl,
    directionDeg: 270,
    speedKt: 10,
    tempC: 0,
  });

  it('shows the 2,000 ft row on the FD path, where it is the lowest', () => {
    const fd = [2000, 3000, 4000, 5000, 7000, 10000, 13000].map(level);
    expect(rows(fd, 'nws-fd')).toContain('2,000 ft');
  });

  it('still collapses the primary path to the key altitudes', () => {
    const om = Array.from({ length: 14 }, (_, i) => level(i * 1000));
    const shown = rows(om, 'open-meteo');
    expect(shown).toContain('Surface');
    expect(shown).not.toContain('2,000 ft'); // not a key altitude, and not lowest
  });
});
