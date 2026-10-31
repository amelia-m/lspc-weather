import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WindsAloftPanel } from '../src/components/WindsAloftPanel';
import { METAR_STATION_OFFSET } from '../src/config/site';
import { normalizeMetar } from '../src/domain/normalize';
import { METAR_FIXTURE } from '../src/api/fixtures/metar';

/* KPMV's observation under the Winds aloft table (the maintainer,
 * 2026-10-30): the one measured figure on a forecast card, so it must name
 * the station, its distance, the report's time and that it is a report,
 * and sit after the table rather than among its rows. */
const card = (observed: ReturnType<typeof normalizeMetar> | null) =>
  renderToStaticMarkup(
    createElement(WindsAloftPanel, {
      levels: [{ altitudeFtAgl: 0, altitudeFtMsl: 1182, directionDeg: 200, speedKt: 9, tempC: 10 }],
      source: 'open-meteo',
      validity: { validMs: Date.parse('2026-10-31T03:00:00Z') },
      unit: 'kt',
      onUnitChange: () => {},
      observed,
    } as never),
  );

describe('the observation under the Winds aloft table', () => {
  it('names the station, its distance, the report’s time and wind, after the table, as a report', () => {
    const html = card(normalizeMetar({ ...METAR_FIXTURE[0], wdir: 190, wspd: 12, wgst: 22 }));
    const i = html.indexOf('<p class="wind-observed">');
    expect(i).toBeGreaterThan(html.indexOf('</table>'));
    const line = html.slice(i, html.indexOf('</p>', i));
    expect(line).toContain(
      `<strong>Observed</strong> at KPMV (${Math.round(METAR_STATION_OFFSET.distanceMi)} mi ${METAR_STATION_OFFSET.compass} of the DZ)`,
    );
    expect(line).toMatch(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2}:\d{2} (AM|PM)\b/);
    expect(line).toContain('S (190°) 12 kt, gusting 22 kt');
    expect(line).toContain('A report, not a row of the forecast above.');
    // The Surface-row note points at it.
    expect(html).toContain('the observed wind is under the table and on the Surface wind card');
  });

  it('says Calm for a calm report, and shows nothing before the report has loaded', () => {
    expect(card(normalizeMetar({ ...METAR_FIXTURE[0], wdir: 0, wspd: 0, wgst: null }))).toContain(': Calm.');
    expect(card(null)).not.toContain('wind-observed');
  });

  it('shows nothing with no table to set it beside', () => {
    const html = renderToStaticMarkup(
      createElement(WindsAloftPanel, {
        levels: [],
        source: null,
        validity: null,
        unit: 'kt',
        onUnitChange: () => {},
        observed: normalizeMetar({ ...METAR_FIXTURE[0], wdir: 190, wspd: 12, wgst: 22 }),
      } as never),
    );
    expect(html).not.toContain('wind-observed');
  });
});
