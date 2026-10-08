import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppFooter } from '../src/components/AppFooter';
import { AdvisoryPanel } from '../src/components/AdvisoryPanel';
import { DailyForecastPanel } from '../src/components/DailyForecastPanel';
import { WindsAloftPanel } from '../src/components/WindsAloftPanel';
import { ParityPage } from '../src/components/ParityPage';
import { summarizeParity } from '../src/domain/paritySummary';
import { DATA_SOURCES } from '../src/config/sources';

/* Open-Meteo's terms (open-meteo.com/en/licence, read 2026-10-08) license its
 * data under CC BY 4.0: credit, a link to the licence, a note of what was
 * changed, and a link to Open-Meteo beside wherever its data are shown. And
 * the converse: a Data line that credits Open-Meteo for data it did not
 * supply is a source claim the reader cannot check. */
const LICENCE = `<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>`;
const dataLine = (html: string) => html.slice(html.indexOf('<footer class="panel-sources">'));

describe('Open-Meteo in the cards’ Data lines', () => {
  const level = { altitudeFtAgl: 3000, altitudeFtMsl: 4182, directionDeg: 270, speedKt: 10, tempC: 0 };
  const winds = (source: 'open-meteo' | 'nws-fd') =>
    renderToStaticMarkup(
      createElement(WindsAloftPanel, {
        levels: [level],
        source,
        validity: { validMs: Date.parse('2026-09-22T04:00:00Z') },
        unit: 'kt',
        onUnitChange: () => {},
      } as never),
    );
  const daily = (source: 'open-meteo' | 'nws-gridpoint') =>
    renderToStaticMarkup(
      createElement(DailyForecastPanel, { daily: [], source, hourly: [], unit: 'kt', onUnitChange: () => {} }),
    );

  it('credits Open-Meteo with its licence beside its own data', () => {
    expect(dataLine(winds('open-meteo'))).toContain(`>Open-Meteo</a> (${LICENCE})`);
    expect(dataLine(daily('open-meteo'))).toContain(`>Open-Meteo</a> (${LICENCE})`);
  });

  it('does not credit Open-Meteo on a fallback, or for data it did not supply', () => {
    expect(dataLine(winds('nws-fd'))).not.toContain('Open-Meteo');
    expect(dataLine(daily('nws-gridpoint'))).not.toContain('Open-Meteo');
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
  const summary = summarizeParity(
    [{ kind: 'schulze', at: '2026-09-24T01:00:00Z', aligned: { rows: [{ ft: 1000, dDir: 1, dSpd: 0, dT: 0 }] } }] as never,
    Date.parse('2026-09-25T12:00:00Z'),
  );
  const parity = (state: 'ready' | 'loading') =>
    renderToStaticMarkup(createElement(ParityPage, { summary: state === 'ready' ? summary : null, state }));

  it('credits Open-Meteo, links the licence, and says what is changed, on the page footer and #parity', () => {
    for (const html of [renderToStaticMarkup(createElement(AppFooter)), parity('ready')]) {
      expect(html).toContain('>Weather data by Open-Meteo.com</a>');
      expect(html).toContain(LICENCE);
      expect(html).toContain('interpolated from pressure levels to heights above the drop zone');
      expect(html).toContain('weather codes grouped into its own labels');
      expect(html).toContain('unless it is unreachable, when those cards name their fallback');
    }
  });

  it('is left off #parity while it shows no figures', () => {
    expect(parity('loading')).not.toContain('Weather data by Open-Meteo.com');
  });
});
