import { describe, expect, it } from 'vitest';
import { GRIDPOINT_FIELDS, normalizeGridpoint, openMeteoDailyUrl, type RawGridpoint } from '../src/domain/normalize';
import { GRIDPOINT_FIXTURE } from '../src/api/fixtures/gridpoint';

describe('the forecast keeper', () => {
  it('keeps every gridpoint field the card reads: a kept snapshot rebuilds its hours exactly', () => {
    const p = GRIDPOINT_FIXTURE.properties as Record<string, unknown>;
    const kept = { properties: Object.fromEntries(GRIDPOINT_FIELDS.map((k) => [k, p[k] ?? null])) } as unknown as RawGridpoint;
    expect(normalizeGridpoint(kept)).toEqual(normalizeGridpoint(GRIDPOINT_FIXTURE));
  });

  it('asks Open-Meteo for the outlook the card asks for', () => {
    const url = openMeteoDailyUrl(40.8703, -96.1085, 'America/Chicago');
    expect(url).toContain('daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max');
    expect(url).toContain('&forecast_days=10&');
    expect(url).toContain('timezone=America%2FChicago');
  });
});
