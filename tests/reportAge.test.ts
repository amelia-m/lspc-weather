import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ageWords, agoText, overdueReportText, reportsOverdue } from '../src/domain/reportAge';
import { fmtAgo } from '../src/components/format';
import { evaluateAdvisories, forecastWindAdvisories } from '../src/domain/advisories';
import { AdvisoryPanel } from '../src/components/AdvisoryPanel';
import { DataFreshness } from '../src/components/DataFreshness';
import { MetarPanel } from '../src/components/MetarPanel';
import { SurfaceWindPanel } from '../src/components/SurfaceWindPanel';
import { DEFAULT_THRESHOLDS, resolveThresholds } from '../src/config/thresholds';
import { SITE } from '../src/config/site';
import { normalizeMetar } from '../src/domain/normalize';
import { METAR_FIXTURE } from '../src/api/fixtures/metar';
import type { Advisory, HourlyPoint, SourceKey, SourceStatus, WeatherSnapshot } from '../src/domain/types';

/* How old a report is, and whether reports are overdue (the maintainer,
 * 2026-11-24): the cards printed a clock time and compared it with nothing,
 * so a three-hour-old report read like a fresh one everywhere. */

const MIN = 60_000;
const report = normalizeMetar({ ...METAR_FIXTURE[0], wspd: 20, wgst: 28 })!;
const at = report.observedAt;
const interval = SITE.metarStation.reportIntervalMin;

describe('a report’s age in words', () => {
  it('counts minutes, then hours and minutes, then days', () => {
    expect(ageWords(at, at + 12 * MIN)).toBe('12 min');
    expect(ageWords(at, at + 59 * MIN)).toBe('59 min');
    expect(ageWords(at, at + 60 * MIN)).toBe('1 h');
    expect(ageWords(at, at + 100 * MIN)).toBe('1 h 40 min');
    expect(ageWords(at, at + 47 * 60 * MIN + 59 * MIN)).toBe('47 h 59 min');
    expect(ageWords(at, at + 72 * 60 * MIN)).toBe('3 days');
  });

  it('calls under a minute, and a report timed ahead of the clock, just now', () => {
    expect(agoText(at, at + 20_000)).toBe('just now');
    expect(agoText(at, at - 5 * MIN)).toBe('just now');
    expect(agoText(at, at + 12 * MIN)).toBe('12 min ago');
  });
});

describe('every age on the page', () => {
  it('uses the same words: the fetch ages and Nearby METARs read as the report ages do', () => {
    expect(fmtAgo(Date.now() - 100 * MIN)).toBe('1 h 40 min ago');
    expect(fmtAgo(Date.now() - 12 * MIN)).toBe('12 min ago');
    expect(fmtAgo(null)).toBe('\u2014');
  });
});

describe('reports overdue, by the station’s own cadence', () => {
  it('is not said through two intervals, and is said past them, with the cadence and the age', () => {
    expect(reportsOverdue(at, at + 2 * interval * MIN, interval)).toBe(false);
    expect(overdueReportText('KPMV', at, at + 2 * interval * MIN, interval)).toBeNull();
    expect(overdueReportText('KPMV', at, at + (2 * interval + 1) * MIN, interval)).toBe(
      `KPMV usually reports every ${interval} minutes. The newest report here is ${2 * interval + 1} min old, so at least one later report has not arrived.`,
    );
  });
});

describe('the Surface wind card', () => {
  const card = (now: number, current: typeof report | null = report) =>
    renderToStaticMarkup(
      createElement(SurfaceWindPanel, {
        current,
        thresholds: resolveThresholds('student'),
        label: 'Student',
        unit: 'kt',
        onUnitChange: () => {},
        now,
      }),
    );
  const observed = (html: string): string => {
    const i = html.indexOf('<p class="wind-observed">');
    return html.slice(i, html.indexOf('</p>', i));
  };

  it('prints the report’s age beside its time on the first line', () => {
    expect(observed(card(at + 12 * MIN))).toMatch(/ (AM|PM), 12 min ago: the latest report, not a forecast\./);
    expect(observed(card(at + 100 * MIN))).toContain(', 1 h 40 min ago: the latest');
  });

  it('says in the card’s own type, before the reading, what a report cannot show', () => {
    const html = card(at + 12 * MIN);
    const i = html.indexOf('<p class="wind-report-limit">');
    expect(i).toBeGreaterThan(html.indexOf('<p class="wind-observed">'));
    expect(i).toBeLessThan(html.indexOf('wind-readout'));
    expect(html.slice(i, html.indexOf('</p>', i))).toContain(
      'A report is the wind at KPMV when it was taken. It cannot show a wind that is changing now, or the wind at the DZ.',
    );
    // Before a report has loaded the sentence still stands, and no age is invented.
    const empty = card(at, null);
    expect(empty).toContain('A report is the wind at KPMV when it was taken.');
    expect(observed(empty)).not.toMatch(/ago|just now/);
  });

  it('says when reports are overdue, and not before', () => {
    expect(card(at + 2 * interval * MIN)).not.toContain('wind-overdue');
    const late = card(at + 100 * MIN);
    expect(late).toContain(
      `<p class="wind-overdue">KPMV usually reports every ${interval} minutes. The newest report here is 1 h 40 min old, so at least one later report has not arrived.</p>`,
    );
    // Still the reading the page has, drawn as before.
    expect(late).toContain('wind-readout');
  });
});

describe('the Current conditions card', () => {
  it('prints the report’s age in its subtitle', () => {
    const html = renderToStaticMarkup(createElement(MetarPanel, { current: report, unit: 'kt', onUnitChange: () => {} }));
    expect(html).toMatch(/KPMV · obs [^<]*, (\d+ days ago|\d+ h( \d+ min)? ago|\d+ min ago|just now)</);
  });
});

describe('the flags', () => {
  const snapshot = (over: Partial<WeatherSnapshot> = {}): WeatherSnapshot => ({
    current: report,
    hourly: [],
    daily: [],
    windsAloft: [],
    sun: null,
    densityAltitude: null,
    taf: null,
    ...over,
  });
  const hour = (t: number): HourlyPoint => ({
    time: t,
    skyCoverPct: null,
    ceilingFtAgl: null,
    ceilingForecast: true,
    visibilityForecast: true,
    visibilitySm: null,
    windSpeedKt: 25,
    windGustKt: 30,
    windDirectionDeg: 200,
    precipProbPct: null,
    thunderProbPct: null,
    precipAmountIn: null,
    tempC: null,
  });
  const now = at + 12 * MIN;
  const t = DEFAULT_THRESHOLDS.student;
  const observedFlags = evaluateAdvisories(snapshot({ sun: { sunrise: now - 12 * 3600_000, sunset: now - 3600_000 } }), t, now);
  const forecastFlags = forecastWindAdvisories([hour(now + 3600_000), hour(now + 2 * 3600_000)], t, now, 'kt');
  const all: Advisory[] = [...observedFlags, ...forecastFlags];
  const panel = (advisories: Advisory[], at_: number, withReport = true) =>
    renderToStaticMarkup(
      createElement(AdvisoryPanel, {
        advisories,
        profile: 'Student',
        hasWindLimit: true,
        report: withReport ? { station: report.station, observedAt: at } : null,
        now: at_,
      }),
    );
  const items = (html: string): string[] => html.split('<li ').slice(1);

  it('each say what they read: the report, the clock or the forecast', () => {
    const basis = Object.fromEntries(all.map((a) => [a.id, a.basis]));
    expect(basis['surface-wind']).toBe('report');
    expect(basis.daylight).toBe('clock');
    expect(basis['forecast-wind']).toBe('forecast');
    expect(all.filter((a) => a.level === 'forecast').every((a) => a.basis === 'forecast')).toBe(true);
    expect(observedFlags.filter((a) => a.id !== 'daylight').every((a) => a.basis === 'report')).toBe(true);
  });

  it('name the report and its age on each flag read from it, and on no other', () => {
    const html = panel(all, now);
    const byId = Object.fromEntries(items(html).map((li, i) => [all[i].id, li]));
    expect(byId['surface-wind']).toMatch(/<p class="advisory-report muted small">From the [A-Z][a-z]{2} \d{1,2}:\d{2} (AM|PM) report, 12 min ago\.<\/p>/);
    expect(byId.daylight).not.toContain('advisory-report');
    expect(byId['forecast-wind']).not.toContain('advisory-report');
    expect(html.match(/advisory-report/g)).toHaveLength(all.filter((a) => a.basis === 'report').length);
    // No report loaded: nothing to name.
    expect(panel(all, now, false)).not.toContain('advisory-report');
  });

  it('say once, above the list and in its empty state alike, when reports are overdue', () => {
    expect(panel(all, at + 2 * interval * MIN)).not.toContain('advisory-overdue');
    const late = panel(all, at + 100 * MIN);
    expect(late).toContain('The newest report here is 1 h 40 min old');
    expect(late).toContain('The flags that name a report were read from that one.');
    expect(late.indexOf('advisory-overdue')).toBeLessThan(late.indexOf('advisory-list'));
    expect(late.match(/advisory-overdue/g)).toHaveLength(1);
    const empty = panel([], at + 100 * MIN);
    expect(empty).toContain('The newest report here is 1 h 40 min old');
    expect(empty).toContain('This list was read from that report.');
    expect(empty.indexOf('advisory-overdue')).toBeLessThan(empty.indexOf('advisory-empty'));
  });
});

describe('Data health’s METAR row', () => {
  const ok: SourceStatus = { ok: true, fetchedAt: null, stale: false, error: null, pending: false };
  const status = Object.fromEntries(
    (['metar', 'nws', 'windsAloft', 'taf', 'daily', 'nbm', 'nbs'] as SourceKey[]).map((k) => [k, ok]),
  ) as Record<SourceKey, SourceStatus>;
  const rows = (now: number, reportAt: number | null, s = status): string[] =>
    renderToStaticMarkup(
      createElement(DataFreshness, { status: s, lastUpdated: null, onRefresh: () => {}, reportAt, now }),
    )
      .split('<li ')
      .slice(1);

  it('prints the report’s age beside the fetch’s, on that row only', () => {
    const [metar, ...rest] = rows(at + 12 * MIN, at);
    expect(metar).toContain('class="source ok"');
    expect(metar).toContain('report 12 min ago · fetched ');
    expect(rest.join('')).not.toContain('report ');
  });

  it('turns the row stale and says for how long there has been no report, once reports are overdue', () => {
    expect(rows(at + 2 * interval * MIN, at)[0]).toContain('class="source ok"');
    const [metar, nws] = rows(at + 100 * MIN, at);
    expect(metar).toContain('class="source stale"');
    expect(metar).toContain('no report for 1 h 40 min · fetched ');
    expect(nws).toContain('class="source ok"');
  });

  it('leaves an error, a fetch in flight and a row with no report as they were', () => {
    const err = rows(at + 100 * MIN, at, { ...status, metar: { ...ok, ok: false, error: 'HTTP 500' } })[0];
    expect(err).toContain('class="source error"');
    expect(err).not.toContain('no report for');
    expect(rows(at + 100 * MIN, at, { ...status, metar: { ...ok, pending: true } })[0]).toContain('class="source pending"');
    const none = rows(at + 100 * MIN, null)[0];
    expect(none).toContain('class="source ok"');
    expect(none).not.toContain('report');
  });
});
