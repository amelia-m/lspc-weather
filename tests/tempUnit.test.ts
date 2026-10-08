import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fmtTemp, fmtTempDelta, type TempUnit } from '../src/domain/units';
import { MetarPanel } from '../src/components/MetarPanel';
import { WindsAloftPanel } from '../src/components/WindsAloftPanel';
import { DailyForecastPanel } from '../src/components/DailyForecastPanel';
import { DensityAltitudePanel } from '../src/components/DensityAltitudePanel';
import { normalizeMetar, normalizeOpenMeteoDaily } from '../src/domain/normalize';
import { METAR_FIXTURE } from '../src/api/fixtures/metar';
import { OPEN_METEO_DAILY_FIXTURE } from '../src/api/fixtures/openMeteoDaily';

/* One page-wide temperature unit, switched from any card that shows a
 * temperature, instead of cards printing °C, °F or both as each saw fit. */
describe('temperatures in the page’s unit', () => {
  it('converts a temperature with the 32° offset and a difference without it', () => {
    expect(fmtTemp(20, 'C')).toBe('20°C');
    expect(fmtTemp(20, 'F')).toBe('68°F');
    expect(fmtTempDelta(5, 'C')).toBe('5°C');
    expect(fmtTempDelta(5, 'F')).toBe('9°F');
    expect(fmtTempDelta(-5, 'F', true)).toBe('-9°F');
    expect(fmtTempDelta(5, 'F', true)).toBe('+9°F');
  });

  const current = normalizeMetar({ ...METAR_FIXTURE[0], temp: 20, dewp: 15 });
  const level = { altitudeFtAgl: 3000, altitudeFtMsl: 4182, directionDeg: 270, speedKt: 10, tempC: 10 };
  const da = { densityAltitudeFt: 3000, fieldElevationFt: 1182, pressureAltitudeFt: 1200, isaDeviationC: 10, humidityCorrected: true };
  const cards = (u: TempUnit) => ({
    metar: renderToStaticMarkup(
      createElement(MetarPanel, { current, unit: 'kt', onUnitChange: () => {}, tempUnit: u, onTempUnitChange: () => {} }),
    ),
    winds: renderToStaticMarkup(
      createElement(WindsAloftPanel, {
        levels: [level],
        source: 'open-meteo',
        validity: { validMs: Date.parse('2026-09-22T04:00:00Z') },
        unit: 'kt',
        onUnitChange: () => {},
        tempUnit: u,
        onTempUnitChange: () => {},
      } as never),
    ),
    daily: renderToStaticMarkup(
      createElement(DailyForecastPanel, {
        daily: normalizeOpenMeteoDaily(OPEN_METEO_DAILY_FIXTURE),
        source: 'open-meteo',
        hourly: [],
        unit: 'kt',
        onUnitChange: () => {},
        tempUnit: u,
        onTempUnitChange: () => {},
      }),
    ),
    da: renderToStaticMarkup(createElement(DensityAltitudePanel, { da, tempUnit: u, onTempUnitChange: () => {} })),
  });

  it('shows one unit on every card, the one chosen, and a °F/°C switch on each', () => {
    for (const u of ['F', 'C'] as const) {
      const other = u === 'F' ? 'C' : 'F';
      for (const [name, html] of Object.entries(cards(u))) {
        // Outside the switch's own buttons, only the chosen unit appears.
        const text = html.replace(/<button[^>]*>[^<]*<\/button>/g, '');
        expect(text, name).toContain(`°${u}`);
        expect(text, name).not.toContain(`°${other}`);
        // The switch, named after the card, with the chosen unit pressed.
        expect(html, name).toMatch(/<span id="[^"]+" hidden="">temperature unit<\/span>/);
        expect(html, name).toContain(`aria-pressed="true">°${u}</button>`);
      }
    }
    const f = cards('F');
    expect(f.metar).toContain('68°F / 59°F');
    expect(f.metar).toContain('9°F spread');
    expect(f.winds).toContain('<td>50°F</td>');
    expect(f.daily).toContain('Hi/Lo °F');
    expect(f.da).toContain('+18°F');
    const c = cards('C');
    expect(c.metar).toContain('20°C / 15°C');
    expect(c.metar).toContain('5°C spread');
    expect(c.winds).toContain('<td>10°C</td>');
    expect(c.daily).toContain('Hi/Lo °C');
    expect(c.da).toContain('+10°C');
  });
});
