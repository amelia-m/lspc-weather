/**
 * Keep what the dashboard's forecasts said, once an hour, for the ones no
 * archive holds. Run by .github/workflows/forecast-keep.yml, which commits
 * each snapshot to the `forecast-archive` branch. Usage:
 *
 *   npx tsx scripts/forecastKeep.ts out.json.gz
 *
 * The NWS gridpoint and the Open-Meteo 10-day outlook serve only the
 * future. NDFD's archive holds the gridpoint's sky cover and ceiling value
 * for value (docs/cloud-cover-sources.md, docs/ceiling-heights.md) and has
 * grids for wind, visibility, temperature and rainfall, but not the hourly
 * rain chance or the thunder chance the precipitation card shows, and
 * nothing holds the outlook as the card asked for it. Keeping the card's
 * own requests, every field normalizeGridpoint reads (GRIDPOINT_FIELDS),
 * makes each kept hour the forecast a reader saw, at the lead they saw it.
 * The winds aloft are not kept: Open-Meteo's own archives hold them
 * (docs/open-questions.md, "Forecasts kept for later").
 *
 * One record per run: `at` (when fetched), and for each source either its
 * data or `error`. A source that fails does not lose the other; the run
 * fails only when both do.
 */
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { SITE } from '../src/config/site';
import { GRIDPOINT_FIELDS, openMeteoDailyUrl } from '../src/domain/normalize';

const UA = { 'User-Agent': 'lspc-weather forecast keeper (github.com/amelia-m/lspc-weather)', Accept: 'application/geo+json' };

async function json(url: string): Promise<Record<string, unknown>> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
      return (await res.json()) as Record<string, unknown>;
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 5_000 * (attempt + 1)));
    }
  }
  throw last;
}
const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

async function gridpoint(): Promise<object> {
  // As the app finds it: the points endpoint names the grid for the DZ.
  const point = (await json(`https://api.weather.gov/points/${SITE.dz.lat},${SITE.dz.lon}`)) as {
    properties: { forecastGridData: string };
  };
  const url = point.properties.forecastGridData;
  const p = (await json(url)).properties as Record<string, unknown>;
  return {
    url,
    updateTime: p.updateTime,
    properties: Object.fromEntries(GRIDPOINT_FIELDS.map((k) => [k, p[k] ?? null])),
  };
}

const [nws, om] = await Promise.allSettled([gridpoint(), json(openMeteoDailyUrl(SITE.dz.lat, SITE.dz.lon, SITE.timeZone))]);
const record = {
  at: new Date().toISOString(),
  nwsGridpoint: nws.status === 'fulfilled' ? nws.value : { error: msg(nws.reason) },
  openMeteoDaily: om.status === 'fulfilled' ? om.value : { error: msg(om.reason) },
};
writeFileSync(process.argv[2], gzipSync(JSON.stringify(record)));
console.log(`kept ${process.argv[2]}: nws ${nws.status}, open-meteo ${om.status}`);
if (nws.status === 'rejected' && om.status === 'rejected') process.exit(1);
