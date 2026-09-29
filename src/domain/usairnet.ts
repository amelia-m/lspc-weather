/**
 * usairnet's decode of a METAR, read from its station page, and this app's
 * decode put in usairnet's words so the two can be compared field by field.
 *
 * Used only by scripts/usairnetCompare.live.ts, which feeds the #parity page;
 * nothing on the dashboard reads usairnet. It lives here rather than in the
 * script so the page formats it must survive are pinned by tests: the
 * script's first parser missed two of them, and each showed up on #parity
 * as a disagreement that was the parser's, not either decoder's.
 *
 * - A gust sits between the speed and the direction ("Wind Data|18 MPH|
 *   Gust: 24 MPH|160° South"). The first parser expected the direction
 *   straight after the speed, so every gusting report read as having no
 *   direction: 19 of the 24 wind-direction mismatches logged on the same
 *   report to 2026-09-29.
 * - An overcast layer is "Solid Overcast at 11000 ft". The FAA's word for
 *   OVC is plain "Overcast" (AC 00-45H, Table 3-3: 8/8 of the sky, read
 *   2026-09-29), and the dashboard keeps it; only this comparison uses
 *   usairnet's.
 * - Present weather adds a part to the heading ("68°|Partly Cloudy|Light
 *   Rain|as of"). The first parser allowed one part, so the temperature
 *   read as missing whenever it rained or was foggy.
 *
 * The formats below were read from live pages on 2026-09-29: KSWW (gust),
 * KRKS (variable), KAIA (calm), KOMA (overcast), KPMV. Their station blocks
 * are the fixtures under tests/fixtures/usairnet/.
 *
 * Pure: HTML in, fields out.
 */
import type { SkyLayer } from './types';

/** The fields usairnet prints for a station, as the page states them. */
export interface UsairnetObs {
  asOf: string; // "8:15 PM", their local clock
  tempF: number | null;
  condition: string | null;
  humidityPct: number | null;
  dewpointF: number | null;
  visibilityMi: number | null;
  pressureInHg: number | null;
  flightRule: string | null;
  windMph: number | null; // 0 for "Calm"
  windGustMph: number | null;
  /** null for calm, and for a variable wind, which the page prints as a
   *  speed with no direction. */
  windDirDeg: number | null;
  /** The wind line as the page printed it, for the log when a field did
   *  not parse: "18 MPH|Gust: 24 MPH|160° South". */
  windText: string | null;
  clouds: string | null; // "Few at 10000 ft, Broken at 25000 ft" or "Clear"
  /** The page's sun almanac for the station, its local clock: "7:13 AM". */
  sunrise: string | null;
  sunset: string | null;
}

/** Strip the page to text and read the block for `station`. The block is
 *  "Current Conditions at|<NAME> - (KPMV)|66°|Clear|as of 8:15 PM CDST|…"
 *  once tags collapse to bars; the next "Current Conditions at" (another
 *  station on the same page) ends it. */
export function parseUsairnet(html: string, station: string): UsairnetObs | null {
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '|')
    .replace(/&deg;/g, '°')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s*\|\s*(\|\s*)+/g, '|')
    .replace(/[ \t]+/g, ' ');
  const start = text.indexOf(`(${station})`);
  if (start < 0) return null;
  const rest = text.slice(start);
  const end = rest.indexOf('Current Conditions at', 10);
  const block = end > 0 ? rest.slice(0, end) : rest;

  const num = (re: RegExp): number | null => {
    const m = block.match(re);
    return m ? Number(m[1]) : null;
  };
  const str = (re: RegExp): string | null => block.match(re)?.[1]?.trim() ?? null;

  const asOf = str(/as of (\d{1,2}:\d{2} [AP]M)/);
  if (!asOf) return null;
  const head = block.match(/\(\w{4}\)\|(-?\d+)°\|(.*?)\|as of/);
  // Everything from "Wind Data" to the cloud line: "Calm", "5 MPH" (variable),
  // "12 MPH|270° West", or "18 MPH|Gust: 24 MPH|160° South".
  const windText = str(/Wind Data\|(.*?)\|?(?:Cloud Level|$)/);
  const calm = windText != null && /^Calm\b/i.test(windText);
  const wind = windText?.match(/^(\d+) MPH(?:\|Gust: (\d+) MPH)?(?:\|(\d+)°)?/);
  return {
    asOf,
    tempF: head ? Number(head[1]) : null,
    condition: head ? head[2].split('|').map((s) => s.trim()).join(', ') : null,
    humidityPct: num(/Rel\. Humidity: (\d+)%/),
    dewpointF: num(/Dew Point: (-?\d+)°F/),
    visibilityMi: num(/Visibility: ([\d.]+) Mile/),
    pressureInHg: num(/Pressure: ([\d.]+) in/),
    flightRule: str(/Flight Rule: (\w+)/),
    windMph: calm ? 0 : wind ? Number(wind[1]) : null,
    windGustMph: wind?.[2] != null ? Number(wind[2]) : null,
    windDirDeg: wind?.[3] != null ? Number(wind[3]) : null,
    windText,
    clouds: str(/Cloud Level\(s\): ([^|]+)/),
    // "|Sunrise:|7:13 AM": the bar keeps this from matching "Civil Sunrise:".
    sunrise: str(/\|Sunrise:\|(\d{1,2}:\d{2} [AP]M)/),
    sunset: str(/\|Sunset:\|(\d{1,2}:\d{2} [AP]M)/),
  };
}

/** Sky cover in usairnet's words. VV has not been seen on the page; its
 *  word here is a guess, and a VV report will show whether it holds. */
const COVER_WORD: Record<string, string> = {
  FEW: 'Few',
  SCT: 'Scattered',
  BKN: 'Broken',
  OVC: 'Solid Overcast',
  VV: 'Obscured',
  CLR: 'Clear',
  SKC: 'Clear',
  NSC: 'Clear',
  NCD: 'Clear',
};

/** The dashboard's layers in usairnet's words, so the two strings compare. */
export function cloudsInTheirWords(layers: SkyLayer[]): string {
  if (layers.length === 0) return '(not reported)';
  const clouds = layers.filter((l) => l.baseFtAgl != null);
  if (clouds.length === 0) return 'Clear';
  return clouds.map((l) => `${COVER_WORD[l.cover] ?? l.cover} at ${l.baseFtAgl} ft`).join(', ');
}

/** Lowest broken/overcast/obscured base in usairnet's cloud string, as their
 *  page implies a ceiling; they do not print one. */
export function ceilingFromTheirClouds(clouds: string | null): number | null {
  if (!clouds) return null;
  let lowest: number | null = null;
  for (const m of clouds.matchAll(/(Broken|Overcast|Obscured) at (\d+) ft/g)) {
    const ft = Number(m[2]);
    if (lowest == null || ft < lowest) lowest = ft;
  }
  return lowest;
}

/** The dashboard's wind direction as the comparison should read it: none when
 *  calm. NWS's decode gives a calm report 0° (IEM's path gives none), which
 *  the cards never show (they print "Calm" on speed 0) but which read as a
 *  disagreement against usairnet's "Calm" in 4 same-report runs to
 *  2026-09-29. */
export function comparableDirection(speedKt: number | null, directionDeg: number | null): number | null {
  return speedKt === 0 ? null : directionDeg;
}
