import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SunPanel } from '../src/components/SunPanel';
import { sunTimes } from '../src/domain/sun';

const LAT = 40.8675;
const LON = -96.11;
// The card reads the clock on first render, so the clock is set.
const at = (iso: string): string => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
  const t = Date.parse(iso);
  return renderToStaticMarkup(createElement(SunPanel, { sun: sunTimes(LAT, LON, new Date(t)) }));
};

afterEach(() => vi.useRealTimers());

describe('SunPanel', () => {
  /* Before dawn the solar day's sunset is the coming evening's, ~15 hours
   * off. "15h 0m to sunset" at 4 AM reads as daylight; it is still night,
   * and the card counts to sunrise from the evening before. */
  it('counts to sunrise before dawn, from the evening before', () => {
    const html = at('2026-10-04T09:00:00Z'); // 4 AM CDT
    const prevEvening = sunTimes(LAT, LON, new Date('2026-10-03T18:00:00Z'));
    expect(html).toContain('since sunset · ');
    expect(html).toContain(' to sunrise</p>');
    expect(html).not.toContain('to sunset');
    expect(html).toMatch(/<dt>Sunset<\/dt><dd>[^<]+<\/dd><dt>Sunrise<\/dt>/);
    expect(html).toContain(`<dt>Sunset</dt><dd>${new Date(prevEvening.sunset).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })}</dd>`);
  });

  it('counts down to sunset in daylight', () => {
    const html = at('2026-10-04T18:00:00Z'); // 1 PM CDT
    expect(html).toContain('since sunrise · ');
    expect(html).toContain(' to sunset</p>');
    expect(html).toMatch(/<dt>Sunrise<\/dt><dd>[^<]+<\/dd><dt>Sunset<\/dt>/);
  });

  /* After sunset the card reads the coming sunrise, not this morning's,
   * which has passed. */
  it('names the coming sunrise after sunset, not the past one', () => {
    const html = at('2026-10-05T03:00:00Z'); // 10 PM CDT Oct 4
    const nextMorning = sunTimes(LAT, LON, new Date('2026-10-05T18:00:00Z'));
    const fmt = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });
    expect(html).toContain(`<dt>Sunrise</dt><dd>${fmt(nextMorning.sunrise)}</dd>`);
    expect(html).toContain(' to sunrise</p>');
  });
});
