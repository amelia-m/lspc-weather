import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DashboardDisclaimer } from '../src/components/DashboardDisclaimer';
import { METAR_STATION_OFFSET, SITE } from '../src/config/site';

/* The banner keeps in view what every reader needs before acting, and closes
 * the provenance behind it. renderToStaticMarkup runs no CSS, so "in view"
 * here means outside the <details>, and "closed" means no open attribute. */
describe('the dashboard banner', () => {
  const html = renderToStaticMarkup(createElement(DashboardDisclaimer));
  const [shown, more] = html.split('<details');

  it('keeps who has not endorsed it, that it decides nothing, that its limits are readings and not a sign-off, and who decides outside the closed section', () => {
    expect(shown).toContain('not endorsed or approved by USPA, LSPC, or any licensed professional');
    expect(shown).toContain('it does not decide whether it is safe to jump');
    // A reading is not a sign-off, and CLAUDE.md says the difference is not a
    // detail to smooth over: it stays in view.
    expect(shown).toContain('not a licensed professional’s sign-off: verify each against its source');
    expect(shown).toContain('href="#citations"');
    expect(shown).toContain('the S&amp;TA, and the pilot in command');
  });

  it('moves the reading dates, the photo of the sign and the station offset into a section closed by default', () => {
    expect(more).toBeDefined();
    expect(more).not.toMatch(/^[^>]*\bopen\b/);
    const station = `${SITE.metarStation.id} (~${Math.round(METAR_STATION_OFFSET.distanceMi)} mi ${METAR_STATION_OFFSET.compass})`;
    for (const detail of ['2026-09-22 and 2026-09-23', 'undated photo of the posted sign', station]) {
      expect(more).toContain(detail);
      expect(shown).not.toContain(detail);
    }
  });
});
