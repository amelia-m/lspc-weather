import { describe, expect, it } from 'vitest';
import { deriveProvenance } from '../src/domain/sourceProvenance';
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
    });
    expect(prov.windsAloft).toEqual({ detail: 'Open-Meteo pressure levels', fallback: false });
    expect(prov.daily).toEqual({ detail: 'Open-Meteo (10-day)', fallback: false });
    expect(prov.taf).toEqual({ detail: 'KOFF', fallback: false });
  });

  it('marks the fallback providers as fallback', () => {
    const prov = deriveProvenance({
      ...EMPTY,
      windsAloftSource: 'nws-fd',
      dailySource: 'nws-gridpoint',
      taf: { station: 'KOMA', raw: '', issuedMs: null, validRaw: null },
    });
    expect(prov.windsAloft?.fallback).toBe(true);
    expect(prov.windsAloft?.detail).toContain('NOAA FD');
    expect(prov.daily?.fallback).toBe(true);
    expect(prov.daily?.detail).toContain('NWS gridpoint');
    // A non-primary TAF station (not the first configured) is a fallback.
    expect(prov.taf).toEqual({ detail: 'KOMA', fallback: true });
  });

  it('omits sources that have not loaded (single-provider or null)', () => {
    const prov = deriveProvenance(EMPTY);
    expect(prov.windsAloft).toBeUndefined();
    expect(prov.daily).toBeUndefined();
    expect(prov.taf).toBeUndefined();
    // The NWS forecast is single-source and never carries a chip; the METAR
    // carries one only once an observation is loaded.
    expect(prov.metar).toBeUndefined();
    expect(prov.nws).toBeUndefined();
  });

  /* The METAR chip reports how api.weather.gov's decode of the report compared
   * with the METAR text the app parses. Amber for anything but agreement: on
   * 2026-09-23 the decode was empty through a two-hour overcast and the card
   * read "Clear" with nothing on screen to say why. */
  it('shows the METAR sky-decode comparison, amber unless the decodes agree', () => {
    const current = normalizeNwsObservation(OBSERVATION_FIXTURE, 'KPMV');
    expect(deriveProvenance({ ...EMPTY, current })).toMatchObject({
      metar: { fallback: false, detail: expect.stringContaining('NWS decode agrees') },
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
    expect(deriveProvenance({ ...EMPTY, current: gap })).toMatchObject({
      metar: { fallback: true, detail: expect.stringContaining('NWS decode had none') },
    });
    // The aviationweather path has one decode and nothing to compare.
    expect(deriveProvenance({ ...EMPTY, current: { ...current, skyDecode: undefined } }).metar).toBeUndefined();
  });
});
