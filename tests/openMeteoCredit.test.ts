import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppFooter } from '../src/components/AppFooter';
import { AdvisoryPanel } from '../src/components/AdvisoryPanel';
import { DailyForecastPanel } from '../src/components/DailyForecastPanel';
import { WindsAloftPanel } from '../src/components/WindsAloftPanel';
import { DriftPanel } from '../src/components/DriftPanel';
import { ParityPage } from '../src/components/ParityPage';
import { summarizeParity } from '../src/domain/paritySummary';
import { DATA_SOURCES } from '../src/config/sources';

/* Open-Meteo's terms (open-meteo.com/en/licence, read 2026-10-08) license its
 * data under CC BY 4.0: credit, a link to the licence, a note of what was
 * changed, and a link to Open-Meteo beside wherever its data are shown. And
 * the converse: a Data line that credits Open-Meteo for data it did not
 * supply is a source claim the reader cannot check. */
const LICENCE = `<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>`;
// The card's Data line, or '' when it has none. A missing footer is not an
// error (a card with nothing to credit has none), but it must not leave a
// slice of the card behind for a not.toContain to pass on vacuously.
const dataLine = (html: string) => {
  const i = html.indexOf('<footer class="panel-sources">');
  return i < 0 ? '' : html.slice(i);
};

describe('Open-Meteo in the cards’ Data lines', () => {
  const level = { altitudeFtAgl: 3000, altitudeFtMsl: 4182, directionDeg: 270, speedKt: 10, tempC: 0 };
  const winds = (source: 'open-meteo' | 'nws-fd' | null) =>
    renderToStaticMarkup(
      createElement(WindsAloftPanel, {
        levels: [level],
        source,
        validity: { validMs: Date.parse('2026-09-22T04:00:00Z') },
        unit: 'kt',
        onUnitChange: () => {},
      } as never),
    );
  const daily = (source: 'open-meteo' | 'nws-gridpoint' | null) =>
    renderToStaticMarkup(
      createElement(DailyForecastPanel, { daily: [], source, hourly: [], unit: 'kt', onUnitChange: () => {} }),
    );

  it('credits Open-Meteo with its licence beside its own data', () => {
    expect(dataLine(winds('open-meteo'))).toContain(`>Open-Meteo</a> (${LICENCE})`);
    expect(dataLine(daily('open-meteo'))).toContain(`>Open-Meteo</a> (${LICENCE})`);
  });

  it('does not credit Open-Meteo on a fallback, or for data it did not supply', () => {
    expect(dataLine(winds('nws-fd'))).toContain(`>${DATA_SOURCES.fdWinds.label}</a>`);
    expect(dataLine(winds('nws-fd'))).not.toContain('Open-Meteo');
    expect(dataLine(daily('nws-gridpoint'))).toContain(`>${DATA_SOURCES.nwsForecast.label}</a>`);
    expect(dataLine(daily('nws-gridpoint'))).not.toContain('Open-Meteo');
    // Neither source answered: nothing is shown, so nobody is credited,
    // not even Schulze's cross-reference, which would read as the source.
    const drift = (source: 'open-meteo' | 'nws-fd' | null) =>
      renderToStaticMarkup(createElement(DriftPanel, { levels: [], profile: 'licensed', source } as never));
    expect(dataLine(drift('open-meteo'))).toContain(`>Open-Meteo</a> (${LICENCE})`);
    for (const html of [winds(null), daily(null), drift(null)]) {
      expect(html).toContain('<section');
      expect(dataLine(html)).toBe('');
    }
    // The outlook's hourly detail is the NWS gridpoint's on both paths.
    expect(dataLine(daily('open-meteo'))).toContain(`>${DATA_SOURCES.nwsForecast.label}</a>`);
    // No flag reads a forecast: the observation and the computed sun times.
    const flags = dataLine(
      renderToStaticMarkup(createElement(AdvisoryPanel, { advisories: [], profile: 'Student', hasSourcedWindLimit: true })),
    );
    expect(flags).not.toContain('Open-Meteo');
    expect(flags).not.toContain(DATA_SOURCES.nwsForecast.label);
    expect(flags).toContain(DATA_SOURCES.computed.label);
  });
});

describe('the Open-Meteo credit', () => {
  const at = Date.parse('2026-09-25T12:00:00Z');
  const withWinds = summarizeParity(
    [{ kind: 'schulze', at: '2026-09-24T01:00:00Z', aligned: { rows: [{ ft: 1000, dDir: 1, dSpd: 0, dT: 0 }] } }] as never,
    at,
  );
  const usairnetOnly = summarizeParity(
    [{ kind: 'usairnet', at: '2026-09-24T01:00:05Z', v: 2, sameReport: true, fields: [{ name: 'clouds', same: true }] }] as never,
    at,
  );
  const parity = (state: 'ready' | 'loading' | 'missing' | 'error', summary = withWinds) =>
    renderToStaticMarkup(createElement(ParityPage, { summary: state === 'ready' ? summary : null, state }));

  it('credits Open-Meteo, links the licence, and says what is changed, on the page footer', () => {
    const html = renderToStaticMarkup(createElement(AppFooter));
    expect(html).toContain('>Weather data by Open-Meteo.com</a>');
    expect(html).toContain(LICENCE);
    expect(html).toContain('the winds aloft, the drift estimate and the 10-day outlook’s day rows');
    expect(html).toContain('interpolated from pressure levels to heights above the drop zone');
    expect(html).toContain('weather codes grouped into its own labels');
    expect(html).toContain('unless it is unreachable, when those cards name the fallback that answered, if one did');
  });

  it('credits the winds and quoted figures on #parity, which has no outlook or drift card', () => {
    // Any summary: the context notes quote Open-Meteo figures even with no
    // winds runs in it.
    for (const html of [parity('ready'), parity('ready', usairnetOnly)]) {
      expect(html).toContain('>Weather data by Open-Meteo.com</a>');
      expect(html).toContain(LICENCE);
      expect(html).toContain('this dashboard’s winds, compared on this page');
      expect(html).toContain('its Ground row is the 10 m wind as served');
      expect(html).not.toContain('those cards');
    }
  });

  it('is left off #parity while it shows no summary', () => {
    for (const html of [parity('loading'), parity('missing'), parity('error')]) {
      expect(html).not.toContain('Weather data by Open-Meteo.com');
    }
  });
});
