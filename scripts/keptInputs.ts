/**
 * Reading the inputs the kept-forecast scripts share
 * (scripts/keptForecastsVsKpmv.ts, scripts/windErrorsData.ts): the
 * forecast keeper's snapshots, KPMV's reports, Open-Meteo's archived
 * wind and the surface-wind sampler's records, so the tables and the
 * figures are built from the same sets.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { KeptGridpointSnapshot } from '../src/domain/ceilingHeights';
import type { MetarRecord } from '../src/domain/cloudCoverSources';
import { parseSurfaceWindLines, type SurfaceWindRecord } from '../src/domain/surfaceWindSources';
import { parseOmWindLines, type OmWindRecord } from '../src/domain/windErrors';
import { parseNdfdWindLines } from '../src/domain/ndfdGust';

const read = (f: string): string => {
  const buf = readFileSync(f);
  return (f.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8');
};
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json.gz') ? [p] : [];
  });

/** The surface-wind sampler's records from its logs (`.jsonl` or `.gz`),
 *  as read; `orderedRuns` puts them in order and drops repeats. */
export function loadSurfaceWindRecords(files: readonly string[]): SurfaceWindRecord[] {
  return files.flatMap((f) => parseSurfaceWindLines(read(f)));
}

/** Open-Meteo's archived wind (scripts/cloudCoverFetch.py, PARTS=omwind),
 *  in the order the files are given; `omArchiveSection` keeps the last
 *  record of an hour fetched twice. */
export function loadOmWindRecords(files: readonly string[]): OmWindRecord[] {
  return files.flatMap((f) => parseOmWindLines(read(f)));
}

/** NDFD's wind, gust and direction records from any mix of files
 *  (data/parity/ndfd-wgust-*, ndfd-wind-*), the drop zone's. */
export function loadNdfdWind(files: readonly string[]): ReturnType<typeof parseNdfdWindLines> {
  const all = files.map((f) => parseNdfdWindLines(read(f)));
  return {
    gust: all.flatMap((w) => w.gust),
    spd: all.flatMap((w) => w.spd),
    dir: all.flatMap((w) => w.dir),
    truncated: all.flatMap((w) => w.truncated),
  };
}

/** Every kept snapshot (`.json.gz`) under a folder, searched recursively. */
export function loadKeptSnapshots(dir: string): KeptGridpointSnapshot[] {
  return walk(dir).map((f) => JSON.parse(read(f)) as KeptGridpointSnapshot);
}

/** KPMV's reports from `{src: 'metar', obsAt, raw}` line files (`.jsonl` or
 *  `.jsonl.gz`), in time order. Overlapping files repeat reports; each is
 *  kept once. A record naming another station is skipped. */
export function loadKpmvReports(files: readonly string[]): MetarRecord[] {
  const byKey = new Map<string, MetarRecord>();
  for (const f of files) {
    for (const line of read(f).split('\n')) {
      if (!line.trim()) continue;
      const r = JSON.parse(line) as MetarRecord;
      if (r.src !== 'metar' || (r.site != null && r.site !== 'KPMV')) continue;
      byKey.set(`${r.obsAt}|${r.raw}`, r);
    }
  }
  return [...byKey.values()].sort((a, b) => a.obsAt.localeCompare(b.obsAt));
}
