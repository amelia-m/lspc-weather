import { describe, expect, it } from 'vitest';
import {
  chooseForecastHour,
  offsetBarPosition,
  offsetFromNow,
  selectionAfterStep,
  STEP_BACK_HOURS,
  STEP_FORWARD_HOURS,
  stepForecastHour,
} from '../src/domain/forecastHour';
import type { WindsAloftHour } from '../src/domain/types';

const H = 3_600_000;
const t0 = Date.UTC(2026, 8, 27, 12);
const level = (dir: number) => [{ altitudeFtAgl: 1000, altitudeFtMsl: 2182, directionDeg: dir, speedKt: 10, tempC: 15 }];
const hours: WindsAloftHour[] = [0, 1, 2, 3].map((k) => ({ validMs: t0 + k * H, levels: level(100 + k) }));

describe('chooseForecastHour', () => {
  it('follows the hour nearest the clock, switching at half past', () => {
    const before = chooseForecastHour(hours, null, t0 + H + 29 * 60_000)!;
    expect(before.validMs).toBe(t0 + H);
    expect(before.following).toBe(true);
    const after = chooseForecastHour(hours, null, t0 + H + 31 * 60_000)!;
    expect(after.validMs).toBe(t0 + 2 * H);
    expect(after.levels).toBe(hours[2].levels);
  });

  it('keeps a stepped-to hour as that hour when the clock moves on', () => {
    // Stepped one hour ahead at 12:40 (nearest 13Z), so 14Z is chosen.
    const c = chooseForecastHour(hours, t0 + 2 * H, t0 + 40 * 60_000)!;
    expect(c.validMs).toBe(t0 + 2 * H);
    expect(c.following).toBe(false);
    // An hour later the nearest hour is 14Z itself; the choice stays 14Z
    // rather than becoming "one ahead" (15Z). Kept off the last hour so the
    // end of the list cannot hide the difference.
    expect(chooseForecastHour(hours, t0 + 2 * H, t0 + 100 * 60_000)!.validMs).toBe(t0 + 2 * H);
  });

  it('goes back to following the clock when the chosen hour is no longer in the data', () => {
    const c = chooseForecastHour(hours, t0 - 5 * H, t0 + 10 * 60_000)!;
    expect(c.validMs).toBe(t0);
    expect(c.following).toBe(true);
  });

  it('says whether there is an hour either side', () => {
    expect(chooseForecastHour(hours, t0, t0)).toMatchObject({ canBack: false, canForward: true });
    expect(chooseForecastHour(hours, t0 + 3 * H, t0)).toMatchObject({ canBack: true, canForward: false });
    expect(chooseForecastHour(hours, t0 + H, t0)).toMatchObject({ canBack: true, canForward: true });
  });

  it('is null with no hours (the FD fallback, or before the winds load)', () => {
    expect(chooseForecastHour(null, null, t0)).toBeNull();
    expect(chooseForecastHour([], null, t0)).toBeNull();
  });
});

describe('stepForecastHour', () => {
  it('moves one hour either way and stops at the ends', () => {
    expect(stepForecastHour(hours, t0 + H, 1)).toBe(t0 + 2 * H);
    expect(stepForecastHour(hours, t0 + H, -1)).toBe(t0);
    expect(stepForecastHour(hours, t0, -1)).toBeNull();
    expect(stepForecastHour(hours, t0 + 3 * H, 1)).toBeNull();
  });
});

describe('offsetFromNow', () => {
  it('states the gap in hours and minutes, and which way', () => {
    expect(offsetFromNow(t0 + 105 * 60_000, t0)).toEqual({ minutes: 105, text: '1 h 45 min ahead of now' });
    expect(offsetFromNow(t0 - 20 * 60_000, t0)).toEqual({ minutes: -20, text: '20 min behind now' });
    expect(offsetFromNow(t0 + 2 * H, t0).text).toBe('2 h ahead of now');
    expect(offsetFromNow(t0 + 20_000, t0).text).toBe('at the current time');
  });
});

describe('offsetBarPosition', () => {
  it('runs three hours back to five forward by default, now three-eighths along', () => {
    expect(offsetBarPosition(0)).toEqual({ nowPct: 37.5, markPct: 37.5, beyond: null });
    expect(offsetBarPosition(-180)).toEqual({ nowPct: 37.5, markPct: 0, beyond: null });
    expect(offsetBarPosition(300)).toEqual({ nowPct: 37.5, markPct: 100, beyond: null });
    expect(offsetBarPosition(120).markPct).toBe(62.5);
  });

  it('keeps every hour the buttons can reach on the bar', () => {
    // Nearest hour 30 min off the clock, then the full step either way.
    expect(offsetBarPosition(-(STEP_BACK_HOURS * 60 + 30)).beyond).toBeNull();
    expect(offsetBarPosition(STEP_FORWARD_HOURS * 60 + 30).beyond).toBeNull();
  });

  it('pins an hour beyond the span to the edge and says so', () => {
    expect(offsetBarPosition(360)).toMatchObject({ markPct: 100, beyond: 'after' });
    expect(offsetBarPosition(-600)).toMatchObject({ markPct: 0, beyond: 'before' });
  });
});

describe('the step window', () => {
  // Twelve hours from 12Z; the clock at 16:10Z, so the nearest hour is 16Z
  // (index 4): the buttons reach 14Z to 20Z.
  const day: WindsAloftHour[] = Array.from({ length: 12 }, (_, k) => ({ validMs: t0 + k * H, levels: level(k) }));
  const now = t0 + 4 * H + 10 * 60_000;

  it('reaches two hours back and four forward from the hour nearest the clock', () => {
    expect(chooseForecastHour(day, t0 + 2 * H, now)).toMatchObject({ following: false, canBack: false, canForward: true });
    expect(chooseForecastHour(day, t0 + 8 * H, now)).toMatchObject({ following: false, canBack: true, canForward: false });
    expect(selectionAfterStep(day, t0 + 2 * H, -1, now)).toBeUndefined();
    expect(selectionAfterStep(day, t0 + 8 * H, 1, now)).toBeUndefined();
    expect(selectionAfterStep(day, t0 + 7 * H, 1, now)).toBe(t0 + 8 * H);
  });

  it('lets go of a stepped hour the clock has carried outside the window', () => {
    // 14Z was two back at 16:10; at 17:10 it is three back.
    expect(chooseForecastHour(day, t0 + 2 * H, now + H)).toMatchObject({ validMs: t0 + 5 * H, following: true });
  });
});

describe('selectionAfterStep', () => {
  const now = t0 + H + 10 * 60_000; // nearest hour 13Z
  it('remembers the hour stepped to', () => {
    expect(selectionAfterStep(hours, t0 + H, 1, now)).toBe(t0 + 2 * H);
  });

  it('goes back to following the clock when the step lands on the nearest hour', () => {
    expect(selectionAfterStep(hours, t0 + 2 * H, -1, now)).toBeNull();
  });

  it('does nothing past the end of the hours', () => {
    expect(selectionAfterStep(hours, t0 + 3 * H, 1, now)).toBeUndefined();
  });
});
