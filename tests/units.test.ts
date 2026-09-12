import { describe, expect, it } from 'vitest';
import { compass, compass16 } from '../src/domain/units';

describe('compass16', () => {
  it('labels the cardinal and intercardinal points', () => {
    expect(compass16(0)).toBe('N');
    expect(compass16(45)).toBe('NE');
    expect(compass16(90)).toBe('E');
    expect(compass16(180)).toBe('S');
    expect(compass16(270)).toBe('W');
  });

  it('resolves the secondary intercardinals the 8-point label cannot', () => {
    expect(compass16(22.5)).toBe('NNE');
    expect(compass16(67.5)).toBe('ENE');
    expect(compass16(112.5)).toBe('ESE');
    expect(compass16(247.5)).toBe('WSW');
  });

  it('reports the DZ→KPMV bearing as ENE where 8-point rounds to NE', () => {
    // The reason this function exists: the METAR station sits at ~060° true
    // from the drop zone, which the 8-point label flattens to NE (045°).
    expect(compass(60.3)).toBe('NE');
    expect(compass16(60.3)).toBe('ENE');
  });

  it('wraps past 360° and handles negative headings', () => {
    expect(compass16(360)).toBe('N');
    expect(compass16(371)).toBe('N');
    expect(compass16(-22.5)).toBe('NNW');
    expect(compass16(-90)).toBe('W');
  });

  it('rounds at the half-sector boundary rather than truncating', () => {
    // 11.25° is the N/NNE boundary; just over it must read NNE.
    expect(compass16(11.24)).toBe('N');
    expect(compass16(11.26)).toBe('NNE');
  });
});
