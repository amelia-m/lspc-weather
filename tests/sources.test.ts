import { describe, expect, it } from 'vitest';
import { DATA_SOURCES, type DataSource } from '../src/config/sources';
import { SITE } from '../src/config/site';

/* A "Data:" footer label is a promise about where the link lands. Naming a
 * station, product, or section the URL does not actually select is the same
 * defect as a citation naming a SIM section and linking to the contents page:
 * the reader clicks expecting to land on it and has to go hunting instead. */

const entries = Object.entries(DATA_SOURCES) as Array<[string, DataSource]>;

describe('DATA_SOURCES', () => {
  it.each(entries)('%s has a label and an https URL', (_key, source) => {
    expect(source.label.trim()).not.toBe('');
    expect(source.url).toMatch(/^https:\/\//);
  });

  it.each(entries)('%s: a station named in the label is selected by the URL', (key, source) => {
    // Every station id this app knows about. A label mentioning one has to be
    // backed by a URL that opens on it — otherwise drop it from the label.
    const stations = [
      SITE.metarStation.id,
      SITE.radarSite.id,
      SITE.fdWindsStation,
      ...SITE.tafStations.map((s) => s.id),
    ];
    for (const id of stations) {
      if (!new RegExp(`\\b${id}\\b`).test(source.label)) continue;
      expect(source.url, `${key} names ${id} but its link does not select it`).toContain(id);
    }
  });

  it('does not claim the generic FD product page is station-specific', () => {
    // The winds-aloft fallback is fetched for OMA, but this link is the generic
    // NOAA FD page and does not open on OMA. The query parameters that would
    // select the station could not be verified from the environment this was
    // written in, so the label states what the link delivers rather than
    // guessing. The OMA provenance still shows on the winds-aloft card itself.
    expect(DATA_SOURCES.fdWinds.label).not.toContain(SITE.fdWindsStation);
  });
});
