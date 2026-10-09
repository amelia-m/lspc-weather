import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { densityAltitude } from '../src/domain/densityAltitude';
import { DensityAltitudePanel } from '../src/components/DensityAltitudePanel';
import { CITATIONS } from '../src/config/thresholds';

/* The NWS calculators' own functions, as their pages' scripts have them
 * (weather.gov/epz/wxcalc_densityaltitude, wxcalc_stationpressure and
 * wxcalc_pressurealtitude, read 2026-10-09), with only the parseFloat calls
 * and the page's unit handling dropped. */
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
  // wxcalc_stationpressure's decideConvert, with Mheight = 0.3048 × feet.
  stnpressure: (INpressure: number, Mheight: number) => INpressure * Math.pow((288 - 0.0065 * Mheight) / 288, 5.2561),
};

/** The station pressure, in inHg, at which `altpress` gives `paFt`: the
 *  pressure a reader would recover from the card's pressure-altitude row. */
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
      const p = nws.stnpressure(altimeterInHg, 0.3048 * FIELD);
      expect(r.stationPressureInHg).toBe(Math.round(p * 100) / 100);
      expect(r.pressureAltitudeFt).toBe(Math.round(nws.altpress(nws.convertinHGtomb(p))));
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
    expect(Math.abs(r.pressureAltitudeFt - FIELD)).toBeLessThanOrEqual(5);
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
   * 3,728 and humid 4,117. */
  it('no longer reads the old formula’s figure on a hot, humid day', () => {
    const r = densityAltitude({ elevationFt: FIELD, altimeterInHg: 29.92, oatC: 35, dewpointC: 24 });
    expect(r.densityAltitudeFt).toBe(3728);
    expect(r.humidDensityAltitudeFt).toBe(4117);
  });

  /* Away from 29.92 the pilot's 1,000 ft per inch rule drifts from the
   * standard atmosphere's altitude; the card prints the latter, which is
   * what the density altitude is worked from. */
  it('takes pressure altitude from the station pressure, and the ISA deviation at that altitude', () => {
    const r = densityAltitude({ elevationFt: FIELD, altimeterInHg: 30.5, oatC: 15 });
    const rule = FIELD + (29.92 - 30.5) * 1000; // 602
    expect(Math.abs(r.pressureAltitudeFt - rule)).toBeGreaterThan(20);
    expect(r.isaDeviationC).toBe(Math.round((15 - (15 - 1.98 * (r.pressureAltitudeFt / 1000))) * 10) / 10);
  });

  /* The headline follows from the rows printed under it, as an E6B's does:
   * the pressure the card's pressure altitude stands for, and the
   * temperature, give the headline in the NWS calculator's formula. */
  it('follows from the printed pressure altitude and temperature', () => {
    for (const [altimeterInHg, oatC] of [[29.92, 30], [30.5, -10], [29.4, 35]]) {
      const r = densityAltitude({ elevationFt: FIELD, altimeterInHg, oatC });
      const fromRows = nws.densityAltitude(stationPressureFor(r.pressureAltitudeFt), r.oatC + 273.15);
      expect(Math.abs(r.densityAltitudeFt - fromRows)).toBeLessThanOrEqual(2);
    }
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
    expect(html).toContain('<span class="da-big">3,728</span>');
    expect(html).toContain('<dt>With humidity</dt><dd>4,117 ft</dd>');
  });

  it('prints the station pressure, temperature and dew point it was worked from, to the report’s tenth', () => {
    const html = render(24.1, 35.3);
    expect(html).toContain('<dt>Station pressure</dt><dd>28.66 inHg</dd>');
    expect(html).toContain('<dt>Temperature</dt><dd>95.5°F</dd>');
    expect(html).toContain('<dt>Dew point</dt><dd>75.4°F</dd>');
    expect(render(null)).toContain('<dt>Dew point</dt><dd>not reported</dd>');
  });

  it('says when the report has no dew point instead of leaving the row out', () => {
    expect(render(null)).toContain('<dt>With humidity</dt><dd>no dew point in the report</dd>');
  });

  it('prints a density altitude below the field with its own sign', () => {
    const html = render(-15, -10, 30.5);
    expect(html).toContain('<dt>Above field</dt><dd>-3,472 ft</dd>');
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
