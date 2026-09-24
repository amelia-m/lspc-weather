import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TafPanel } from '../src/components/TafPanel';
import { parseTaf } from '../src/domain/normalize';
import type { SourceStatus } from '../src/domain/types';
import { KLNK_2026_09_23_1120, KOMA_2026_09_24_0521 } from './support/tafProducts';

const idle: SourceStatus = { ok: true, fetchedAt: null, stale: false, error: null, pending: false };

function render(product: { productText?: string; issuanceTime?: string }, station: string): string {
  const taf = parseTaf(product.productText!, station, product.issuanceTime);
  return renderToStaticMarkup(createElement(TafPanel, { taf, status: idle }));
}

describe('TafPanel decoded periods', () => {
  const html = render(KOMA_2026_09_24_0521, 'KOMA');

  it('keeps the raw text above the decoded table', () => {
    const raw = html.indexOf('<pre class="metar-raw">');
    const table = html.indexOf('<table class="taf-table">');
    expect(raw).toBeGreaterThan(-1);
    expect(table).toBeGreaterThan(raw);
  });

  it('shows one row per period with the group, local times, wind, visibility, sky and weather', () => {
    const rows = html.match(/<tr title="[^"]*">/g) ?? [];
    expect(rows).toHaveLength(4);
    expect(html).toContain('<td>Prevailing</td>');
    expect(html).toContain('<td>From</td>');
    // 2406Z to 2416Z on the 24th is 1:00 AM to 11:00 AM CDT on a Thursday:
    // the local clock, not the Z group, and the weekday once.
    expect(html).toContain('<span class="taf-layer">Thu 1:00 AM</span><span class="taf-layer">to 11:00 AM</span>');
    // The last period crosses local midnight, so the weekday repeats.
    expect(html).toContain('<span class="taf-layer">Thu 11:00 PM</span><span class="taf-layer">to Fri 1:00 AM</span>');
    expect(html).toContain('<td>130° 9 kt</td>');
    expect(html).toContain('<td>6+ SM</td>');
    expect(html).toContain('<td>4 SM</td>');
    expect(html).toContain(
      '<td class="taf-wrap"><span class="taf-layer">FEW 5,000 ft</span><span class="taf-layer">BKN 15,000 ft</span></td>',
    );
    expect(html).toContain('<td class="taf-wrap">light rain showers, mist</td>');
  });

  it('gives each row the FAA category of its own ceiling and visibility, and cites the AIM', () => {
    // P6SM under a 15,000 ft broken layer is VFR; 4 SM under 2,400 ft is MVFR.
    expect(html).toContain('fc-vfr');
    expect(html).toContain('fc-mvfr');
    expect(html).not.toContain('fc-ifr');
    expect(html).toContain('chap7_section_1');
  });

  it('asserts nothing beyond the decode: no warning colour, no verdict', () => {
    expect(html).not.toMatch(/class="[^"]*(warn|caution|danger|bad)[^"]*"/);
    expect(html).not.toMatch(/\b(no[- ]go|jumpable|unsafe|marginal conditions)\b/i);
  });
});

describe('TafPanel change rows', () => {
  const html = render(KLNK_2026_09_23_1120, 'KLNK');

  it('leaves the elements a TEMPO does not state blank and explains the blank', () => {
    const tempo = /<tr title="TEMPO 2312\/2313 BKN009 OVC015">(.*?)<\/tr>/.exec(html);
    expect(tempo).not.toBeNull();
    const cells = tempo![1].match(/<td[^>]*>(.*?)<\/td>/g)!;
    expect(cells[0]).toBe('<td>Temporary</td>');
    expect(cells[2]).toBe('<td></td>'); // wind not stated
    expect(cells[3]).toBe('<td></td>'); // visibility not stated
    expect(cells[4]).toBe(
      '<td class="taf-wrap"><span class="taf-layer">BKN 900 ft</span><span class="taf-layer">OVC 1,500 ft</span></td>',
    );
    expect(html).toContain('A blank cell on a change row means that element stays as the prevailing row says.');
  });

  it('reads the TEMPO category with the prevailing visibility: 900 ft under P6SM is IFR', () => {
    const tempo = /<tr title="TEMPO 2312\/2313 BKN009 OVC015">(.*?)<\/tr>/.exec(html)!;
    expect(tempo[1]).toContain('fc-ifr');
  });
});

describe('TafPanel without a decodable forecast', () => {
  it('renders no table when there is no TAF', () => {
    const html = renderToStaticMarkup(createElement(TafPanel, { taf: null, status: idle }));
    expect(html).not.toContain('taf-table');
  });
});
