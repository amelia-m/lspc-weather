import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { densityAltitude } from '../src/domain/densityAltitude';
import { DensityAltitudePanel } from '../src/components/DensityAltitudePanel';
import { CITATIONS } from '../src/config/thresholds';

/* The NWS calculators' own functions, as their pages' scripts have them
 * (weather.gov/epz/wxcalc_densityaltitude and wxcalc_pressurealtitude, read
 * 2026-10-09), with only the parseFloat calls dropped. The Density Altitude
 * page takes a station pressure; the card derives it from its pressure
 * altitude, so the test finds the pressure at which the Pressure Altitude
 * page's `altpress` gives that altitude, by bisection, rather than by the
 * closed form the code uses. */
const nws = {
  convertKtoR: (kel: number) => (kel - 273.15) * 1.8 + 32 + 459.67,
  vaporPressure: (cDewpoint: number) => 6.11 * Math.pow(10, (7.5 * cDewpoint) / (237.3 + cDewpoint)),
  virtualTemperature(kel: number, inPressure: number, cDewpoint: number) {
    const e = this.vaporPressure(cDewpoint);
    const mb = 33.8639 * inPressure;
    return kel / (1 - (e / mb) * (1 - 0.622));
  },
  densityAltitude(inPressure: number, tempv: number) {
    const dummy = (17.326 * inPressure) / this.convertKtoR(tempv);
    return 145366 * (1 - Math.pow(dummy, 0.235));
  },
  altpress: (mb: number) => (1 - Math.pow(mb / 1013.25, 0.190284)) * 145366.45,
  convertinHGtomb: (inHG: number) => 33.8639 * inHG,
};

/** The station pressure, in inHg, at which `altpress` gives `paFt`. */
const stationPressureFor = (paFt: number): number => {
  let lo = 500;
  let hi = 1100;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (nws.altpress(mid) > paFt) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2 / 33.8639;
};

const FIELD = 1182;

describe('densityAltitude, by the NWS calculator’s method', () => {
  it('gives the calculator’s figures to the foot: dry from the thermometer, humid from the virtual temperature', () => {
    for (const [oatC, dewpointC, altimeterInHg] of [
      [35, 24, 29.92],
      [30, 22, 29.8],
      [15, 5, 30.1],
      [0, -5, 30.4],
      [-10, -15, 30.5],
    ]) {
      const r = densityAltitude({ elevationFt: FIELD, altimeterInHg, oatC, dewpointC });
      const p = stationPressureFor(FIELD + (29.92 - altimeterInHg) * 1000);
      expect(r.stationPressureInHg).toBe(Math.round(p * 100) / 100);
      expect(r.densityAltitudeFt).toBe(Math.round(nws.densityAltitude(p, oatC + 273.15)));
      expect(r.humidDensityAltitudeFt).toBe(
        Math.round(nws.densityAltitude(p, nws.virtualTemperature(oatC + 273.15, p, dewpointC))),
      );
    }
  });

  it('reads about the field elevation on a standard day', () => {
    // ISA at 1,182 ft is 15 − 1.98 × 1.182 ≈ 12.66 °C. The calculator's
    // rounded constants put a standard day about 20 ft high, at sea level
    // too, which is the calculator's figure and well inside an E6B's scale.
    const r = densityAltitude({ elevationFt: FIELD, altimeterInHg: 29.92, oatC: 12.66 });
    expect(r.pressureAltitudeFt).toBe(FIELD);
    expect(Math.abs(r.densityAltitudeFt - FIELD)).toBeLessThanOrEqual(25);
    expect(Math.abs(r.isaDeviationC)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(densityAltitude({ elevationFt: 0, altimeterInHg: 29.92, oatC: 15 }).densityAltitudeFt)).toBeLessThanOrEqual(25);
  });

  it('keeps the dew point out of the headline, and gives no humid figure without one', () => {
    const dry = densityAltitude({ elevationFt: FIELD, altimeterInHg: 29.92, oatC: 35 });
    const humid = densityAltitude({ elevationFt: FIELD, altimeterInHg: 29.92, oatC: 35, dewpointC: 24 });
    expect(humid.densityAltitudeFt).toBe(dry.densityAltitudeFt);
    expect(dry.humidDensityAltitudeFt).toBeNull();
    expect(humid.humidDensityAltitudeFt! - humid.densityAltitudeFt).toBeGreaterThan(300);
    expect(humid.pressureAltitudeFt).toBe(dry.pressureAltitudeFt);
    expect(humid.isaDeviationC).toBe(dry.isaDeviationC);
  });

  /* The headline used to be PA + 120 × (T − ISA) with the virtual
   * temperature for T: 4,297 ft on this day, against the calculator's dry
   * 3,726 and humid 4,115. */
  it('no longer reads the old formula’s figure on a hot, humid day', () => {
    const r = densityAltitude({ elevationFt: FIELD, altimeterInHg: 29.92, oatC: 35, dewpointC: 24 });
    expect(r.densityAltitudeFt).toBe(3726);
    expect(r.humidDensityAltitudeFt).toBe(4115);
  });

  it('takes pressure altitude by the pilot’s rule, and the ISA deviation at that altitude', () => {
    const r = densityAltitude({ elevationFt: 1000, altimeterInHg: 29.42, oatC: 15 });
    expect(r.pressureAltitudeFt).toBe(1500); // 1000 + (29.92 − 29.42) × 1000
    expect(r.isaDeviationC).toBe(3); // 15 − (15 − 1.98 × 1.5)
  });

  /* The headline follows from the pressure altitude and temperature the card
   * prints, as an E6B's does: two reports with one pressure altitude and one
   * temperature give one density altitude whatever field they are from. */
  it('depends on the pressure altitude and temperature alone', () => {
    const a = densityAltitude({ elevationFt: 1182, altimeterInHg: 29.92, oatC: 30 });
    const b = densityAltitude({ elevationFt: 682, altimeterInHg: 29.42, oatC: 30 });
    expect(b.pressureAltitudeFt).toBe(a.pressureAltitudeFt);
    expect(b.densityAltitudeFt).toBe(a.densityAltitudeFt);
  });
});

describe('the density-altitude card', () => {
  const render = (dewpointC: number | null, oatC = 35, altimeterInHg = 29.92) =>
    renderToStaticMarkup(
      createElement(DensityAltitudePanel, {
        da: densityAltitude({ elevationFt: FIELD, altimeterInHg, oatC, dewpointC }),
      }),
    );

  it('heads with the dry figure and gives the humid one its own named row', () => {
    const html = render(24);
    expect(html).toContain('<span class="da-big">3,726</span>');
    expect(html).toContain('<dt>With humidity</dt><dd>4,115 ft</dd>');
    expect(html).toContain('<dt>Station pressure</dt><dd>28.66 inHg</dd>');
  });

  it('says when the report has no dew point instead of leaving the row out', () => {
    expect(render(null)).toContain('<dt>With humidity</dt><dd>no dew point in the report</dd>');
  });

  it('prints a density altitude below the field with its own sign', () => {
    const html = render(-15, -10, 30.5);
    expect(html).toContain('<dt>Above field</dt><dd>-3,539 ft</dd>');
    expect(html).not.toContain('+-');
  });

  it('cites the FAA pamphlet for the definition and its humidity advice, and the NWS calculator for the arithmetic', () => {
    const html = render(24);
    expect(html).toContain('“pressure altitude corrected for nonstandard temperature variations”');
    expect(html).toContain('“add 10 percent to your computed takeoff distance and anticipate a reduced climb rate”');
    expect(html).toContain(`href="${CITATIONS.faaDensityAltitude.url}"`);
    expect(html).toContain(`href="${CITATIONS.nwsDensityAltitude.url}"`);
    expect(html).not.toContain('Humidity-corrected');
  });
});
