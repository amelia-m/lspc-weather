import { describe, expect, it } from 'vitest';
import { shortError } from '../src/components/format';

describe('shortError', () => {
  it('cuts each URL in an error to its host and keeps the rest', () => {
    expect(
      shortError(
        'IEM: HTTP 503 for https://mesonet.agron.iastate.edu/api/1/currents.json?station=PMV&network=NE_ASOS; NWS: HTTP 503 for https://api.weather.gov/stations/KPMV/observations/latest',
      ),
    ).toBe('IEM: HTTP 503 for mesonet.agron.iastate.edu; NWS: HTTP 503 for api.weather.gov');
  });

  it('takes the whole of a URL whose query has commas', () => {
    expect(
      shortError('HTTP 503 for https://api.open-meteo.com/v1/forecast?latitude=40.8675&daily=weather_code,temperature_2m_max'),
    ).toBe('HTTP 503 for api.open-meteo.com');
    expect(shortError('HTTP 503 for https://api.weather.gov/points/40.8675,-96.11')).toBe('HTTP 503 for api.weather.gov');
  });

  it('leaves a message with no URL alone', () => {
    expect(shortError('Request timed out after 12 s (api.open-meteo.com)')).toBe(
      'Request timed out after 12 s (api.open-meteo.com)',
    );
  });
});
