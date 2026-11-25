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
 * candidate numberings apart took effect 2026-10-29, and the AIRAC count
 * held that day (cycle 2611 answered 200 with the entry). This opens the
 * link as a pilot would that day and fails if Plattsmouth's entry is not
 * there, so the daily run raises the parity issue rather than the link
 * breaking unseen. The run is at 13:00Z, after the 0901Z edition change.
 */
import { describe, expect, it } from 'vitest';
import { USPA_CANOPY_RISK_QUOTIENT } from '../src/config/canopies';
import { pilotLinks } from '../src/config/sources';
import { fetchWithRetry } from './liveFetch';

const UA = 'Mozilla/5.0 (lspc-weather pilot-link check; github.com/amelia-m/lspc-weather)';

describe('the Pilots tab links', () => {
  const links = pilotLinks(Date.now());
  const link = (start: string) => links.find((l) => l.label.startsWith(start))!.url;

  it('opens Plattsmouth in the current Chart Supplement edition', async () => {
    const url = link('Chart Supplement');
    // Twenty seconds, tried twice on a timeout (scripts/liveFetch.ts).
    const res = await fetchWithRetry(url, { headers: { 'user-agent': UA }, redirect: 'follow' }, 20_000);
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
      const res = await fetchWithRetry(url, { headers: { 'user-agent': UA } }, 20_000);
      console.log(`${start}: ${url} -> ${res.status}`);
      expect(res.status).toBe(200);
      expect(await res.text()).toMatch(/<title>GFA/);
    }
  });
});

/* Not a Pilots tab link, but checked here with the other outbound links:
 * the Wing loading card points at USPA's Canopy Risk Quotient page, and the
 * quiz's earlier address (a PDF) went dead without notice. uspa.org answers
 * a missing page with a 200 and its "404 Error Page", so the body is read. */
describe('the Wing loading card’s link', () => {
  it('opens USPA’s Canopy Risk Quotient quiz', async () => {
    const res = await fetchWithRetry(USPA_CANOPY_RISK_QUOTIENT.url, { headers: { 'user-agent': UA }, redirect: 'follow' }, 20_000);
    const body = await res.text();
    console.log(`Canopy Risk Quotient: ${USPA_CANOPY_RISK_QUOTIENT.url} -> ${res.status} ${res.url}`);
    expect(res.status).toBe(200);
    expect(body).not.toContain('404 Error Page');
    expect(body).toContain('Calculate Your Canopy Risk Quotient');
  });
});
