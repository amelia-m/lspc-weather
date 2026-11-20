import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SourceLinks } from '../src/components/common/SourceLinks';
import { DailyForecastPanel } from '../src/components/DailyForecastPanel';
import { TafPanel } from '../src/components/TafPanel';
import { DATA_SOURCES } from '../src/config/sources';
import { SITE } from '../src/config/site';
import { aggregateDailyFromHourly } from '../src/domain/normalize';
import type { HourlyPoint, SourceStatus } from '../src/domain/types';

/* The fixes from the review of the React and I/O layers of 2026-11-20
 * (docs/code-review-2026-11-20-ui-api.md). */

describe('SourceLinks keys', () => {
  it('keeps two sources that share a URL apart: the NBM bulletins both link MDL’s page', () => {
    // The two sources are one page on purpose (config/sources.ts); the
    // Ceiling & sky card lists both. React keys the children, and two
    // children with one key are not kept apart across an update.
    expect(DATA_SOURCES.nbm.url).toBe(DATA_SOURCES.nbs.url);
    const el = SourceLinks({ sources: [DATA_SOURCES.nbm, DATA_SOURCES.nbs] });
    const keys = (el.props.children as ReactElement[]).map((c) => c.key);
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
    const html = renderToStaticMarkup(el);
    expect(html).toContain(DATA_SOURCES.nbm.label);
    expect(html).toContain(DATA_SOURCES.nbs.label);
  });
});

describe('the 10-day outlook on the gridpoint fallback, after local midnight', () => {
  afterEach(() => vi.useRealTimers());

  const H = 3_600_000;
  const hour = (time: number): HourlyPoint =>
    ({
      time,
      skyCoverPct: 40,
      ceilingFtAgl: null,
      ceilingForecast: true,
      visibilitySm: 10,
      visibilityForecast: true,
      windSpeedKt: 8,
      windGustKt: 12,
      windDirectionDeg: 180,
      precipProbPct: 10,
      thunderProbPct: 0,
      precipAmountIn: 0,
      tempC: 10,
    }) as HourlyPoint;

  it('names today’s row Today by its date, and shows no day before today', () => {
    // 2 AM Central on Friday 2026-11-20. The grid read at 01:41Z that day
    // started at 19Z on the 19th (1 PM Central, Thursday): aggregated, its
    // first day is Thursday's, and "Today" by row position named it.
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 10, 20, 8));
    const start = Date.UTC(2026, 10, 19, 19);
    const hourly = Array.from({ length: 48 }, (_, i) => hour(start + i * H));
    const daily = aggregateDailyFromHourly(hourly, SITE.timeZone);
    // Thursday, Friday and Saturday: the fixture has three days in it.
    expect(daily).toHaveLength(3);
    const html = renderToStaticMarkup(
      createElement(DailyForecastPanel, { daily, source: 'nws-gridpoint', hourly, unit: 'kt', onUnitChange: () => undefined }),
    );
    expect(html.match(/<td>Today<\/td>/g)).toHaveLength(1);
    expect(html).not.toContain('11/19');
    // Friday is today, not a dated row; Saturday follows it.
    expect(html).not.toContain('Fri, 11/20');
    expect(html).toContain('Sat, 11/21');
  });
});

describe('the Open-Meteo daily fixture’s days', () => {
  afterEach(() => vi.useRealTimers());

  it('start at the drop zone’s local midnight, as the API’s do, on either side of a clock change', async () => {
    const { localDayStartSec } = await import('../src/api/fixtures/_time');
    vi.useFakeTimers();
    // 7:50 PM Central Standard Time on Thursday 2026-11-19 (01:50Z Friday):
    // today's midnight is Thursday's, 06:00Z, not the UTC day's.
    vi.setSystemTime(Date.UTC(2026, 10, 20, 1, 50));
    expect(localDayStartSec(0, SITE.timeZone)).toBe(Date.UTC(2026, 10, 19, 6) / 1000);
    expect(localDayStartSec(1, SITE.timeZone)).toBe(Date.UTC(2026, 10, 20, 6) / 1000);
    // The day daylight saving time begins (2026-03-08, 2 AM): its midnight
    // is still at the standard offset, the next day's at the summer one.
    vi.setSystemTime(Date.UTC(2026, 2, 7, 18));
    expect(localDayStartSec(1, SITE.timeZone)).toBe(Date.UTC(2026, 2, 8, 6) / 1000);
    expect(localDayStartSec(2, SITE.timeZone)).toBe(Date.UTC(2026, 2, 9, 5) / 1000);
  });
});

describe('the TAF card’s error line', () => {
  it('cuts each URL in the error to its host, as Data health does', () => {
    const status: SourceStatus = {
      ok: false,
      fetchedAt: null,
      stale: true,
      error: 'HTTP 502 for https://lspc-taf-relay.amelia-m.workers.dev/taf?ids=KOFF',
      pending: false,
    };
    const html = renderToStaticMarkup(createElement(TafPanel, { taf: null, status, relay: true }));
    expect(html).toContain('TAF unavailable — HTTP 502 for lspc-taf-relay.amelia-m.workers.dev.');
    expect(html).not.toContain('https://lspc-taf-relay');
  });
});
