/**
 * Fetches shared by the live winds-aloft scripts: Mark Schulze's endpoint and
 * Open-Meteo's run metadata (scripts/schulzeCompare.live.ts,
 * scripts/runSplit.live.ts). Not a test file; it needs the network.
 */
import { SITE } from '../src/config/site';
import { openMeteoRunMeta, type OpenMeteoRunMeta } from '../src/domain/surfaceWindSources';
import { runsSeen, type RunsSeen } from '../src/domain/runAge';

export interface Schulze {
  validtime: string;
  altFtRaw: number[];
  directionRaw: Record<string, number>;
  speedRaw: Record<string, number>;
  direction: Record<string, number>;
  speed: Record<string, number>;
  temp: Record<string, number>;
  groundElev: number;
  groundDir: number;
  groundSpd: number;
}

/** The tool's own endpoint, as its page calls it. `hourOffset` counts hours
 *  from the hour in progress; the site refuses a bare request. */
export async function schulze(hourOffset: number): Promise<Schulze | null> {
  const dz = SITE.dz;
  const url =
    `https://www.markschulze.net/winds/winds_openmeteo.php?lat=${dz.lat}&lon=${dz.lon}` +
    `&hourOffset=${hourOffset}&referrer=MSWA2024`;
  try {
    const res = await fetch(url, {
      headers: {
        Referer: 'https://www.markschulze.net/winds/',
        'User-Agent': 'Mozilla/5.0',
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.trimStart().startsWith('{') ? (JSON.parse(text) as Schulze) : null;
  } catch {
    return null;
  }
}

/** The Open-Meteo models this app's winds-aloft request can be served from
 *  here. On 2026-09-24 Schulze's raw 700 hPa level matched `best_match`,
 *  `gfs_seamless` and `ncep_hrrr_conus` exactly (docs/open-questions.md,
 *  "Which forecast run the winds-aloft request is served"). Open-Meteo's
 *  GFS & HRRR page lists "GFS Pressure Variables" at 0.25°, the
 *  `ncep_gfs025` domain, beside the 0.11° surface grid (read 2026-10-21). */
export const RUN_DOMAINS = ['ncep_hrrr_conus', 'ncep_gfs025'] as const;

/** Reads of each model's metadata, made at once. Open-Meteo's servers can
 *  hold a run at different moments while it is copied (one HRRR run read as
 *  available at 17:37:20Z and 17:39:33Z a second apart on 2026-10-21), so
 *  one read says only what one server had; several can show that they
 *  disagreed, which is the copying itself. */
const RUN_META_READS = 3;

async function runMetaOnce(domain: string): Promise<OpenMeteoRunMeta | null> {
  try {
    const res = await fetch(`https://api.open-meteo.com/data/${domain}/static/meta.json`, {
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? openMeteoRunMeta((await res.json()) as Parameters<typeof openMeteoRunMeta>[0]) : null;
  } catch {
    return null;
  }
}

/** One model's metadata across `RUN_META_READS` reads (`runsSeen`), or null
 *  when none could be read: the comparison goes on without it. */
export async function runMeta(domain: string): Promise<RunsSeen | null> {
  return runsSeen(await Promise.all(Array.from({ length: RUN_META_READS }, () => runMetaOnce(domain))));
}
