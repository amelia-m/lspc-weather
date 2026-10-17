import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppFooter, CEILING_ERRORS_URL } from '../src/components/AppFooter';
import { CHANCE_BINS, CHANCE_ELEMENTS } from '../src/domain/chances';
// Raw imports: the typecheck has no Node types for the tests.
import page from '../public/ceiling-errors/index.html?raw';
import script from '../public/ceiling-errors/chart.js?raw';
import noteScript from '../public/ceiling-errors/note.js?raw';
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
    expect(page).toContain('<script src="note.js"></script>\n<script src="chart.js"></script>');
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
    const outside = (page + script + noteScript)
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

  it('says when a row holds only a few days, naming them from the data file', () => {
    type Row = { hours: number; span: { from: string; to: string } | null };
    // note.js is a plain script with no reference to the page; run as written.
    const sampleNote = new Function(`${noteScript}; return sampleNote;`)() as (r: Row) => string | null;
    const row = (hours: number, from: string, to: string): Row => ({ hours, span: { from, to } });
    expect(page).toContain('id="sample-note" aria-live="polite"');
    expect(script).toContain('sampleNote(row)');
    expect(sampleNote(row(81, '2026-10-13T16:00Z', '2026-10-17T00:00Z'))).toMatch(
      /^These 81 hours fall within 5 days, 2026-10-13 to 2026-10-17: a few weather spells at most/,
    );
    expect(sampleNote(row(1, '2026-10-13T16:00Z', '2026-10-13T16:00Z'))).toMatch(/^This hour falls on one day, 2026-10-13:/);
    // Fourteen calendar days get the note, fifteen do not, however few the
    // hours: it is the days that make a row a few spells.
    expect(sampleNote(row(14, '2026-04-01T23:00Z', '2026-04-14T01:00Z'))).not.toBeNull();
    expect(sampleNote(row(14, '2026-04-01T23:00Z', '2026-04-15T01:00Z'))).toBeNull();
    // A row with no hours has no days to name.
    expect(sampleNote({ hours: 0, span: null })).toBeNull();
    expect(sampleNote(row(0, '2026-10-13T16:00Z', '2026-10-13T16:00Z'))).toBeNull();
    // In the data file: the kept rows get it, the six-month NDFD rows do not.
    const notes = Object.fromEntries(
      data.points.map((p: { site: string; rows: Row[] }) => [p.site, p.rows.map((r) => sampleNote(r) != null)]),
    );
    expect(notes.KEPT).toEqual([true, true, true]);
    expect(notes.DZ).toEqual([false, false, false]);
    for (const p of data.points) {
      for (const r of p.rows) {
        if (r.hours) expect(r.span.from <= r.span.to).toBe(true);
      }
    }
  });

  it('holds the kept rain and thunder chances, every hour in one chance group', () => {
    type Bin = { lo: number; hi: number; hours: number; events: number; chanceSum: number };
    type Row = { hours: number; events: number; chanceSum: number; nearMiss: number; bins: Bin[] };
    const c = data.chances as { bins: unknown; elements: { key: string; rows: Row[] }[] };
    expect(page).toContain('id="chances-panel"');
    expect(script).toContain('renderChances()');
    expect(c.bins).toEqual(CHANCE_BINS);
    expect(c.elements.map((e) => e.key)).toEqual([...CHANCE_ELEMENTS]);
    for (const e of c.elements) {
      expect(e.rows).toHaveLength(3);
      for (const r of e.rows) {
        const sum = (k: 'hours' | 'events' | 'chanceSum') => r.bins.reduce((a, b) => a + b[k], 0);
        expect(sum('hours')).toBe(r.hours);
        expect(sum('events')).toBe(r.events);
        expect(sum('chanceSum')).toBe(r.chanceSum);
        expect(r.bins.map((b) => [b.lo, b.hi])).toEqual(CHANCE_BINS.map((b) => [b.lo, b.hi]));
        for (const b of r.bins) {
          expect(b.events).toBeLessThanOrEqual(b.hours);
          expect(b.chanceSum).toBeGreaterThanOrEqual(b.lo * b.hours);
          expect(b.chanceSum).toBeLessThanOrEqual(b.hi * b.hours);
        }
        expect(r.events + r.nearMiss).toBeLessThanOrEqual(r.hours);
      }
    }
  });
});
