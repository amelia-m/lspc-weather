import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WindsMethodPage } from '../src/components/WindsMethodPage';
import { SITE } from '../src/config/site';
import { DATA_SOURCES } from '../src/config/sources';

/* The Winds aloft card's method on its own page (#winds-method, since
 * 2026-11-22): the four notes the card used to fold, the field elevation
 * read from config, the links to his tool, the comparison doc and #parity,
 * and no limit, colour or verdict. */
describe('WindsMethodPage', () => {
  const html = renderToStaticMarkup(createElement(WindsMethodPage));

  it('explains the hour, the Surface rows, the ground and the interpolation, in the card’s words', () => {
    expect(html).toContain('<h1>How the winds aloft table is built</h1>');
    for (const note of [', like the card’s', 'Mark Schulze’s Winds Aloft', 'linearly interpolated', 'forecast wind at 10', 'moves on at half past', 'his Surface row']) {
      expect(html).toContain(note);
    }
    // The field elevation is config's figure, not a typed one.
    expect(html).toContain(`${SITE.dz.elevationFt.toLocaleString()}\u00a0ft`);
    // The dated count is the doc's reading, linked.
    expect(html).toContain('over 369 hours to 2026-11-04 the 10\u00a0m row was nearer in 249, his in 47, tied in 73');
    expect(html).toContain('docs/markschulze-altitude-reference.md');
    expect(html).toContain(DATA_SOURCES.markschulze.url.replace('&', '&amp;'));
    expect(html).toContain('href="#parity"');
    expect(html).toContain('href="#"');
  });

  it('grades nothing: no warning class, no limit, no advice to treat the figures as anything', () => {
    expect(html).not.toMatch(/warn|caution|danger|treat them as guidance/);
  });
});
