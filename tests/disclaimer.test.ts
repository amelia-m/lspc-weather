import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DashboardDisclaimer } from '../src/components/DashboardDisclaimer';
import { METAR_STATION_OFFSET, SITE } from '../src/config/site';
import { withoutGlossaryLinks } from './support/glossaryLinks';

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
    expect(withoutGlossaryLinks(shown)).toContain('the S&amp;TA, and the pilot in command');
  });

  it('moves the reading dates and the photo of the sign into a section closed by default', () => {
    expect(more).toBeDefined();
    expect(more).not.toMatch(/^[^>]*\bopen\b/);
    for (const detail of ['2026-09-22 and 2026-09-23', 'undated photo of the posted sign']) {
      expect(more).toContain(detail);
      expect(shown).not.toContain(detail);
    }
  });

  it('keeps where the observations are taken in view, not in the closed section (the maintainer, 2026-11-24)', () => {
    const station = `Observations are from ${SITE.metarStation.id}, about ${Math.round(METAR_STATION_OFFSET.distanceMi)} mi ${METAR_STATION_OFFSET.compass} of the drop zone, not from the field`;
    expect(shown).toContain(station);
    expect(more).not.toContain('Observations are from');
  });
});
