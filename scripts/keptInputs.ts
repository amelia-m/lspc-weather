/**
 * Reading the inputs the kept-forecast scripts share
 * (scripts/keptForecastsVsKpmv.ts, scripts/keptWindErrorsPlot.ts): the
 * forecast keeper's snapshots and KPMV's reports, so the tables and the
 * figure are always built from the same set.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { KeptGridpointSnapshot } from '../src/domain/ceilingHeights';
import type { MetarRecord } from '../src/domain/cloudCoverSources';

const read = (f: string): string => {
  const buf = readFileSync(f);
  return (f.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8');
};
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json.gz') ? [p] : [];
  });

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
