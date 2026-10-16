import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppFooter, CEILING_ERRORS_URL } from '../src/components/AppFooter';
// Raw imports: the typecheck has no Node types for the tests.
import page from '../public/ceiling-errors/index.html?raw';
import script from '../public/ceiling-errors/chart.js?raw';
import dataText from '../public/ceiling-errors/ceiling-errors.json?raw';

// The ceiling-error charts are a static page beside the app, with the data
// file scripts/ceilingChartData.ts writes beside it (docs/ceiling-heights.md,
// "The chart"). Nothing builds either, so these hold them to each other.

const data = JSON.parse(dataText);

describe('the ceiling-error page', () => {
  it('is linked from the dashboard footer by its file, which the dev server and Pages both serve', () => {
    expect(CEILING_ERRORS_URL.endsWith('ceiling-errors/index.html')).toBe(true);
    expect(renderToStaticMarkup(createElement(AppFooter))).toContain(`href="${CEILING_ERRORS_URL}"`);
  });

  it('reads the data file beside it, of the version the file is', () => {
    expect(page).toContain('<script src="chart.js"></script>');
    expect(script).toContain("fetch('ceiling-errors.json')");
    expect(script).toContain(`const DATA_VERSION = ${data.version};`);
  });

  it('is a whole document under a policy that refuses inline script and other hosts', () => {
    expect(page.startsWith('<!doctype html>')).toBe(true);
    const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(page)?.[1] ?? '';
    for (const d of ["default-src 'self'", "script-src 'self'", "connect-src 'self'", "object-src 'none'"]) {
      expect(csp).toContain(d);
    }
    expect(csp).not.toMatch(/https?:|script-src[^;]*'unsafe-inline'/);
    // No script in the page itself, and no address outside a plain link (the
    // SVG namespace is a name, never fetched).
    expect(page).not.toMatch(/<script>/);
    const outside = (page + script)
      .replace(/<a href="https:\/\/[^"]+">/g, '')
      .replaceAll('http://www.w3.org/2000/svg', '')
      .match(/https?:\/\/[^\s"'`)<]+/g);
    expect(outside).toBeNull();
  });

  it('has a data file with every hour behind each band', () => {
    expect(data.points.map((p: { site: string }) => p.site)).toEqual(expect.arrayContaining(['DZ', 'PMV']));
    for (const p of data.points) {
      for (const r of p.rows) {
        for (const by of [r.byForecast, r.byReported]) {
          for (const band of data.bands) {
            expect(by[band].values).toHaveLength(by[band].n);
          }
        }
      }
    }
  });
});
