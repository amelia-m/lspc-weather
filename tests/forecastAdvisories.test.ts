import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { evaluateAdvisories, FORECAST_FLAG_HOURS, forecastWindAdvisories, hourRuns } from '../src/domain/advisories';
import { AdvisoryPanel } from '../src/components/AdvisoryPanel';
import { CITATIONS, resolveThresholds, withOverrides } from '../src/config/thresholds';
import { advisoriesFor } from '../src/config/views';
import { normalizeMetar } from '../src/domain/normalize';
import { METAR_FIXTURE } from '../src/api/fixtures/metar';
import type { HourlyPoint, WeatherSnapshot } from '../src/domain/types';

/* The maintainer's screenshot, 2026-10-10 08:47 CDT: KPMV at 10 kt with no
 * gust, the waiver's 21+ tier (wind 15.6 kt, gusts 17.4 kt), and the NWS
 * forecasting gusts to 28 kt from 10am to 7pm. The list was empty. */
const now = Date.parse('2026-10-10T13:47:00Z');
const H = 3_600_000;
const at = (utcHour: number, wind: number, gust: number | null): HourlyPoint => ({
  time: Date.parse('2026-10-10T00:00:00Z') + utcHour * H,
  skyCoverPct: null,
  ceilingFtAgl: null,
  visibilitySm: null,
  windSpeedKt: wind,
  windGustKt: gust,
  windDirectionDeg: 180,
  precipProbPct: null,
  thunderProbPct: null,
  precipAmountIn: null,
  tempC: null,
});
// 13Z (8am CDT) to 06Z next day: gusts over 17.4 kt from 15Z (10am) through
// the 23Z hour (ending 7pm); steady wind at 16 kt from 18Z to 20Z.
const hourly: HourlyPoint[] = [
  at(12, 6, null), // past, ended before now
  at(13, 7, 9),
  at(14, 9, 15),
  ...[15, 16, 17].map((h) => at(h, 13, 26)),
  ...[18, 19, 20].map((h) => at(h, 16, 28)),
  ...[21, 22, 23].map((h) => at(h, 12, 22)),
  at(24, 10, 17),
  at(25, 9, 16),
  // Past the 12-hour window, which ends at 01:47Z.
  at(26, 20, 30),
];
const calm = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 10, wgst: null });
const snap = (over: Partial<WeatherSnapshot> = {}): WeatherSnapshot => ({
  current: calm,
  hourly,
  daily: [],
  windsAloft: [],
  sun: null,
  densityAltitude: null,
  taf: null,
  ...over,
});
const waiver21 = resolveThresholds('waiver:21+');

describe('forecast wind flags', () => {
  const out = evaluateAdvisories(snap(), waiver21, now);
  const gust = out.find((a) => a.id === 'forecast-gust');
  const wind = out.find((a) => a.id === 'forecast-wind');

  it('flags the waiver gust ceiling the forecast reaches, with its hours and peak', () => {
    expect(out.some((a) => a.id === 'gust-limit' || a.id === 'surface-wind')).toBe(false);
    expect(gust?.level).toBe('forecast');
    expect(gust?.value).toBe('10am–7pm, to 28 kt');
    expect(gust?.guidance).toContain('17.4 kt');
    expect(gust?.guidance).toContain('the LSPC waiver gust ceiling for this experience tier');
    expect(gust?.guidance).toContain('A forecast, not a reading: the Gust limit flag fires if KPMV reports it.');
    expect(gust?.citation).toBe(CITATIONS.lspcWaiver);
  });

  it('flags the surface-wind caution on the same test as the reading: gusts included', () => {
    // At or above 15.6 kt counting gusts: 14Z's 15 is under it; 15Z through
    // the 25Z hour are over it (24Z's gust 17 and 25Z's 16 too, which the
    // gust ceiling's 17.4 kt does not reach), so the run ends at 9pm.
    expect(wind?.level).toBe('forecast');
    expect(wind?.value).toBe('10am–9pm, to 28 kt');
  });

  it('reads only the coming 12 hours, the hour in progress included', () => {
    expect(FORECAST_FLAG_HOURS).toBe(12);
    // The 26Z hour's 30 kt is past the window, so the peak stays 28.
    expect(gust?.value).not.toContain('30');
    // An hour in progress counts: from 14:30Z, the 14Z hour is in it.
    const late = forecastWindAdvisories([at(14, 16, 18)], waiver21, Date.parse('2026-10-10T14:30:00Z'), 'kt');
    expect(late.map((a) => a.id)).toEqual(['forecast-wind', 'forecast-gust']);
    // An hour that has ended does not.
    expect(forecastWindAdvisories([at(13, 16, 18)], waiver21, Date.parse('2026-10-10T14:30:00Z'), 'kt')).toEqual([]);
  });

  it('ranks below every observed flag', () => {
    const windy = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 12, wgst: 22 });
    const list = evaluateAdvisories(snap({ current: windy }), waiver21, now);
    const firstForecast = list.findIndex((a) => a.level === 'forecast');
    const lastObserved = list.map((a) => a.level).lastIndexOf('caution');
    expect(firstForecast).toBeGreaterThan(lastObserved);
  });

  it('raises nothing on Licensed with no limit of the reader’s own, and says so when one is set', () => {
    expect(forecastWindAdvisories(hourly, resolveThresholds('licensed'), now, 'kt')).toEqual([]);
    const own = withOverrides(resolveThresholds('licensed'), { gustCautionKt: 20 });
    const flags = forecastWindAdvisories(hourly, own, now, 'kt');
    expect(flags.map((a) => a.id)).toEqual(['forecast-gust']);
    expect(flags[0].guidance).toContain('the gust ceiling you set in Settings');
  });

  it('stays off the Pilots tab, like the flags on the reading', () => {
    expect(advisoriesFor('pilots', out).some((a) => a.id.startsWith('forecast-'))).toBe(false);
    expect(advisoriesFor('jumpers', out).some((a) => a.id === 'forecast-gust')).toBe(true);
  });

  it('says which of the BSR’s two figures the Student flag uses, as the flag on the report does', () => {
    const flag = forecastWindAdvisories(hourly, resolveThresholds('student'), now, 'kt').find((a) => a.id === 'forecast-wind');
    expect(flag?.guidance).toContain('The band and flag here use 12 kt');
    expect(flag?.guidance).toContain('nothing on this page flags the lower limit');
  });

  it('words the gust ceiling as the Gust limit flag does: own, edited, and the waiver’s measure', () => {
    expect(gust?.guidance).toContain('which the waiver sets on gusts measured over the last 30 min');
    const own = forecastWindAdvisories(hourly, withOverrides(resolveThresholds('licensed'), { gustCautionKt: 20 }), now, 'kt');
    // The BSR link beside it backs the profile's guidance, which it quotes.
    expect(own.map((a) => a.id)).toEqual(['forecast-gust']);
    expect(own[0].guidance).toContain(resolveThresholds('licensed').windGuidance);
    const edited = forecastWindAdvisories(hourly, withOverrides(waiver21, { gustCautionKt: 25 }), now, 'kt').find(
      (a) => a.id === 'forecast-gust',
    );
    expect(edited?.guidance).toContain('the gust ceiling as edited in Settings');
    expect(edited?.guidance).toContain("The LSPC waiver's ceiling for this experience tier is 17.4 kt");
  });

  it('holds the forecast in whole knots, so the peak it prints reaches the limit it names', () => {
    // The gridpoint's 32.3 km/h is 17.44 kt: 17 kt, under the 17.4 kt
    // ceiling, as a METAR would report it. 33 km/h (17.8 kt) is 18.
    const kmh = (v: number) => v / 1.852;
    const quiet = forecastWindAdvisories([at(14, 5, kmh(32.3))], waiver21, now, 'kt');
    expect(quiet.some((a) => a.id === 'forecast-gust')).toBe(false);
    const over = forecastWindAdvisories([at(14, 5, kmh(33))], waiver21, now, 'kt');
    expect(over.find((a) => a.id === 'forecast-gust')?.value).toBe('9am–10am, to 18 kt');
  });

  it('credits the NWS forecast in the list’s footer only when a Forecast flag is shown', () => {
    const render = (advisories: typeof out) =>
      renderToStaticMarkup(createElement(AdvisoryPanel, { advisories, profile: 'waiver:21+', hasWindLimit: true }));
    expect(render(out)).toContain('NWS forecast');
    expect(render(out.filter((a) => a.level !== 'forecast'))).not.toContain('NWS forecast');
  });

  it('shows as Forecast in the list, not as a caution', () => {
    const html = renderToStaticMarkup(
      createElement(AdvisoryPanel, { advisories: out, profile: 'waiver:21+', hasWindLimit: true }),
    );
    expect(html).toContain('badge-forecast');
    expect(html).toContain('>Forecast<');
    expect(html).not.toContain('No conditions flagged');
  });
});

describe('hourRuns', () => {
  it('joins consecutive hours, splits at a gap, and ends a run an hour after its last point', () => {
    const t = (h: number) => Date.parse('2026-10-10T00:00:00Z') + h * H;
    expect(hourRuns([t(15), t(16), t(17)])).toBe('10am–1pm');
    expect(hourRuns([t(19), t(15), t(16)])).toBe('10am–12pm, 2pm–3pm');
  });
});
