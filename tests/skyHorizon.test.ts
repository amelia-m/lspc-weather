import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CeilingSkyPanel } from '../src/components/CeilingSkyPanel';
import { ceilingCoverage, horizonOptions, skyHorizonOptions } from '../src/components/forecastReach';
import { localDateKey } from '../src/components/format';
import type { HourlyPoint } from '../src/domain/types';

/* The Ceiling & sky strip looks 12 hours ahead by default and 24 or 36 at
 * the reader's choice (the maintainer, 2026-10-24). */

describe('skyHorizonOptions', () => {
  it('offers a longer horizon only when the forecast runs past the one before it', () => {
    expect(skyHorizonOptions(0)).toEqual([12]);
    expect(skyHorizonOptions(12)).toEqual([12]);
    expect(skyHorizonOptions(13)).toEqual([12, 24]);
    expect(skyHorizonOptions(25)).toEqual([12, 24, 36]);
  });

  it('is the rule the Hourly wind card offers its horizons by', () => {
    const wind = [{ hours: 18 }, { hours: 36 }, { hours: 72 }];
    expect(horizonOptions(wind, (o) => o.hours, 30)).toEqual([{ hours: 18 }, { hours: 36 }]);
    expect(horizonOptions(wind, (o) => o.hours, 37)).toEqual(wind);
  });
});

describe('ceilingCoverage', () => {
  const at = (covered: boolean[]) => covered.map((c, i) => ({ time: i, ceilingForecast: c }));
  it('names the hour a ceiling forecast ends when it does not come back', () => {
    expect(ceilingCoverage(at([true, true, false, false]))).toEqual({ kind: 'end', from: 2 });
  });
  it('calls a hole the forecast resumes after, or no ceiling at all, gaps, not an end', () => {
    expect(ceilingCoverage(at([true, false, true]))).toEqual({ kind: 'gaps' });
    expect(ceilingCoverage(at([false, false]))).toEqual({ kind: 'gaps' });
  });
  it('says nothing when every hour is covered', () => {
    expect(ceilingCoverage(at([true, true]))).toBeNull();
  });
});

const t0 = Math.ceil(Date.now() / 3_600_000) * 3_600_000;
/** `n` hours of forecast, the ceiling forecast covering the first `ceilingHours`. */
const hours = (n: number, ceilingHours: number): HourlyPoint[] =>
  Array.from({ length: n }, (_, i) => ({
    time: t0 + i * 3_600_000,
    skyCoverPct: 40,
    ceilingFtAgl: null,
    ceilingForecast: i < ceilingHours,
    visibilitySm: i < ceilingHours ? 10 : null,
    visibilityForecast: i < ceilingHours,
    windSpeedKt: 8,
    windGustKt: 12,
    windDirectionDeg: 180,
    precipProbPct: 0,
    thunderProbPct: 0,
    precipAmountIn: 0,
    tempC: 15,
  }));
const card = (hourly: HourlyPoint[], initialHours?: number) =>
  renderToStaticMarkup(createElement(CeilingSkyPanel, { current: null, hourly, omClouds: null, initialHours }));
const columns = (html: string) => (html.match(/<div class="sky-col" title=/g) ?? []).length;

describe('the Ceiling & sky horizon', () => {
  it('opens on twelve hours, with the switch to the longer ones the forecast reaches', () => {
    const html = card(hours(48, 40));
    expect(columns(html)).toBe(12);
    expect(html).toContain('now + next 12 h');
    expect(html).toContain('aria-label="Sky forecast horizon"');
    expect(html).toContain('aria-pressed="true">12h</button>');
    expect(html).toContain('>24h</button>');
    expect(html).toContain('>36h</button>');
    expect(html).not.toContain('ceiling-timeline extended');
  });

  it('draws the longer strip to scroll inside the card', () => {
    const html = card(hours(48, 40), 36);
    expect(columns(html)).toBe(36);
    expect(html).toContain('now + next 36 h');
    expect(html).toContain('sky-timeline ceiling-timeline extended');
    expect(html).toContain('aria-pressed="true">36h</button>');
  });

  it('says where the ceiling forecast stops when the strip runs past it, and not before', () => {
    expect(card(hours(48, 30), 36)).toContain('No ceiling forecast from');
    expect(card(hours(48, 40), 36)).not.toContain('No ceiling forecast from');
    expect(card(hours(48, 30))).not.toContain('No ceiling forecast from');
  });

  it('does not explain a missing ceiling element as the forecast\'s reach ending', () => {
    const html = card(hours(48, 0), 24);
    expect(html).not.toContain('No ceiling forecast from');
    expect(html).toContain('no ceiling for some of these hours');
  });

  it('names the new day under its first hour when the strip crosses midnight', () => {
    const h = hours(48, 40);
    const newDay = h.findIndex((p, i) => i > 0 && localDateKey(p.time) !== localDateKey(h[i - 1].time));
    const html = card(h, 36);
    const days = html.match(/<span class="sky-time sky-day">([^<]*)<\/span>/g) ?? [];
    // One per column plus the axis column's spacer, a weekday at each new day.
    expect(days).toHaveLength(37);
    expect(days.filter((d) => !d.includes('\u00a0') && !d.includes('&nbsp;')).length).toBe(newDay + 24 < 36 ? 2 : 1);
  });

  it('counts the hours it draws in its subtitle, not the horizon chosen', () => {
    expect(card(hours(30, 30), 36)).toContain('now + next 30 h');
  });

  it('offers no switch when the forecast runs no further than twelve hours, and falls back to twelve', () => {
    const html = card(hours(10, 10), 36);
    expect(html).not.toContain('Sky forecast horizon');
    expect(columns(html)).toBe(10);
    // Not labelled or laid out as a 36-hour strip it cannot show.
    expect(html).toContain('now + next 10 h');
    expect(html).not.toContain('ceiling-timeline extended');
  });
});
