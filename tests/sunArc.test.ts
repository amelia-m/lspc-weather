import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SunArc } from '../src/components/common/SunArc';
import { SunPanel } from '../src/components/SunPanel';
import type { SkyPhase } from '../src/domain/sun';

const HOUR = 3_600_000;
const now = Date.parse('2026-10-04T19:00:00Z');
const arc = (phase: SkyPhase) => renderToStaticMarkup(createElement(SunArc, { phase, now }));

describe('SunArc', () => {
  it('puts the sun at the top of the arc halfway through the day, inside the drawing', () => {
    const html = arc({ phase: 'day', startMs: now - 6 * HOUR, endMs: now + 6 * HOUR, fraction: 0.5 });
    // Centre 150, horizon 108, radius 88: the top is 20, rays reach 4.
    expect(html).toContain('class="sun-arc-sun" transform="translate(150.0 20.0)"');
    expect(html).not.toContain('sun-arc-moon');
    expect(html).toContain('6h 0m since sunrise · 6h 0m to sunset');
    expect(html).toContain('not where the sun is in the sky');
  });

  it('runs from sunrise on the left to sunset on the right', () => {
    const start = arc({ phase: 'day', startMs: now, endMs: now + 12 * HOUR, fraction: 0 });
    expect(start).toContain('transform="translate(62.0 108.0)"');
    const end = arc({ phase: 'day', startMs: now - 12 * HOUR, endMs: now, fraction: 1 });
    expect(end).toContain('transform="translate(238.0 108.0)"');
  });

  it('shows a moon from sunset to sunrise at night, and says it is not the real moon', () => {
    const html = arc({ phase: 'night', startMs: now - 3 * HOUR, endMs: now + 9 * HOUR, fraction: 0.25 });
    expect(html).toContain('class="sun-arc-moon"');
    expect(html).not.toContain('sun-arc-sun');
    expect(html).toContain('3h 0m since sunset · 9h 0m to sunrise');
    expect(html).toMatch(/text-anchor="middle">sunset [^<]+<\/text>/);
    expect(html).toContain('not where the moon is in the sky, or its phase.');
    expect(html).toContain('aria-label="Night: 3h 0m since sunset, 9h 0m to sunrise."');
  });

  /* The elapsed line ran to the marker's centre and showed through the
   * crescent's bite; both lines now stop a gap short of the marker. Checked
   * along each drawn arc, not only at its ends, since a line's middle can pass
   * under the marker too. */
  it('keeps both lines clear of the marker, by night and by day', () => {
    const near = (html: string) => {
      const [mx, my] = html.match(/translate\(([\d.]+) ([\d.]+)\)/)!.slice(1).map(Number);
      const arcs = [...html.matchAll(/class="sun-arc-(?:track|done)[^"]*" d="M ([\d.]+) ([\d.]+) A 88 88 0 0 1 ([\d.]+) ([\d.]+)"/g)];
      const angle = (x: number, y: number) => Math.atan2(108 - y, x - 150);
      let closest = Infinity;
      for (const m of arcs) {
        const [x1, y1, x2, y2] = m.slice(1).map(Number);
        const [a1, a2] = [angle(x1, y1), angle(x2, y2)];
        for (let i = 0; i <= 200; i++) {
          const a = a1 + ((a2 - a1) * i) / 200;
          closest = Math.min(closest, Math.hypot(150 + 88 * Math.cos(a) - mx, 108 - 88 * Math.sin(a) - my));
        }
      }
      return { closest, arcs: arcs.length };
    };
    for (const f of [0.25, 0.5, 0.75]) {
      const night = near(arc({ phase: 'night', startMs: now - HOUR, endMs: now + HOUR, fraction: f }));
      expect(night.arcs).toBe(2);
      expect(night.closest).toBeGreaterThan(9); // the moon's disc
      const day = near(arc({ phase: 'day', startMs: now - HOUR, endMs: now + HOUR, fraction: f }));
      expect(day.closest).toBeGreaterThan(16); // the sun's rays
    }
    // At an end there is no room on that side, and that line is not drawn.
    expect(near(arc({ phase: 'night', startMs: now, endMs: now + HOUR, fraction: 0 })).arcs).toBe(1);
  });

  it('keeps the marker on the arc if the fraction strays past an end', () => {
    expect(arc({ phase: 'day', startMs: now, endMs: now + HOUR, fraction: 1.2 })).toContain(
      'transform="translate(238.0 108.0)"',
    );
  });

  it('draws in the neutral sun and moon tokens, not a warning colour', () => {
    const html = arc({ phase: 'night', startMs: now - HOUR, endMs: now + HOUR, fraction: 0.5 });
    expect(html).not.toMatch(/class="[^"]*(caution|watch|warn|stale|error)/);
  });
});

describe('the Daylight card', () => {
  it('shows the arc above the times', () => {
    const html = renderToStaticMarkup(
      createElement(SunPanel, { sun: { sunrise: Date.now() - 5 * HOUR, sunset: Date.now() + 5 * HOUR } }),
    );
    expect(html.indexOf('class="sun-arc"')).toBeGreaterThan(-1);
    expect(html.indexOf('class="sun-arc"')).toBeLessThan(html.indexOf('<dt>Sunrise</dt>'));
  });
});

describe('the moon stylesheet', () => {
  // A Node render applies no CSS. The moon's colour rule once reached the
  // circles inside its mask too, which made the crescent a full disc in a
  // browser while every markup test passed.
  it('colours the moon disc only, not the circles that cut the crescent', async () => {
    const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as { readFileSync: (p: string, e: string) => string };
    const css = fs.readFileSync(decodeURIComponent(new URL('../src/styles/app.css', import.meta.url).pathname), 'utf8');
    expect(css).toMatch(/\.sun-arc-moon > circle\s*\{\s*fill: var\(--moon\)/);
    expect(css).not.toMatch(/\.sun-arc-moon circle\s*\{/);
  });
});
