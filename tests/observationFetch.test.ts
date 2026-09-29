import { describe, expect, it } from 'vitest';
import { fetchObservation } from '../src/api/iem';
import { USE_FIXTURES } from '../src/api/http';
import { IEM_CURRENT_FIXTURE } from '../src/api/fixtures/iemCurrent';
import { OBSERVATION_FIXTURE } from '../src/api/fixtures/observation';
import { normalizeIemCurrent } from '../src/domain/iem';
import { normalizeNwsObservation } from '../src/domain/normalize';
import { SITE } from '../src/config/site';
import type { CurrentConditions } from '../src/domain/types';

const nwsFixture = normalizeNwsObservation(OBSERVATION_FIXTURE, 'KPMV')!;
const iemFixture = normalizeIemCurrent(IEM_CURRENT_FIXTURE.data![0], 'KPMV')!;

describe('fetchObservation', () => {
  it('shows IEM’s fixture report in fixture mode, with NWS’s older one beside it', async () => {
    expect(USE_FIXTURES).toBe(true);
    const r = await fetchObservation(SITE.metarStation);
    expect(r.current.source).toBe('iem');
    expect(r.otherObservedAt).toBe(nwsFixture.observedAt);
    expect(r.current.observedAt).toBeGreaterThan(nwsFixture.observedAt);
  });

  it('keeps the fixture report the same weather as NWS’s, so advisories do not change with the feed', () => {
    const same = (c: CurrentConditions) => ({
      wind: c.wind,
      skyLayers: c.skyLayers,
      ceilingFtAgl: c.ceilingFtAgl,
      tempC: c.tempC,
      dewpointC: c.dewpointC,
      altimeterInHg: c.altimeterInHg,
      visibilitySm: c.visibilitySm,
      skyDecode: c.skyDecode,
    });
    expect(same(iemFixture)).toEqual(same(nwsFixture));
  });

  it('shows NWS when IEM fails, and keeps the IEM error for the log', async () => {
    const boom = new Error('IEM down');
    const r = await fetchObservation(SITE.metarStation, {
      iem: () => Promise.reject(boom),
      nws: () => Promise.resolve(nwsFixture),
    });
    expect(r.current.source).toBe('nws');
    expect(r.otherObservedAt).toBeNull();
    expect(r.iemError).toBe(boom);
  });

  it('rejects, naming both, only when neither feed has a report', async () => {
    await expect(
      fetchObservation(SITE.metarStation, {
        iem: () => Promise.reject(new Error('timeout')),
        nws: () => Promise.resolve(null),
      }),
    ).rejects.toThrow('IEM: timeout; NWS: NWS had no report');
  });

  it('asks IEM with its own id and network, and NWS with the ICAO id', async () => {
    const asked: string[] = [];
    await fetchObservation(SITE.metarStation, {
      iem: (id, net, st) => (asked.push(`iem ${id} ${net} ${st}`), Promise.resolve(iemFixture)),
      nws: (st) => (asked.push(`nws ${st}`), Promise.resolve(null)),
    });
    expect(asked).toEqual(['iem PMV NE_ASOS KPMV', 'nws KPMV']);
  });
});
