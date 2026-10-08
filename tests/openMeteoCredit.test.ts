import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppFooter } from '../src/components/AppFooter';
import { Panel } from '../src/components/common/Panel';
import { ParityPage } from '../src/components/ParityPage';
import { DATA_SOURCES } from '../src/config/sources';

/* Open-Meteo's terms (open-meteo.com/en/licence, read 2026-10-08) license its
 * data under CC BY 4.0: credit, a link to the licence, a note of what was
 * changed, and a link to Open-Meteo beside wherever its data are shown. */
const LICENCE = 'https://creativecommons.org/licenses/by/4.0/';
const credit = '<a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Weather data by Open-Meteo.com</a>';
const licenceLink = `<a href="${LICENCE}" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>`;

describe('the Open-Meteo attribution', () => {
  it('links the licence beside Open-Meteo in a card’s Data line', () => {
    const html = renderToStaticMarkup(
      createElement(Panel, { title: 'Winds aloft', sources: [DATA_SOURCES.openMeteo, DATA_SOURCES.markschulze], children: 'x' }),
    );
    const foot = html.slice(html.indexOf('panel-sources'));
    expect(foot).toContain(`>Open-Meteo</a> (${licenceLink})`);
    // Only the source with a licence carries one.
    expect(foot.match(/CC BY 4\.0/g)).toHaveLength(1);
  });

  it('credits Open-Meteo, links the licence, and says what is changed, on the page footer and #parity', () => {
    for (const html of [
      renderToStaticMarkup(createElement(AppFooter)),
      renderToStaticMarkup(createElement(ParityPage, { summary: null, state: 'loading' })),
    ]) {
      expect(html).toContain(credit);
      expect(html).toContain(licenceLink);
      expect(html).toContain('interpolated from pressure levels to heights above the drop zone');
      expect(html).toContain('weather codes grouped into its own labels');
      // Pointed at the Data lines, so the FD and NWS fallbacks are not
      // claimed as Open-Meteo's.
      expect(html).toContain('Data line says when');
    }
  });
});
