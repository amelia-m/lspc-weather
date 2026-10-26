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
 * - Visibility below three miles is a fraction ("1/2 Miles", "1 1/4
 *   Miles", read on KFXY and KPRO's pages 2026-10-03). The parser read only
 *   decimals, so every fractional report (25 same-report runs to 2026-10-02,
 *   all on 2026-09-30's rain and mist) read as no visibility.
 * - A north wind is 360° in the METAR and "0° North" on the page. Compared
 *   as text the two never matched (48 runs to 2026-10-02); as an angle they
 *   are the same direction (sameDirection).
 *
 * The formats below were read from live pages on 2026-09-29: KSWW (gust),
 * KRKS (variable), KAIA (calm), KOMA (overcast), KPMV. Their station blocks
 * are the fixtures under tests/fixtures/usairnet/.
 *
 * usairnet redesigned the page ("Launch Code has a new look", its banner)
 * and the comparison read none of it from 2026-10-09 13:24Z to 2026-10-26,
 * every run "page did not parse" (139 records): the block became
 * "Plattsmouth Muni (KPMV)|54°F|Clear|Observed Oct 26, 04:15 AM CDT|…|Rel.
 * humidity|82%|Dew point|48°F|Visibility|10 mi|Pressure|30.30 inHg|Flight
 * rule|VFR|…|Wind Data|7 mph|10° from|Cloud level(s): Overcast at 8000 ft
 * AGL|…|Raw METAR|KPMV 260915Z …". A gust is "15 mph|40° from|Gust 21",
 * an overcast plain "Overcast", a missing wind group "Not reported", a
 * clear sky "No cloud detected below automated reporting limit", a
 * missing sky group "Not reported", a fraction a decimal ("1.75 mi"), and
 * the clock has a leading zero. It also prints the raw METAR, kept in
 * `rawMetar`. Both layouts are read (`Observed` marks the new one; the
 * old is still served as `view=legacy`), the clouds put in one wording
 * ("Overcast", no "AGL", layers joined by ", ") so the comparison's row
 * reads the same from either. Fixtures of the new layout, cut from live
 * pages on 2026-10-26, are under tests/fixtures/usairnet/modern/.
 *
 * Pure: HTML in, fields out.
 */
import type { SkyLayer } from './types';
import { resolveTafTime } from './taf';

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
  /** A qualifier the redesigned page adds after the rule, "(at least)",
   *  where the METAR has no sky group and the visibility alone sets a
   *  floor (KHEQ, 2026-10-26); null otherwise. Kept apart so the rule
   *  itself still compares with the dashboard's, which withholds VFR on
   *  such a report for the same reason. */
  flightRuleNote: string | null;
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
  /** The METAR as the page prints it, on the redesigned layout only; null
   *  on the legacy layout, which does not show it. */
  rawMetar: string | null;
}

/** The page as text: tags become bars, runs of bars collapse to one. */
function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '|')
    .replace(/&deg;/g, '°')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s*\|\s*(\|\s*)+/g, '|')
    .replace(/[ \t]+/g, ' ');
}

/** Strip the page to text and read the block for `station`. The block is
 *  "Current Conditions at|<NAME> - (KPMV)|66°|Clear|as of 8:15 PM CDST|…"
 *  on the legacy layout, "Current Conditions at|<Name> (KPMV)|66°F|Clear|
 *  Observed Oct 26, 04:15 AM CDT|…" on the redesigned one, once tags
 *  collapse to bars; the next "Current Conditions at" (another station on
 *  the same page) ends it. */
export function parseUsairnet(html: string, station: string): UsairnetObs | null {
  const text = pageText(html);
  const start = text.indexOf(`(${station})`);
  if (start < 0) return null;
  const rest = text.slice(start);
  const end = rest.indexOf('Current Conditions at', 10);
  const block = end > 0 ? rest.slice(0, end) : rest;
  return block.includes('|Observed ') ? parseModernBlock(block) : parseLegacyBlock(block);
}

const num = (block: string, re: RegExp): number | null => {
  const m = block.match(re);
  return m ? Number(m[1]) : null;
};
const str = (block: string, re: RegExp): string | null => block.match(re)?.[1]?.trim() ?? null;

/** The redesigned layout (2026-10-09 on). */
function parseModernBlock(block: string): UsairnetObs | null {
  // "Observed Oct 26, 04:15 AM CDT": the comparison's clock has no leading
  // zero ("4:15 AM"); the page's has. Read apart from the heading, so a
  // report with no temperature group still gives its clock and the rest.
  const obs = block.match(/\|Observed (?:[A-Z][a-z]{2} \d{1,2}, )?(\d{1,2}):(\d{2}) ([AP]M)/);
  if (!obs) return null;
  const asOf = `${Number(obs[1])}:${obs[2]} ${obs[3]}`;
  // "(KPMV)|54°F|Clear|Observed …": the weather, when there is any, follows
  // the sky as more parts ("|Light rain, mist|").
  const head = block.match(/\(\w{4}\)\|(-?\d+)°F\|(.*?)\|Observed /);
  // "7 mph|10° from", "15 mph|40° from|Gust 21", "Calm", or "Not reported"
  // when the METAR has no wind group (KHYS, 2026-10-26). Each part is read
  // on its own, so a gust is found whatever the page puts between the
  // speed and it for a variable wind, a form not yet seen on this layout
  // (the legacy page printed a variable wind as a speed alone).
  const windText = str(block, /Wind Data\|(.*?)\|?(?:Cloud level|$)/);
  const calm = windText != null && /^Calm\b/i.test(windText);
  const speed = windText?.match(/^(\d+) mph/);
  const dir = windText?.match(/\|(\d+)° from/);
  const gust = windText?.match(/\|Gust (\d+)/);
  // "VFR", or "MVFR (at least)" where only the visibility set it.
  const rule = str(block, /Flight rule\|([^|]+)/)?.match(/^(\w+)(?: (.*))?$/);
  return {
    asOf,
    tempF: head ? Number(head[1]) : null,
    condition: head ? head[2].split('|').map((s) => s.trim()).join(', ') : null,
    humidityPct: num(block, /Rel\. humidity\|(\d+)%/),
    dewpointF: num(block, /Dew point\|(-?\d+)°F/),
    visibilityMi: milesFrom(str(block, /Visibility\|([\d./ ]+?) mi\b/)),
    pressureInHg: num(block, /Pressure\|([\d.]+) inHg/),
    flightRule: rule?.[1] ?? null,
    flightRuleNote: rule?.[2] ?? null,
    windMph: calm ? 0 : speed ? Number(speed[1]) : null,
    windGustMph: gust ? Number(gust[1]) : null,
    windDirDeg: dir ? Number(dir[1]) : null,
    windText,
    clouds: cloudsInOneWording(str(block, /Cloud level\(s\): ([^|]+)/)),
    sunrise: str(block, /\|Sunrise\|(\d{1,2}:\d{2} [AP]M)/),
    sunset: str(block, /\|Sunset\|(\d{1,2}:\d{2} [AP]M)/),
    rawMetar: str(block, /Raw METAR\|([^|]+)/),
  };
}

/** The page's cloud line in the wording the comparison uses on both
 *  layouts: the redesign's "Broken at 700 ft AGL; Overcast at 1300 ft AGL"
 *  becomes "Broken at 700 ft, Overcast at 1300 ft", its clear-sky sentence
 *  "Clear", its "Not reported" (a METAR with no sky group) the dashboard's
 *  own "(not reported)"; the legacy "Solid Overcast" becomes "Overcast". */
function cloudsInOneWording(line: string | null): string | null {
  if (line == null) return null;
  if (/^No cloud detected/i.test(line)) return 'Clear';
  if (/^Not reported$/i.test(line)) return '(not reported)';
  return line
    .split(/;\s*|,\s*/)
    .map((l) => l.replace(/ AGL$/, '').replace(/^Solid Overcast/, 'Overcast').trim())
    .filter(Boolean)
    .join(', ');
}

/** The layout the page had to 2026-10-09, still served as `view=legacy`. */
function parseLegacyBlock(block: string): UsairnetObs | null {
  const asOf = str(block, /as of (\d{1,2}:\d{2} [AP]M)/);
  if (!asOf) return null;
  const head = block.match(/\(\w{4}\)\|(-?\d+)°\|(.*?)\|as of/);
  // Everything from "Wind Data" to the cloud line: "Calm", "5 MPH" (variable),
  // "12 MPH|270° West", or "18 MPH|Gust: 24 MPH|160° South".
  const windText = str(block, /Wind Data\|(.*?)\|?(?:Cloud Level|$)/);
  const calm = windText != null && /^Calm\b/i.test(windText);
  const wind = windText?.match(/^(\d+) MPH(?:\|Gust: (\d+) MPH)?(?:\|(\d+)°)?/);
  return {
    asOf,
    tempF: head ? Number(head[1]) : null,
    condition: head ? head[2].split('|').map((s) => s.trim()).join(', ') : null,
    humidityPct: num(block, /Rel\. Humidity: (\d+)%/),
    dewpointF: num(block, /Dew Point: (-?\d+)°F/),
    visibilityMi: milesFrom(str(block, /Visibility: ([\d./ ]+?) Miles?/)),
    pressureInHg: num(block, /Pressure: ([\d.]+) in/),
    flightRule: str(block, /Flight Rule: (\w+)/),
    flightRuleNote: null,
    windMph: calm ? 0 : wind ? Number(wind[1]) : null,
    windGustMph: wind?.[2] != null ? Number(wind[2]) : null,
    windDirDeg: wind?.[3] != null ? Number(wind[3]) : null,
    windText,
    clouds: cloudsInOneWording(str(block, /Cloud Level\(s\): ([^|]+)/)),
    // "|Sunrise:|7:13 AM": the bar keeps this from matching "Civil Sunrise:".
    sunrise: str(block, /\|Sunrise:\|(\d{1,2}:\d{2} [AP]M)/),
    sunset: str(block, /\|Sunset:\|(\d{1,2}:\d{2} [AP]M)/),
    rawMetar: null,
  };
}

/** When the METAR usairnet's page prints was taken, from its own time
 *  group ("KPMV 260935Z …"), dated to the month of `nearMs` (the
 *  dashboard's report; a day at a month's end rolls as `resolveTafTime`
 *  does). The page's clock is a wall time with no date, so two reports a
 *  day apart read alike by it; the time group settles which report the
 *  page decoded. null when the text has no time group, or on the legacy
 *  layout, which prints no METAR. */
export function metarObservedMs(raw: string | null, nearMs: number): number | null {
  const m = raw?.match(/^\w{4} (\d{2})(\d{2})(\d{2})Z/);
  return m ? resolveTafTime(Number(m[1]), Number(m[2]), Number(m[3]), nearMs) : null;
}

/** "10", "2.5", "1/2" or "1 1/4" as miles; null for anything else. */
export function milesFrom(text: string | null): number | null {
  const m = text?.trim().match(/^(?:(\d+(?:\.\d+)?)|(?:(\d+) )?(\d+)\/(\d+))$/);
  if (!m) return null;
  if (m[1] != null) return Number(m[1]);
  return Number(m[2] ?? 0) + Number(m[3]) / Number(m[4]);
}

/** Whether two wind directions are the same direction: 360 and 0 are both
 *  north. Both missing (calm or variable on both sides) also agrees. */
export function sameDirection(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return a == null && b == null;
  return ((((a - b) % 360) + 360) % 360) === 0;
}

/** The station's block as the page's text, for the log when it will not
 *  parse: on 2026-09-30 the page failed to parse for 2 h 18 min and nothing
 *  recorded what it showed. The first `max` characters after the station's
 *  id, or the start of the page's text when the id is not on it. */
export function pageTextNear(html: string, station: string, max = 300): string {
  const text = pageText(html).replace(/\s+/g, ' ');
  const at = text.indexOf(`(${station})`);
  return text.slice(Math.max(0, at), Math.max(0, at) + max).trim();
}

/** Sky cover in the comparison's wording: usairnet's words on its
 *  redesigned page (its legacy "Solid Overcast" is read as "Overcast",
 *  `cloudsInOneWording`). VV has not been seen on the page; its word here
 *  is a guess, and a VV report will show whether it holds. */
const COVER_WORD: Record<string, string> = {
  FEW: 'Few',
  SCT: 'Scattered',
  BKN: 'Broken',
  OVC: 'Overcast',
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
