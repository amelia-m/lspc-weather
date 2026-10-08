/**
 * Live check that the Pilots tab's deep links still open what they say.
 *
 * Run daily by .github/workflows/sky-parity.yml with the other live checks
 * (`npx vitest run --config vitest.live.config.ts`), never by `npm test`.
 *
 * Why it exists: the Chart Supplement link carries the current edition as
 * `cycle`, worked out by `chartSupplementCycle`, whose numbering is an
 * inference (see src/domain/chartSupplement.ts). FAA's search answers a
 * wrong edition with a 500, and the first edition that tells the two
 * candidate numberings apart takes effect 2026-10-29. This opens the link as
 * a pilot would that day and fails if Plattsmouth's entry is not there, so
 * the daily run raises the parity issue rather than the link breaking
 * unseen. The run is at 13:00Z, after the 0901Z edition change.
 */
import { describe, expect, it } from 'vitest';
import { pilotLinks } from '../src/config/sources';

const UA = 'Mozilla/5.0 (lspc-weather pilot-link check; github.com/amelia-m/lspc-weather)';

describe('the Pilots tab links', () => {
  const links = pilotLinks(Date.now());
  const link = (start: string) => links.find((l) => l.label.startsWith(start))!.url;

  it('opens Plattsmouth in the current Chart Supplement edition', async () => {
    const url = link('Chart Supplement');
    const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow' });
    const body = await res.text();
    console.log(`Chart Supplement: ${url} -> ${res.status} ${res.url}`);
    expect(res.status).toBe(200);
    // The results page links the entry's PDF pages; the empty search form
    // (where a missing edition redirects) links none.
    expect(body).toMatch(/aeronav\.faa\.gov\/afd\/[^"]+\.pdf/);
  });

  it('opens the GFA and the SIGMET map', async () => {
    for (const start of ['Graphical Forecasts', 'SIGMETs']) {
      const url = link(start);
      const res = await fetch(url, { headers: { 'user-agent': UA } });
      console.log(`${start}: ${url} -> ${res.status}`);
      expect(res.status).toBe(200);
      expect(await res.text()).toMatch(/<title>GFA/);
    }
  });
});
