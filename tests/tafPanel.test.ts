import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TafPanel } from '../src/components/TafPanel';
import { parseTaf } from '../src/domain/normalize';
import type { SourceStatus, TafPassedOver } from '../src/domain/types';
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

  /* Offutt's USAF-issued TAF is never on the NWS feed the app reads, so the
   * card says so plainly (it used to say "isn't always carried") and sends
   * the reader to Offutt's TAF on aviationweather.gov. */
  it('says the NWS feed does not carry Offutt’s TAF, and links it on AWC', () => {
    const html = render(KOMA_2026_09_24_0521, 'KOMA');
    expect(html).toContain('the NWS feed this page reads does not carry it');
    expect(html).toContain('href="https://aviationweather.gov/data/taf/?ids=KOFF"');
    expect(html).not.toContain('always carried');
  });

  it('shows no Offutt note when the card shows Offutt’s own TAF', () => {
    const koff = render(
      { productText: KOMA_2026_09_24_0521.productText!.replace(/KOMA/g, 'KOFF'), issuanceTime: KOMA_2026_09_24_0521.issuanceTime },
      'KOFF',
    );
    expect(koff).toContain('<pre class="metar-raw">');
    expect(koff).not.toContain('does not carry it');
  });
});

describe('TafPanel when a nearer station’s TAF had ended', () => {
  const taf = parseTaf(KOMA_2026_09_24_0521.productText!, 'KOMA', KOMA_2026_09_24_0521.issuanceTime);
  const show = (passedOver: TafPassedOver[]): string =>
    renderToStaticMarkup(createElement(TafPanel, { taf: { ...taf!, passedOver }, status: idle }));
  const html = show([{ station: 'KOFF', endedMs: Date.parse('2026-10-11T16:00:00Z') }]);

  it('says whose TAF ended, and when, with the date', () => {
    expect(html).toContain('Offutt AFB (KOFF)’s latest TAF ended at Sun, Oct 11, 11:00 AM, and the feed has no newer one.');
  });

  it('says so of a cancellation or a NIL TAF', () => {
    const both = show([
      { station: 'KOFF', noForecast: 'CNL' },
      { station: 'KOMA', noForecast: 'NIL' },
    ]);
    expect(both).toContain('Offutt AFB (KOFF)’s latest TAF is a cancellation (CNL).');
    expect(both).toContain('Omaha Eppley Airfield (KOMA)’s latest TAF carries no forecast (NIL).');
  });

  it('drops the note that the nearer station is not carried, which an ended TAF shows is untrue', () => {
    expect(html).not.toContain('does not carry it');
    expect(render(KOMA_2026_09_24_0521, 'KOMA')).toContain('does not carry it');
  });

  it('never calls the station shown the next-nearest, which a passed-over station can make untrue', () => {
    expect(show([{ station: 'KOMA', endedMs: 0 }])).not.toContain('next');
  });
});

describe('TafPanel when the TAF on screen has ended', () => {
  afterEach(() => vi.useRealTimers());
  // KOMA's TAF of 2026-09-24 05:21Z is valid 2406/2506Z.
  const at = (iso: string): string => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse(iso));
    return render(KOMA_2026_09_24_0521, 'KOMA');
  };

  it('says so, with the time it ended, once its valid period is over', () => {
    expect(at('2026-09-25T06:00:00Z')).toContain(
      'This TAF’s valid period ended at Fri, Sep 25, 1:00 AM, and no newer one has been fetched since.',
    );
  });

  it('says nothing of it while the TAF is in force', () => {
    expect(at('2026-09-25T05:59:00Z')).not.toContain('valid period ended');
  });
});

describe('TafPanel with the TAF relay', () => {
  const omaha = parseTaf(KOMA_2026_09_24_0521.productText!, 'KOMA', KOMA_2026_09_24_0521.issuanceTime)!;

  it('says Offutt’s TAF was missing or unreachable, not that no feed carries it, once the relay is set', () => {
    const html = renderToStaticMarkup(createElement(TafPanel, { taf: omaha, status: idle, relay: true }));
    expect(html).toContain('Offutt AFB (KOFF) is nearer, but aviationweather.gov had no TAF for it, or could not be reached, when this was fetched.');
    expect(html).not.toContain('does not carry it');
  });

  it('names and links aviationweather.gov as the source of a TAF read through it', () => {
    const offutt = { ...omaha, station: 'KOFF', via: 'aviationweather' as const };
    const html = renderToStaticMarkup(createElement(TafPanel, { taf: offutt, status: idle, relay: true }));
    expect(html).toContain('href="https://aviationweather.gov/data/taf/?ids=KOFF"');
    expect(html).toContain('AWC TAF · KOFF');
    expect(html).not.toContain('NWS TAF');
    expect(render(KOMA_2026_09_24_0521, 'KOMA')).toContain('NWS TAF');
  });
});
