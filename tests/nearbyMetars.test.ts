import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { nearbyRows } from '../src/domain/nearbyMetars';
import { NearbyMetarsBody } from '../src/components/NearbyMetarsPanel';
import { IEM_NEBRASKA_FIXTURE } from '../src/api/fixtures/iemNebraska';
import { NEARBY_METAR_STATIONS, SITE } from '../src/config/site';
import { haversineMiles } from '../src/domain/geo';

/* The fixture is IEM's real answer of 2026-10-03 near 20Z, cut to the six
 * stations. The rows must come out nearest first, each decoded from its own
 * METAR text, with the distance worked out from IEM's position. */
describe('nearbyRows', () => {
  const recs = IEM_NEBRASKA_FIXTURE.data!;
  const rows = nearbyRows(recs, NEARBY_METAR_STATIONS, SITE.dz);

  it('orders the stations nearest the drop zone first', () => {
    const d = rows.map((r) => r.distanceMi!);
    expect(d).toEqual([...d].sort((a, b) => a - b));
    expect(rows[0].id).toBe('KPMV');
    const pmv = recs.find((r) => r.station === 'PMV')!;
    expect(rows[0].distanceMi).toBeCloseTo(haversineMiles(SITE.dz.lat, SITE.dz.lon, pmv.lat!, pmv.lon!), 6);
  });

  it("decodes each station's own report", () => {
    const pmv = rows.find((r) => r.id === 'KPMV')!;
    // KPMV 031935Z AUTO 17011G19KT 10SM CLR 24/07
    expect(pmv.current?.wind).toEqual({ directionDeg: 170, speedKt: 11, gustKt: 19 });
    expect(pmv.current?.visibilitySm).toBe(10);
    expect(pmv.category).toBe('VFR');
    const oma = rows.find((r) => r.id === 'KOMA')!;
    expect(oma.current?.raw).toContain('KOMA');
  });

  it('keeps a station IEM had no record for, last and without a report', () => {
    const r = nearbyRows(recs.filter((x) => x.station !== 'OFF'), NEARBY_METAR_STATIONS, SITE.dz);
    expect(r).toHaveLength(6);
    expect(r[5]).toMatchObject({ id: 'KOFF', current: null, distanceMi: null, category: null });
  });
});

describe('NearbyMetarsBody', () => {
  const rows = nearbyRows(IEM_NEBRASKA_FIXTURE.data!, NEARBY_METAR_STATIONS, SITE.dz);
  const html = renderToStaticMarkup(createElement(NearbyMetarsBody, { rows, error: null }));

  it('shows a row per station with its wind as the METAR states it', () => {
    expect((html.match(/<tr><td><strong>K[A-Z]{3}<\/strong>/g) ?? []).length).toBe(6);
    expect(html).toContain('<td>170° 11G19</td>');
    expect(html).toContain('<th>wind kt</th>');
  });

  it('gives every raw report one tap away', () => {
    for (const r of rows) expect(html).toContain(r.current!.raw.slice(0, 20));
  });

  it('says no report for a station without one, and loading before the first answer', () => {
    const missing = nearbyRows(IEM_NEBRASKA_FIXTURE.data!.filter((x) => x.station !== 'AFK'), NEARBY_METAR_STATIONS, SITE.dz);
    expect(renderToStaticMarkup(createElement(NearbyMetarsBody, { rows: missing, error: null }))).toContain('no report');
    expect(renderToStaticMarkup(createElement(NearbyMetarsBody, { rows: null, error: null }))).toContain('Loading');
  });
});
