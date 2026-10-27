/**
 * The relay's second path: the NWS National Blend of Models' hourly station
 * bulletin (NBH) for KPMV, cut from NOAA's open data bucket.
 *
 * usairnet's "Lowest cloud base" row is the NBM's `LCB`, and the NWS
 * gridpoint the dashboard reads has no such element (docs/usairnet-parity.md,
 * "Where usairnet's rows come from"). The bucket sends a CORS header, so a
 * browser could read it, but each hourly file holds every station, 28 MB,
 * which no reader should fetch for one block of 2 KB. So the relay cuts the
 * block out: a Range request around where KPMV's block has sat in every file
 * read since 2026-10-24 (18,242,995 bytes in, the same across four days and
 * files of two sizes), and the whole file only when the block is not in that
 * window. Nothing promises the offset; the window and the fallback are what
 * make it safe to assume.
 *
 * Which file: each hour's bulletin lands 40 to 70 minutes after its hour
 * (read 2026-10-27: the 00Z file at 01:13Z, 01Z at 02:06Z, 02Z before
 * 02:47Z), and its hours begin the hour after its cycle, so the newest
 * file never covers the hour under way. The relay takes the newest cycle
 * whose hours do: the hour before the one under way, then older ones,
 * asked for with HEAD. The bucket answers a missing key 404.
 *
 * The answer is kept for `NBM_CACHE_SECONDS` in the Worker's memory, as the
 * TAF is: a bulletin an hour, so ten minutes loses little and spares the
 * bucket every reader's request. The app parses the block (src/domain/nbm.ts);
 * the relay sends it as text, with the file it came from, so what the app
 * read can be checked against the bucket.
 */
import { NBM_PATH, NBM_STATION } from './station';
import { json, preflightOrMethod } from './http';

export const NBM_BUCKET = 'https://noaa-nbm-grib2-pds.s3.amazonaws.com';
export const NBM_CACHE_SECONDS = 600;
/** Per request to the bucket: a HEAD, a window, or the whole file. */
export const NBM_TIMEOUT_MS = 8_000;
export const NBM_KNOWN_OFFSET = 18_242_995;
/** Bytes read either side of the remembered offset: about 50 stations'
 *  blocks each way, more drift than any file read has shown. */
export const NBM_WINDOW = 1_500_000;
export const NBM_LOOKBACK_HOURS = 4;
const USER_AGENT = 'lspc-weather NBM relay (https://github.com/amelia-m/lspc-weather)';

export interface NbmMemo {
  body: string | null;
  at: number;
  /** Where the station's block was last found, so the next window is read
   *  around it. */
  offset: number;
}

export interface NbmDeps {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  memo: NbmMemo;
  now: () => number;
}

/** The bucket's key for the NBH text of a cycle:
 *  `blend.YYYYMMDD/HH/text/blend_nbhtx.tHHz`. */
export function nbmFileFor(cycleMs: number): string {
  const d = new Date(cycleMs);
  const day = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  return `blend.${day}/${hh}/text/blend_nbhtx.t${hh}z`;
}

const HEADER = (station: string): RegExp => new RegExp(`(^|\\n) ${station}\\s+NBM V\\S+ NBH GUIDANCE[^\\n]*`);
/** Any station's header: ids are mostly four characters, but the NBM's
 *  station list has buoys and C-MAN stations with five, which a tighter
 *  pattern ran past (found in review, 2026-10-27). */
const ANY_HEADER = /\n \S+\s+NBM V\S+ NBH GUIDANCE/;
/** The line of spaces between one station's block and the next's. */
const BLANK_LINE = /\n[ \t]*\r?\n/;

/** The station's block out of bulletin text: from its header line to the
 *  blank line or the next station's header, whichever comes first. `at` is
 *  where the header begins in `text`. Null when the block is not there;
 *  `complete` false when the text ends before either marker, which a window
 *  can do and the whole file cannot. */
export function cutStationBlock(text: string, station: string): { block: string; at: number; complete: boolean } | null {
  const m = HEADER(station).exec(text);
  if (!m) return null;
  const at = m.index + (m[1] === '\n' ? 1 : 0);
  const rest = text.slice(at);
  const next = ANY_HEADER.exec(rest.slice(1));
  const blank = BLANK_LINE.exec(rest);
  const ends = [next ? next.index + 1 : Infinity, blank ? blank.index : Infinity];
  const end = Math.min(...ends);
  if (!Number.isFinite(end)) return { block: rest.trimEnd(), at, complete: false };
  return { block: rest.slice(0, end).trimEnd(), at, complete: true };
}

const upstreamFailed = (why: string, origin: string | null): Response =>
  json(502, JSON.stringify({ error: `NOAA's NBM bucket ${why}` }), origin);

/** All the bucket requests of one answer share this much time, so the
 *  app's own wait (25 s, src/api/nbm.ts) outlasts the relay's worst case:
 *  five HEADs, a window and a whole file could otherwise take
 *  5 + 1 + 1 timeouts. */
export const NBM_BUDGET_MS = 20_000;

/** The newest cycle whose NBH file the bucket has, looking back a few hours
 *  from `now`; null when none of them is there. A HEAD that fails or is
 *  refused moves on to the older file: a late or ailing bucket still has
 *  the hour before. */
async function newestFile(deps: NbmDeps, left: () => number): Promise<{ file: string; cycleMs: number } | null> {
  // From the hour before the one under way: a cycle's hours begin the hour
  // after it, so the newest file, once it lands, covers the next hour on
  // and never the one under way, and the card's first column (the hour
  // under way) would always be blank (seen 2026-10-27 at 02:47Z, the 02Z
  // file in place). The cycle before covers it, at the cost of an hour's
  // freshness on the later columns.
  const hour = Math.floor(deps.now() / 3_600_000) * 3_600_000 - 3_600_000;
  for (let k = 0; k <= NBM_LOOKBACK_HOURS; k++) {
    const cycleMs = hour - k * 3_600_000;
    const file = nbmFileFor(cycleMs);
    const res = await deps.fetch(`${NBM_BUCKET}/${file}`, {
      method: 'HEAD',
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(Math.min(NBM_TIMEOUT_MS, left())),
    });
    if (res.ok) return { file, cycleMs };
  }
  return null;
}

export async function nbmHandle(request: Request, origin: string | null, deps: NbmDeps): Promise<Response> {
  const early = preflightOrMethod(request, origin);
  if (early) return early;

  const now = deps.now();
  const memoAgeS = (now - deps.memo.at) / 1000;
  if (deps.memo.body != null && memoAgeS < NBM_CACHE_SECONDS) {
    return json(200, deps.memo.body, origin, Math.floor(NBM_CACHE_SECONDS - memoAgeS));
  }

  const left = (): number => Math.max(1_000, NBM_BUDGET_MS - (deps.now() - now));
  let found: { file: string; cycleMs: number } | null;
  try {
    found = await newestFile(deps, left);
  } catch (err) {
    return upstreamFailed(`unreachable: ${String(err)}`, origin);
  }
  if (!found) return upstreamFailed(`has no NBH file for the last ${NBM_LOOKBACK_HOURS + 1} hours`, origin);
  const url = `${NBM_BUCKET}/${found.file}`;

  // The window first, the whole file only when the block is not whole in
  // it. A bucket that answers the range with the whole file (200) has
  // already sent it: read that rather than ask again.
  let cut: ReturnType<typeof cutStationBlock> = null;
  let base = 0;
  try {
    const from = Math.max(0, deps.memo.offset - NBM_WINDOW);
    const part = await deps.fetch(url, {
      headers: { 'user-agent': USER_AGENT, range: `bytes=${from}-${deps.memo.offset + NBM_WINDOW}` },
      signal: AbortSignal.timeout(Math.min(NBM_TIMEOUT_MS, left())),
    });
    if (part.status === 206) {
      cut = cutStationBlock(await part.text(), NBM_STATION);
      base = from;
      if (cut && !cut.complete) cut = null;
    } else if (part.status === 200) {
      cut = cutStationBlock(await part.text(), NBM_STATION);
      base = 0;
    }
    if (!cut) {
      const whole = await deps.fetch(url, {
        headers: { 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(Math.min(NBM_TIMEOUT_MS, left())),
      });
      if (!whole.ok) return upstreamFailed(`answered ${whole.status}`, origin);
      cut = cutStationBlock(await whole.text(), NBM_STATION);
      base = 0;
    }
  } catch (err) {
    return upstreamFailed(`unreachable: ${String(err)}`, origin);
  }
  if (!cut) return upstreamFailed(`has no ${NBM_STATION} block in ${found.file}`, origin);

  deps.memo.offset = base + cut.at;
  const body = JSON.stringify({
    station: NBM_STATION,
    product: 'NBH',
    file: found.file,
    cycle: new Date(found.cycleMs).toISOString(),
    text: cut.block,
  });
  deps.memo.body = body;
  deps.memo.at = now;
  return json(200, body, origin, NBM_CACHE_SECONDS);
}

export { NBM_PATH };
