import { describe, expect, it } from 'vitest';
import { deriveProvenance } from '../src/domain/sourceProvenance';
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
    // METAR and NWS forecast are single-source and never carry a chip.
    expect(prov.metar).toBeUndefined();
    expect(prov.nws).toBeUndefined();
  });
});
