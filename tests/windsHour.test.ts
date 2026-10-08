import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WindsAloftPanel } from '../src/components/WindsAloftPanel';
import { DriftPanel } from '../src/components/DriftPanel';
import { ForecastHourNav, type WindsHourNav } from '../src/components/common/ForecastHourNav';
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
    // Bar runs 3 h back to 5 h forward: now at 37.5%, 105 min ahead at 59.4%.
    expect(html).toContain('class="fc-track-now" style="left:37.5%"');
    expect(html).toContain('class="fc-track-mark" style="left:59.4%"');
    expect(html).toContain('class="fc-track-span" style="left:37.5%;width:21.9');
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

describe('Winds aloft explanatory text', () => {
  it('folds the background notes by default, and keeps the table and the guidance out', () => {
    const html = winds({ hourNav: nav() });
    const about = /<details class="aloft-about">([\s\S]*?)<\/details>/.exec(html)?.[1] ?? '';
    // Closed until opened: no `open` attribute.
    expect(html).toContain('<details class="aloft-about"><summary');
    for (const note of ['AGL, like these', 'Mark Schulze’s Winds Aloft', 'linearly interpolated', 'model’s wind at 10']) {
      expect(about).toContain(note);
    }
    const outside = html.replace(/<details class="aloft-about">[\s\S]*?<\/details>/, '');
    // The sourced spotting guidance stands where it is always readable.
    expect(outside).toContain('Strong upper winds increase freefall drift');
    expect(outside).toContain('<table class="aloft-table">');
    expect(outside).toContain('Arrow shows drift direction');
    // What reading the numbers right needs, unfolded: a forecast, what the
    // Surface row is, and why Schulze's table can look different.
    expect(outside).toContain('A model <strong>forecast</strong> for the DZ, not a measurement.');
    expect(outside).toContain('The Surface row is the model’s 10\u00a0m wind; the observed wind is on the Surface wind card.');
    expect(outside).toContain('altitudes AGL on both, and after half past its table is the hour before this one.');
  });

  it('offers no About section with no table, and no Surface row talk without one', () => {
    expect(winds({ levels: [], source: undefined, validity: null })).not.toContain('aloft-about');
    const noSource = winds({ source: undefined, hourNav: nav() });
    expect(noSource).toContain('About these numbers: comparing with Mark Schulze’s tool, how levels are worked out');
    expect(noSource).not.toContain('The Surface row is');
  });

  it('keeps the fallback source note out, since it is about this report', () => {
    const html = winds({ source: 'nws-fd', hourNav: null });
    expect(html).not.toContain('aloft-about');
    expect(html).toContain('<strong>Fallback source:</strong>');
  });
});

describe('Drift card follows the hour', () => {
  const drift = (validMs: number | null, hourNav: WindsHourNav | null, source?: 'open-meteo' | 'nws-fd') =>
    renderToStaticMarkup(createElement(DriftPanel, { levels, validMs, hourNav, source }));
  // The hour row and the offset bar under it, as rendered, without the
  // attributes that are meant to differ between the two copies.
  const hourControl = (html: string) =>
    (/<div class="fc-nav[^"]*">[\s\S]*?<\/div><div class="fc-offset">[\s\S]*?<\/p><\/div>/.exec(html)?.[0] ?? '')
      .replace(/ aria-label="[^"]*"/g, '')
      .replace(/ aria-live="[^"]*"/g, '');

  it('shows the same hour, buttons and offset bar as the Winds aloft card', () => {
    const validMs = ahead();
    const n = nav();
    const control = hourControl(drift(validMs, n));
    expect(control).toContain('>−1 h</button>');
    expect(control).toContain('>+1 h</button>');
    expect(control).toContain('<strong>1 h 45 min ahead of now</strong>');
    expect(control).toBe(hourControl(winds({ validity: { validMs }, hourNav: n })));
  });

  it('says the estimate is the Winds aloft card\'s hour, and that the buttons move both', () => {
    const html = drift(ahead(), nav());
    expect(html).toContain('Worked from the forecast hour selected on the Winds aloft card.');
    expect(html).toContain('The buttons here and on that card step the same hour, so changing either moves both.');
  });

  it('names its buttons apart from the Winds aloft card\'s, and announces nothing twice', () => {
    const d = drift(ahead(), nav({ following: false }));
    expect(d).toContain('aria-label="Show the forecast one hour earlier for the drift estimate"');
    expect(d).toContain('aria-label="Show the forecast one hour later for the drift estimate"');
    expect(d).toContain('aria-label="Back to the nearest hour for the drift estimate"');
    expect(d).not.toContain('aria-live');
    const w = winds({ hourNav: nav({ following: false }) });
    expect(w).toContain('aria-label="Show the forecast one hour earlier"');
    expect(w).toContain('aria-live="polite"');
  });

  it('marks a stepped hour and offers the way back, as the winds card does', () => {
    expect(drift(ahead(), nav())).not.toContain('Back to the nearest hour');
    const stepped = drift(ahead(), nav({ following: false }));
    expect(stepped).toContain('<div class="fc-nav fc-shifted">');
    expect(stepped).toContain('>Back to the nearest hour</button>');
  });

  it('shows the hour without buttons on the one-bulletin FD fallback, and does not call it selected', () => {
    const html = drift(ahead(), null, 'nws-fd');
    expect(html).not.toContain('fc-step');
    expect(html).toContain('ahead of now</strong>');
    expect(html).toContain('Worked from the same forecast hour as the Winds aloft card.');
    expect(html).not.toContain('hour selected on');
  });

  it('claims no hour when the source stated none', () => {
    const html = drift(null, nav());
    expect(html).not.toContain('fc-nav');
    expect(html).not.toContain('Worked from');
  });
});

describe('the shared hour control', () => {
  // Called as a function to reach the buttons' handlers: no DOM here, and the
  // component has no hooks.
  const buttons = (n: WindsHourNav) => {
    const tree = ForecastHourNav({ validMs: ahead(), now: Date.now(), hourNav: n });
    const row = (tree.props.children as JSX.Element[])[0];
    return (row.props.children as (JSX.Element | null)[]).filter((c): c is JSX.Element => c?.type === 'button');
  };
  const click = { currentTarget: { closest: () => null, disabled: false } };

  it('steps the one nav it is given, back and forward', () => {
    const steps: number[] = [];
    const [back, forward] = buttons(nav({ onStep: (d) => steps.push(d) }));
    back.props.onClick(click);
    forward.props.onClick(click);
    expect(steps).toEqual([-1, 1]);
  });

  it('is handed the same nav on both cards', async () => {
    // The sharing lives in App.tsx, which no test renders (it fetches).
    // Read it: both cards must take useWindsHour's one nav.
    const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as { readFileSync: (p: string, e: string) => string };
    const app = fs.readFileSync(decodeURIComponent(new URL('../src/App.tsx', import.meta.url).pathname), 'utf8');
    for (const card of ['WindsAloftPanel', 'DriftPanel']) {
      const el = new RegExp(`<${card}\\b[\\s\\S]*?/>`).exec(app)?.[0] ?? '';
      expect(el).toContain('hourNav={winds.nav}');
    }
  });
});
