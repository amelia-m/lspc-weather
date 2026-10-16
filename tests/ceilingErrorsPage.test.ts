import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppFooter, CEILING_ERRORS_URL } from '../src/components/AppFooter';
// Raw imports: the typecheck has no Node types for the tests.
import page from '../public/ceiling-errors/index.html?raw';
import dataText from '../public/ceiling-errors/ceiling-errors.json?raw';

// The ceiling-error charts are a static page beside the app, with the data
// file scripts/ceilingChartData.ts writes beside it (docs/ceiling-heights.md,
// "The chart"). Nothing builds either, so these hold them to each other.

const data = JSON.parse(dataText);

describe('the ceiling-error page', () => {
  it('is linked from the dashboard footer, with the trailing slash its relative fetch needs', () => {
    expect(CEILING_ERRORS_URL.endsWith('ceiling-errors/')).toBe(true);
    expect(renderToStaticMarkup(createElement(AppFooter))).toContain(`href="${CEILING_ERRORS_URL}"`);
  });

  it('reads the data file beside it, of the version the file is', () => {
    expect(page).toContain("fetch('ceiling-errors.json')");
    expect(page).toContain(`d.version === ${data.version}`);
  });

  it('is a whole document that loads nothing from another host', () => {
    expect(page.startsWith('<!doctype html>')).toBe(true);
    expect(page).not.toMatch(/<(?:link|script)[^>]+(?:href|src)="https?:/);
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
