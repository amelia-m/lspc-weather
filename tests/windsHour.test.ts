import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WindsAloftPanel, type WindsHourNav } from '../src/components/WindsAloftPanel';
import { DriftPanel } from '../src/components/DriftPanel';
import type { WindsAloftLevel } from '../src/domain/types';

const levels: WindsAloftLevel[] = [0, 1000, 3000, 5000, 7000, 10000].map((ft) => ({
  altitudeFtAgl: ft,
  altitudeFtMsl: ft + 1182,
  directionDeg: 200,
  speedKt: 10 + ft / 1000,
  tempC: 15,
}));
const noop = () => {};
const nav = (over: Partial<WindsHourNav> = {}): WindsHourNav => ({
  canBack: true,
  canForward: true,
  following: true,
  onStep: noop,
  onFollow: noop,
  ...over,
});
// 105 minutes ahead of the render's clock: rounds to the same minute however
// many milliseconds the render takes.
const ahead = () => Date.now() + 105 * 60_000;

const winds = (props: Partial<Parameters<typeof WindsAloftPanel>[0]>) =>
  renderToStaticMarkup(
    createElement(WindsAloftPanel, {
      levels,
      source: 'open-meteo',
      validity: { validMs: ahead() },
      unit: 'kt',
      onUnitChange: noop,
      ...props,
    }),
  );

describe('Winds aloft hour buttons', () => {
  it('puts the valid time between a −1 h and a +1 h button', () => {
    const html = winds({ hourNav: nav() });
    const nav0 = /<div class="fc-nav">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? '';
    expect(nav0).toMatch(/aria-label="Show the forecast one hour earlier"[^>]*>−1 h<\/button><p class="wind-readout fc-readout"><strong>Valid /);
    expect(nav0).toMatch(/<\/p><button[^>]*aria-label="Show the forecast one hour later"[^>]*>\+1 h<\/button>$/);
  });

  it('disables a button with no hour beyond it', () => {
    const html = winds({ hourNav: nav({ canBack: false }) });
    expect(html).toMatch(/<button type="button" class="fc-step" disabled="" aria-label="Show the forecast one hour earlier"/);
    expect(html).not.toMatch(/disabled=""[^>]*one hour later/);
  });

  it('always states how far the shown hour is from now, in words and on a bar', () => {
    const html = winds({ hourNav: nav() });
    expect(html).toContain('<strong>1 h 45 min ahead of now</strong>');
    // 105 of 180 minutes to the right edge: the dot at 79.2% of the bar.
    expect(html).toContain('class="fc-track-mark" style="left:79.2%"');
    expect(html).toContain('class="fc-track-span" style="left:50%;width:29.2');
  });

  it('says it follows the clock until stepped, then says it does not and offers the way back', () => {
    const following = winds({ hourNav: nav() });
    expect(following).toContain('follows the hour nearest the clock');
    expect(following).not.toContain('Back to the nearest hour');
    expect(following).not.toContain('fc-shifted');

    const stepped = winds({ hourNav: nav({ following: false }) });
    expect(stepped).toContain('<div class="fc-nav fc-shifted">');
    expect(stepped).toContain('no longer follows the clock');
    expect(stepped).toContain('>Back to the nearest hour</button>');
  });

  it('offers no buttons on the one-bulletin FD fallback, but still shows the gap', () => {
    const html = winds({ source: 'nws-fd', hourNav: null });
    expect(html).not.toContain('fc-step');
    expect(html).toContain('ahead of now</strong>');
    expect(html).toContain('FD bulletin is issued every 6 hours');
  });

  it('marks the gap in the interface accent only, never a warning colour', () => {
    const html = winds({ validity: { validMs: Date.now() + 9 * 3_600_000 }, hourNav: nav({ following: false }) });
    expect(html).not.toMatch(/class="[^"]*(caution|watch|warn|stale|error)/);
    // Nine hours out pins to the edge and says so.
    expect(html).toContain('fc-track-mark fc-track-beyond-after');
  });
});

describe('Drift card follows the hour', () => {
  const drift = (validMs: number | null, stepped: boolean) =>
    renderToStaticMarkup(createElement(DriftPanel, { levels, profile: 'student', validMs, stepped }));

  it('names the winds hour it used and how far that is from now', () => {
    const html = drift(ahead(), false);
    expect(html).toMatch(/With the winds for [^,]+, <strong>1 h 45 min ahead of now<\/strong>\./);
  });

  it('says when that hour was stepped to on the Winds aloft card', () => {
    expect(drift(ahead(), true)).toContain('the hour stepped to on the Winds aloft card.');
  });
});
