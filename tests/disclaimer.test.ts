import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DashboardDisclaimer } from '../src/components/DashboardDisclaimer';

/* The banner keeps in view what every reader needs before acting, and closes
 * the provenance behind it. renderToStaticMarkup runs no CSS, so "in view"
 * here means outside the <details>, and "closed" means no open attribute. */
describe('the dashboard banner', () => {
  const html = renderToStaticMarkup(createElement(DashboardDisclaimer));
  const [shown, more] = html.split('<details');

  it('keeps who has not endorsed it, that it decides nothing, and who decides outside the closed section', () => {
    expect(shown).toContain('not endorsed or approved by USPA, LSPC, or any licensed professional');
    expect(shown).toContain('it does not decide whether it is safe to jump');
    expect(shown).toContain('the S&amp;TA, and the pilot in command');
  });

  it('moves the reading dates, the photo of the sign and the station offset into a section closed by default', () => {
    expect(more).toBeDefined();
    expect(more).not.toMatch(/^[^>]*\bopen\b/);
    for (const detail of ['2026-09-22 and 2026-09-23', 'photo of the posted sign', 'licensed professional’s sign-off', 'KPMV (~12 mi ENE)']) {
      expect(more).toContain(detail);
      expect(shown).not.toContain(detail);
    }
    expect(more).toContain('href="#citations"');
  });
});
