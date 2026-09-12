import { describe, expect, it } from 'vitest';
import { compass } from '../src/domain/units';

describe('compass', () => {
  it('labels the cardinal and intercardinal points', () => {
    expect(compass(0)).toBe('N');
    expect(compass(45)).toBe('NE');
    expect(compass(90)).toBe('E');
    expect(compass(180)).toBe('S');
    expect(compass(270)).toBe('W');
  });

  it('resolves the secondary intercardinals an 8-point label cannot', () => {
    expect(compass(22.5)).toBe('NNE');
    expect(compass(67.5)).toBe('ENE');
    expect(compass(112.5)).toBe('ESE');
    expect(compass(247.5)).toBe('WSW');
  });

  it('keeps a 060° heading out of the NE bucket', () => {
    // The reason for 16 points: an 8-point label rounds 060° to NE (045°),
    // a 15° error. This is the DZ→KPMV bearing and a common wind direction.
    expect(compass(60.3)).toBe('ENE');
  });

  it('wraps past 360° and handles negative headings', () => {
    expect(compass(360)).toBe('N');
    expect(compass(371)).toBe('N');
    expect(compass(-22.5)).toBe('NNW');
    expect(compass(-90)).toBe('W');
  });

  it('rounds at the half-sector boundary rather than truncating', () => {
    // 11.25° is the N/NNE boundary; just over it must read NNE.
    expect(compass(11.24)).toBe('N');
    expect(compass(11.26)).toBe('NNE');
  });

  it('covers every one of the 16 sectors at its centre', () => {
    const expected = [
      'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
    ];
    expected.forEach((label, i) => expect(compass(i * 22.5)).toBe(label));
  });
});
