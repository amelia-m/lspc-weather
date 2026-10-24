import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CeilingSkyPanel } from '../src/components/CeilingSkyPanel';
import { skyHorizonOptions } from '../src/components/forecastReach';
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

  it('offers no switch when the forecast runs no further than twelve hours, and falls back to twelve', () => {
    const html = card(hours(10, 10), 36);
    expect(html).not.toContain('Sky forecast horizon');
    expect(columns(html)).toBe(10);
    // Not labelled or laid out as a 36-hour strip it cannot show.
    expect(html).toContain('now + next 12 h');
    expect(html).not.toContain('ceiling-timeline extended');
  });
});
