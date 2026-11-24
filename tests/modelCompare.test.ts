import { describe, expect, it } from 'vitest';
import { OPEN_METEO_FIXTURE } from '../src/api/fixtures/openMeteo';
import { hourStartMs } from '../src/api/fixtures/_time';
import { WINDS_ALOFT_LEVELS_AGL } from '../src/config/site';
import { rrfsLogOf } from '../src/domain/modelCompare';
import { normalizeOpenMeteo, OPEN_METEO_RRFS_MODEL, type RawOpenMeteo } from '../src/domain/normalize';
import { interpolateWindsAloft } from '../src/domain/windsAloft';

/* The comparison's record of the RRFS (scripts/schulzeCompare.live.ts, from
 * 2026-11-24). The script must never fail its run, so each way the second
 * model's answer can go wrong has to come back as a record, not a throw. */
describe('rrfsLogOf: the RRFS table against the default, as the comparison logs it', () => {
  const now = hourStartMs();
  const ELEV = 1182;
  // The fixture's forecast is ISO-timed, as the normaliser reads it; the live
  // answer is Unix-timed and coerced first, which a fixture copy stands for.
  const iso = OPEN_METEO_FIXTURE as unknown as RawOpenMeteo;
  const base = normalizeOpenMeteo(OPEN_METEO_FIXTURE, now);
  const defaultLevels = interpolateWindsAloft(base.samples, ELEV, WINDS_ALOFT_LEVELS_AGL);
  const validMs = base.validMs as number;

  it('logs zero differences, and how much it was served, when the model answers as the default did', () => {
    const log = rrfsLogOf({ raw: iso }, null, now, validMs, defaultLevels, ELEV);
    expect(log.error).toBeUndefined();
    expect(log.model).toBe(OPEN_METEO_RRFS_MODEL);
    expect(log.samples).toBe(base.samples.length);
    expect(log.levels).toBe(defaultLevels.length);
    expect(log.rows?.length).toBe(defaultLevels.length);
    expect(log.rows?.every((r) => r.dDir === 0 && r.dSpd === 0)).toBe(true);
  });

  it('logs the model’s own differences, row by row', () => {
    // The same answer with every 700 hPa wind 10 kt stronger: the rows that
    // level decides move, the surface row does not.
    const stronger = structuredClone(OPEN_METEO_FIXTURE) as unknown as RawOpenMeteo;
    const h = stronger.hourly as Record<string, (number | null)[]>;
    h.wind_speed_700hPa = h.wind_speed_700hPa.map((v) => (v == null ? v : v + 10));
    const log = rrfsLogOf({ raw: stronger }, null, now, validMs, defaultLevels, ELEV);
    expect(log.rows?.find((r) => r.ft === 0)?.dSpd).toBe(0);
    expect(Math.max(...(log.rows ?? []).map((r) => r.dSpd))).toBeGreaterThan(5);
  });

  it('records a failed request as its error, with no rows', () => {
    expect(rrfsLogOf({ error: 'HTTP 429' }, null, now, validMs, defaultLevels, ELEV)).toEqual({
      model: OPEN_METEO_RRFS_MODEL,
      run: null,
      error: 'HTTP 429',
    });
  });

  it('refuses to difference two tables for different hours', () => {
    const log = rrfsLogOf({ raw: iso }, null, now, validMs + 3_600_000, defaultLevels, ELEV);
    expect(log.error).toMatch(/^a different hour: /);
    expect(log.rows).toBeUndefined();
  });

  it('records a body it cannot read instead of throwing', () => {
    const log = rrfsLogOf({ raw: { error: true, reason: 'nope' } as unknown as RawOpenMeteo }, null, now, validMs, defaultLevels, ELEV);
    expect(log.error).toBeDefined();
    expect(log.rows).toBeUndefined();
  });

  it('records an answer with no hours as no usable hour', () => {
    const empty = { ...OPEN_METEO_FIXTURE, hourly: { time: [] } } as unknown as RawOpenMeteo;
    expect(rrfsLogOf({ raw: empty }, null, now, validMs, defaultLevels, ELEV).error).toBe('no usable hour');
  });
});
