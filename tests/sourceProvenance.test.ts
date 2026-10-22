import { describe, expect, it } from 'vitest';
import { deriveProvenance, describeObservationFeed, describeTafSource, TAF_RELAY_FAILED } from '../src/domain/sourceProvenance';
import { normalizeNwsObservation } from '../src/domain/normalize';
import { OBSERVATION_FIXTURE } from '../src/api/fixtures/observation';
import type { WeatherSnapshot } from '../src/domain/types';

const EMPTY: WeatherSnapshot = {
  current: null,
  hourly: [],
  daily: [],
  windsAloft: [],
  sun: null,
  densityAltitude: null,
  taf: null,
};

describe('deriveProvenance', () => {
  it('marks the primary providers as not-fallback', () => {
    const prov = deriveProvenance({
      ...EMPTY,
      windsAloftSource: 'open-meteo',
      dailySource: 'open-meteo',
      taf: { station: 'KOFF', raw: '', issuedMs: null, validRaw: null },
    }, false);
    expect(prov.windsAloft).toEqual({ detail: 'Open-Meteo 10–180 m and pressure levels', fallback: false });
    expect(prov.daily).toEqual({ detail: 'Open-Meteo (10-day)', fallback: false });
    expect(prov.taf).toEqual({ detail: 'KOFF', fallback: false });
  });

  it('marks the fallback providers as fallback', () => {
    const prov = deriveProvenance({
      ...EMPTY,
      windsAloftSource: 'nws-fd',
      dailySource: 'nws-gridpoint',
      taf: { station: 'KOMA', raw: '', issuedMs: null, validRaw: null, passedOver: [{ station: 'KOFF', none: true }] },
    }, false);
    expect(prov.windsAloft?.fallback).toBe(true);
    expect(prov.windsAloft?.detail).toContain('NOAA FD');
    expect(prov.daily?.fallback).toBe(true);
    expect(prov.daily?.detail).toContain('NWS gridpoint');
    // A non-primary TAF station (not the first configured) is a fallback,
    // and says why: with no relay set, Offutt's is not in the NWS feed.
    expect(prov.taf).toEqual({ detail: 'KOMA · KOFF not in the NWS feed', fallback: true });
  });

  it('omits sources that have not loaded (single-provider or null)', () => {
    const prov = deriveProvenance(EMPTY, false);
    expect(prov.windsAloft).toBeUndefined();
    expect(prov.daily).toBeUndefined();
    expect(prov.taf).toBeUndefined();
    // The NWS forecast is single-source and never carries a chip; the METAR
    // carries one only once an observation is loaded.
    expect(prov.metar).toBeUndefined();
    expect(prov.nws).toBeUndefined();
  });

  /* The METAR chip reports how the feed's decode of the report compared with
   * the METAR text the app parses. Amber for anything but agreement: on
   * 2026-09-23 the decode was empty through a two-hour overcast and the card
   * read "Clear" with nothing on screen to say why. */
  it('shows the METAR sky-decode comparison, amber unless the decodes agree', () => {
    const current = normalizeNwsObservation(OBSERVATION_FIXTURE, 'KPMV');
    expect(deriveProvenance({ ...EMPTY, current }, false)).toMatchObject({
      metar: { fallback: false, detail: expect.stringContaining('decode agrees') },
    });
    const gap = normalizeNwsObservation(
      {
        properties: {
          ...OBSERVATION_FIXTURE.properties,
          rawMessage: 'KPMV 230355Z AUTO 08003KT 10SM OVC027 15/13 A3028',
          cloudLayers: [],
        },
      },
      'KPMV',
    );
    expect(deriveProvenance({ ...EMPTY, current: gap }, false)).toMatchObject({
      metar: { fallback: true, detail: expect.stringContaining('decode had none') },
    });
    // Text with no sky group but a decode is the API's ordinary shape for many
    // records (37 of 40 at KLNK on 2026-09-23 had no text at all): the decode
    // serves the sky, and that is said without amber. The wording must hold
    // for text that exists but carries no sky group, too.
    for (const rawMessage of ['', 'KPMV 271300Z AUTO 19012G22KT 10SM 28/19 A2996']) {
      const textless = normalizeNwsObservation(
        { properties: { ...OBSERVATION_FIXTURE.properties, rawMessage } },
        'KPMV',
      );
      expect(deriveProvenance({ ...EMPTY, current: textless }, false)).toMatchObject({
        metar: { fallback: false, detail: expect.stringContaining('no sky group in the METAR text') },
      });
    }
    // The aviationweather path has one decode and nothing to compare.
    expect(deriveProvenance({ ...EMPTY, current: { ...current, skyDecode: undefined } }, false).metar).toBeUndefined();
  });

  /* Which feed served the observation, and how far behind the other feed's
   * newest report was: IEM normally has the report 20 minutes before NWS, and
   * NWS serving means IEM missed it, which is worth amber. */
  it('names the observation feed, amber when NWS served, and joins it to the sky chip', () => {
    const t1 = Date.parse('2026-09-27T20:35:00Z');
    const t0 = Date.parse('2026-09-27T20:15:00Z');
    const current = { ...normalizeNwsObservation(OBSERVATION_FIXTURE, 'KPMV')!, observedAt: t1 };
    expect(
      deriveProvenance({ ...EMPTY, current: { ...current, source: 'iem' }, currentOtherObservedAt: t0 }, false).metar,
    ).toEqual({ detail: 'IEM · NWS 20 min older · sky from METAR text · decode agrees', fallback: false });
    expect(
      deriveProvenance({ ...EMPTY, current: { ...current, source: 'nws' }, currentOtherObservedAt: t0 }, false).metar,
    ).toMatchObject({ detail: expect.stringMatching(/^NWS · IEM 20 min older · /), fallback: true });
    // The sky's amber survives a primary feed.
    expect(
      deriveProvenance({
        ...EMPTY,
        current: { ...current, source: 'iem', skyDecode: 'decode-differs' },
        currentOtherObservedAt: t1,
      }, false).metar,
    ).toMatchObject({ detail: expect.stringContaining('IEM · NWS same report'), fallback: true });
    // A feed with no sky comparison still gets its chip.
    expect(
      deriveProvenance({
        ...EMPTY,
        current: { ...current, source: 'iem', skyDecode: undefined },
        currentOtherObservedAt: t0,
      }, false).metar,
    ).toEqual({ detail: 'IEM · NWS 20 min older', fallback: false });
  });
});

describe('describeObservationFeed', () => {
  it('says when the other feed had nothing', () => {
    expect(describeObservationFeed('nws', 0, null)).toEqual({ detail: 'NWS · IEM had no report', fallback: true });
    expect(describeObservationFeed('iem', 0, undefined)).toEqual({ detail: 'IEM · NWS had no report', fallback: false });
  });
});

describe('describeTafSource', () => {
  const omaha = { station: 'KOMA', raw: '', issuedMs: null, validRaw: null, via: 'nws' as const };
  type Passed = NonNullable<Parameters<typeof describeTafSource>[0]['passedOver']>;
  const say = (passedOver: Passed, relay = true) => describeTafSource({ ...omaha, passedOver }, relay);

  it('names Offutt’s TAF read through the relay, and is not amber', () => {
    expect(describeTafSource({ ...omaha, station: 'KOFF', via: 'aviationweather' }, true)).toMatchObject({
      detail: 'KOFF · aviationweather.gov via the relay',
      fallback: false,
    });
  });

  it('tells a failed fetch apart from Offutt’s ordinary gaps, amber in each', () => {
    expect(say([{ station: 'KOFF', failed: 'HTTP 500', status: 500 }])).toEqual({
      detail: 'KOMA · KOFF fetch failed',
      fallback: true,
      flags: [TAF_RELAY_FAILED],
    });
    // The relay's 502 is aviationweather.gov failing behind it.
    expect(say([{ station: 'KOFF', failed: 'HTTP 502', status: 502 }]).detail).toBe('KOMA · KOFF upstream failed (502)');
    // Without the relay, a 502 is the NWS feed's, and not "upstream".
    expect(say([{ station: 'KOFF', failed: 'HTTP 502', status: 502 }], false).detail).toBe('KOMA · KOFF fetch failed');
    expect(say([{ station: 'KOFF', endedMs: 0 }]).detail).toBe('KOMA · KOFF TAF ended');
    expect(say([{ station: 'KOFF', noForecast: 'CNL' }]).detail).toBe('KOMA · KOFF TAF CNL');
    expect(say([{ station: 'KOFF', none: true }])).toEqual({ detail: 'KOMA · no KOFF TAF on aviationweather.gov', fallback: true });
  });

  it('says which feed had no TAF: the relay only for the station it serves', () => {
    expect(say([{ station: 'KOFF', none: true }], false).detail).toBe('KOMA · KOFF not in the NWS feed');
    const lincoln = { ...omaha, station: 'KLNK', passedOver: [{ station: 'KOFF', none: true }, { station: 'KOMA', none: true }] as Passed };
    expect(describeTafSource(lincoln, true).detail).toBe('KLNK · no KOFF TAF on aviationweather.gov · KOMA not in the NWS feed');
  });

  it('flags the relay’s own failure for the live-site check, and not aviationweather.gov’s', () => {
    expect(say([{ station: 'KOFF', failed: 'HTTP 404', status: 404 }]).flags).toEqual([TAF_RELAY_FAILED]);
    expect(say([{ station: 'KOFF', failed: 'Failed to fetch' }]).flags).toEqual([TAF_RELAY_FAILED]);
    expect(say([{ station: 'KOFF', failed: 'HTTP 502', status: 502 }]).flags).toBeUndefined();
    expect(say([{ station: 'KOFF', failed: 'HTTP 404', status: 404 }], false).flags).toBeUndefined();
    expect(say([{ station: 'KOMA', failed: 'HTTP 500', status: 500 }]).flags).toBeUndefined();
  });

  it('names aviationweather.gov as the source of Offutt’s TAF read through the relay', () => {
    const offutt = describeTafSource({ ...omaha, station: 'KOFF', via: 'aviationweather' }, true);
    expect(offutt.source?.url).toBe('https://aviationweather.gov/data/taf/?ids=KOFF');
    expect(describeTafSource({ ...omaha, station: 'KOFF', via: 'nws' }, false).source).toBeUndefined();
  });

  it('lists every station passed over, in the chain’s order', () => {
    const lincoln = {
      ...omaha,
      station: 'KLNK',
      passedOver: [
        { station: 'KOFF', failed: 'HTTP 502' },
        { station: 'KOMA', endedMs: 0 },
      ] as Passed,
    };
    expect(describeTafSource(lincoln, true).detail).toBe('KLNK · KOFF fetch failed · KOMA TAF ended');
  });
});
