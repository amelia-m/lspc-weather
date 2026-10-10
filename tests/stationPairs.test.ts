import { describe, expect, it } from 'vitest';
import { AUTOMATED_TOP_FT, comparePair, stationReports } from '../src/domain/stationPairs';
import type { MetarRecord } from '../src/domain/cloudCoverSources';

const metar = (station: string, obsAt: string, sky: string): MetarRecord => ({
  src: 'metar',
  site: station,
  obsAt,
  raw: `K${station} ${obsAt.slice(8, 10)}${obsAt.slice(11, 13)}${obsAt.slice(14, 16)}Z AUTO 10SM ${sky} 15/10 A3001`,
});

describe('stationReports', () => {
  it('reads each report’s cover in time order, null without a sky group', () => {
    const r = stationReports([metar('PMV', '2026-10-01T12:55Z', 'SCT040'), metar('PMV', '2026-10-01T12:15Z', '')]);
    expect(r.map((x) => x.obs?.category ?? null)).toEqual([null, 'SCT']);
  });
});

describe('stationReports below the automated top', () => {
  it('leaves out layers above 12,000 ft, and reads a report left with none as CLR', () => {
    const r = stationReports(
      [
        metar('OMA', '2026-10-01T11:53Z', 'FEW250'),
        metar('OMA', '2026-10-01T12:53Z', 'SCT040 BKN250'),
        metar('OMA', '2026-10-01T13:53Z', 'BKN/// OVC300'),
        metar('OMA', '2026-10-01T14:53Z', ''),
      ],
      AUTOMATED_TOP_FT,
    );
    expect(r.map((x) => x.obs?.category ?? null)).toEqual(['CLR', 'SCT', 'BKN', null]);
    expect(stationReports([metar('OMA', '2026-10-01T11:53Z', 'FEW250')])[0].obs?.category).toBe('FEW');
  });
});

describe('comparePair', () => {
  // AWOS at :15/:35/:55, ASOS at :53. Each top of the hour takes the
  // report within ten minutes of it: the 11:55 and 11:53 for 12Z.
  const awos = stationReports([
    metar('PMV', '2026-10-01T11:55Z', 'SCT030'),
    metar('PMV', '2026-10-01T12:15Z', 'OVC010'),
    metar('PMV', '2026-10-01T12:55Z', 'BKN020'),
    metar('PMV', '2026-10-01T13:55Z', 'CLR'),
    metar('PMV', '2026-10-01T14:55Z', ''),
    metar('PMV', '2026-10-01T15:35Z', 'OVC008'),
    metar('PMV', '2026-10-01T16:35Z', 'CLR'),
  ]);
  const asos = stationReports([
    metar('OMA', '2026-10-01T11:53Z', 'FEW030'),
    metar('OMA', '2026-10-01T12:53Z', 'BKN020'),
    metar('OMA', '2026-10-01T13:53Z', 'SCT050'),
    metar('OMA', '2026-10-01T14:53Z', 'OVC008'),
    metar('OMA', '2026-10-01T15:53Z', 'OVC008'),
    metar('OMA', '2026-10-01T16:53Z', 'OVC008'),
  ]);
  const s = comparePair(awos, asos);

  it('pairs the reports nearest each top of the hour, and skips an hour either lacks', () => {
    // 12Z: SCT and FEW; 13Z: BKN and BKN; 14Z: CLR and SCT. 15Z: the AWOS
    // report has no sky group. 16Z: the AWOS's nearest is 25 minutes off.
    // The 12:15 OVC is not the nearest to any hour.
    expect(s.hours).toBe(3);
    expect(s.table.SCT.FEW).toBe(1);
    expect(s.table.BKN.BKN).toBe(1);
    expect(s.table.CLR.SCT).toBe(1);
    expect(s.table.OVC.OVC).toBe(0);
    expect(s.sameCategory).toBe(1);
  });

  it('counts whether each reported a ceiling', () => {
    expect(s.ceiling).toEqual({ both: 1, aOnly: 0, bOnly: 0, neither: 2 });
  });

  it('gives nothing for a station with no reports', () => {
    expect(comparePair(awos, []).hours).toBe(0);
  });
});
