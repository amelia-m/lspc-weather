import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SunPanel } from '../src/components/SunPanel';

const HOUR = 3600_000;
// The card reads the clock on first render, so the sun times are set
// relative to it.
const render = (sunriseIn: number, sunsetIn: number): string => {
  const now = Date.now();
  return renderToStaticMarkup(
    createElement(SunPanel, { sun: { sunrise: now + sunriseIn, sunset: now + sunsetIn } }),
  );
};

describe('SunPanel', () => {
  /* Before dawn the solar day's sunset is the coming evening's, ~15 hours
   * off. "15h 0m to sunset" at 4 AM reads as daylight; it is still night. */
  it('says "before sunrise" before dawn rather than counting down to the evening', () => {
    const html = render(2 * HOUR, 14 * HOUR);
    expect(html).toContain('<dt>To sunset</dt><dd>before sunrise</dd>');
  });

  it('counts down in daylight and says "after sunset" after it', () => {
    expect(render(-5 * HOUR, 2 * HOUR + 30 * 60_000 + 20_000)).toMatch(/<dd>2h 3[01]m<\/dd>/);
    expect(render(-12 * HOUR, -HOUR)).toContain('<dt>To sunset</dt><dd>after sunset</dd>');
  });
});
