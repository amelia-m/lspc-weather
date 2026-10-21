import { describe, expect, it } from 'vitest';
import { judgeLoad, pagePasses, type LoadObservation } from '../src/domain/liveSite';

const clean: LoadObservation = {
  page: 'jumpers',
  width: 390,
  pageErrors: [],
  ownFailures: [],
  otherFailures: [],
  consoleErrors: [],
  scrollWidth: 390,
  viewportWidth: 390,
  crashed: false,
  sources: [{ name: 'Observation', state: 'ok', meta: '2 min ago' }],
  checks: [{ name: 'radar image drew', ok: true }],
};

describe('judgeLoad', () => {
  it('finds nothing wrong with a clean load', () => {
    expect(judgeLoad(clean)).toEqual({ faults: [], notes: [] });
  });

  it('counts what a reader would meet as faults', () => {
    const v = judgeLoad({
      ...clean,
      pageErrors: ['TypeError: x is undefined'],
      crashed: true,
      ownFailures: ['404 /lspc-weather/favicon.svg'],
      scrollWidth: 348,
      viewportWidth: 320,
      sources: [
        { name: 'Observation', state: 'error', meta: 'error: HTTP 500' },
        { name: 'TAF', state: 'pending', meta: 'loading…' },
      ],
      checks: [{ name: 'radar image drew', ok: false, detail: 'naturalWidth 0' }],
    });
    expect(v.faults).toEqual([
      'script error: TypeError: x is undefined',
      'the error screen is showing',
      'site file not served: 404 /lspc-weather/favicon.svg',
      'scrolls sideways: 348 px wide in a 320 px viewport',
      'Observation: error: HTTP 500',
      'TAF: still loading when the check stopped waiting',
      'radar image drew: naturalWidth 0',
    ]);
  });

  it('notes what may be the network or a late source, and does not count it', () => {
    const v = judgeLoad({
      ...clean,
      otherFailures: ['net::ERR_FAILED https://api.open-meteo.com/v1/forecast'],
      consoleErrors: ['Access to fetch … blocked by CORS policy'],
      sources: [{ name: 'Observation', state: 'stale', meta: 'stale' }],
      scrollWidth: 391,
    });
    expect(v.faults).toEqual([]);
    expect(v.notes).toEqual([
      'Observation: stale',
      'other host: net::ERR_FAILED https://api.open-meteo.com/v1/forecast',
      'console: Access to fetch … blocked by CORS policy',
    ]);
  });

  it('counts a failed TAF relay as a fault once the relay is set, and another station’s failed fetch as a note', () => {
    const taf = (detail: string) => ({ ...clean, sources: [{ name: 'TAF', state: 'ok' as const, meta: 'just now', detail }] });
    const relayDown = taf('fallback KOMA · KOFF fetch failed');
    expect(judgeLoad(relayDown, { relayStation: 'KOFF' }).faults).toEqual([
      'TAF: fallback KOMA · KOFF fetch failed (the TAF relay)',
    ]);
    // Before the relay is set, Offutt's fetch is the NWS feed's.
    expect(judgeLoad(relayDown).faults).toEqual([]);
    expect(judgeLoad(relayDown).notes).toEqual(['TAF: fallback KOMA · KOFF fetch failed']);
    const omahaDown = taf('fallback KLNK · no KOFF TAF on aviationweather.gov · KOMA fetch failed');
    expect(judgeLoad(omahaDown, { relayStation: 'KOFF' }).faults).toEqual([]);
    // Offutt's own gaps are not faults at all.
    expect(judgeLoad(taf('fallback KOMA · KOFF TAF ended'), { relayStation: 'KOFF' })).toEqual({ faults: [], notes: [] });
  });

  it('reads a page without the Data health card as having no sources to judge', () => {
    expect(judgeLoad({ ...clean, sources: null }).faults).toEqual([]);
  });
});

describe('pagePasses', () => {
  it('passes a page when either load was clean, and fails it when both had faults', () => {
    const bad = { faults: ['x'], notes: [] };
    const good = { faults: [], notes: ['y'] };
    expect(pagePasses([bad, good])).toBe(true);
    expect(pagePasses([good])).toBe(true);
    expect(pagePasses([bad, bad])).toBe(false);
  });
});
