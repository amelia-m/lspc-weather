/**
 * TAF group decoder. Pure: the reference time the day/hour groups are resolved
 * against is passed in.
 *
 * A Terminal Aerodrome Forecast is a run of groups (FMH-1 chapter 12; the
 * reader's guide is AC 00-45H chapter 5). Every period is a change group
 * followed by the elements it states, and the decode is only useful if a
 * reader knows which kind of period each row is:
 *
 *   base / FM   the prevailing forecast from that time on; a FM group states
 *               every element afresh, so nothing carries over from the row
 *               above it
 *   TEMPO       fluctuations lasting under an hour at a time inside the window,
 *               stated elements only; the rest stay as the prevailing row says
 *   BECMG       a gradual change through the window to the stated elements,
 *               which then prevail
 *   PROB30/40   the stated elements have that chance inside the window; NWS
 *               offices write PROB only for the 30 and 40 percent cases
 *
 * The decode records what each group states and leaves the unstated elements
 * null, so the table can print them blank rather than invent a value. The
 * one derived figure, the ceiling, is the lowest broken, overcast or
 * vertical-visibility layer in the stated sky, the same rule the METAR side
 * uses. Time groups are day-of-month and hour, sometimes minutes, with no
 * month; the month and year come from the issuance time, and a day below the
 * issuance day is read as next month (a TAF issued on the 30th that runs to
 * the 1st).
 *
 * Nothing here judges. A flight category per period is the FAA's own
 * classification of a ceiling and visibility and is computed by the card
 * through `flightCategory`, the same function the observation uses.
 */

import { flightCategory, type FlightCategory } from './flightCategory';
import type { SkyCover, SkyLayer } from './types';
import { M_PER_SM, round } from './units';

export type TafChange = 'BASE' | 'FM' | 'TEMPO' | 'BECMG' | 'PROB';

export interface TafWind {
  /** Degrees true. null when the group reads VRB (variable) or is calm. */
  directionDeg: number | null;
  variable: boolean;
  speedKt: number;
  gustKt: number | null;
}

export interface TafPeriod {
  change: TafChange;
  /** 30 or 40 on a PROB group; null otherwise. */
  probability: number | null;
  /** Period bounds, ms since epoch. For a TEMPO or PROB group this is the
   *  window the fluctuation applies in; for BECMG it is the transition window;
   *  for the base and FM groups it runs to the next FM group or the end of the
   *  forecast. null when no issuance time was given to resolve the day. */
  fromMs: number | null;
  toMs: number | null;
  /** null = the group did not state it. */
  wind: TafWind | null;
  /** Statute miles. A `P6SM` group ("more than six") is recorded as 6 with
   *  `visibilityPlus` true, since six is the figure the category bands need
   *  (VFR is above five). null = not stated. */
  visibilitySm: number | null;
  visibilityPlus: boolean;
  /** Present-weather groups joined by a space, e.g. "-SHRA BR". An `NSW`
   *  (no significant weather) is kept as "NSW" so the table can show the
   *  weather ending. null = not stated. */
  wxString: string | null;
  /** null = not stated. An empty array never occurs: SKC is a layer. */
  skyLayers: SkyLayer[] | null;
  /** Lowest BKN/OVC/VV base in the stated sky, ft AGL; null when the sky was
   *  not stated or has no ceiling. `skyLayers` says which. */
  ceilingFtAgl: number | null;
  /** Low-level wind shear group, e.g. "WS020/21040KT", kept as text. */
  windShear: string | null;
  /** The group's own text, for showing beside the decode. */
  raw: string;
}

export interface DecodedTaf {
  station: string;
  /** "AMD" or "COR" when the header carries one. */
  amendment: string | null;
  validFromMs: number | null;
  validToMs: number | null;
  periods: TafPeriod[];
  /** Tokens no rule recognised, so a reader can see what the decode dropped
   *  rather than trust a silent gap. Temperature and altimeter groups land
   *  here too; the card does not use them. */
  undecoded: string[];
}

const WIND = /^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)$/;
const SKY = /^(SKC|CLR|NSC|NCD|FEW|SCT|BKN|OVC|VV)(\d{3}|\/\/\/)?(CB|TCU)?$/;
const WX =
  /^(\+|-|VC)?(MI|PR|BC|DR|BL|SH|TS|FZ)?((?:DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)+)$/;
const WX_DESCRIPTOR_ONLY = /^(\+|-|VC)?(TS|SH|FZ)$/;
const VIS_SM = /^(M|P)?(\d{1,2})(?:\/(\d{1,2}))?SM$/;
const VIS_M = /^(\d{4})$/;
const WIND_SHEAR = /^WS\d{3}\/\d{3}\d{2,3}KT$/;
const CEILING: readonly SkyCover[] = ['BKN', 'OVC', 'VV'];
const KT_PER_MPS = 1.943844;

/** Resolve a TAF day/hour[/minute] against the issuance time. TAF groups name
 *  the day of the month only; a day smaller than the issuance day means the
 *  next month. Hour 24 is midnight ending that day. */
export function resolveTafTime(
  day: number,
  hour: number,
  minute: number,
  refMs: number | null,
): number | null {
  if (refMs == null) return null;
  const ref = new Date(refMs);
  let year = ref.getUTCFullYear();
  let month = ref.getUTCMonth();
  if (day < ref.getUTCDate() - 15) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  // Date.UTC carries hour 24 into the next day on its own.
  return Date.UTC(year, month, day, hour, minute);
}

function windOf(token: string): TafWind | null {
  const m = WIND.exec(token);
  if (!m) return null;
  const toKt = (n: string): number => (m[4] === 'MPS' ? Math.round(Number(n) * KT_PER_MPS) : Number(n));
  const variable = m[1] === 'VRB';
  const speedKt = toKt(m[2]);
  return {
    directionDeg: variable || speedKt === 0 ? null : Number(m[1]),
    variable,
    speedKt,
    gustKt: m[3] != null ? toKt(m[3]) : null,
  };
}

function ceilingOf(layers: SkyLayer[]): number | null {
  return layers
    .filter((l) => CEILING.includes(l.cover) && l.baseFtAgl != null)
    .reduce<number | null>((min, l) => (min == null ? l.baseFtAgl : Math.min(min, l.baseFtAgl!)), null);
}

function emptyPeriod(change: TafChange): TafPeriod {
  return {
    change,
    probability: null,
    fromMs: null,
    toMs: null,
    wind: null,
    visibilitySm: null,
    visibilityPlus: false,
    wxString: null,
    skyLayers: null,
    ceilingFtAgl: null,
    windShear: null,
    raw: '',
  };
}

interface Cursor {
  tokens: string[];
  i: number;
}

/** DDHH/DDHH validity window, as the two resolved instants. */
function windowOf(token: string, refMs: number | null): [number | null, number | null] | null {
  const m = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/.exec(token);
  if (!m) return null;
  return [
    resolveTafTime(Number(m[1]), Number(m[2]), 0, refMs),
    resolveTafTime(Number(m[3]), Number(m[4]), 0, refMs),
  ];
}

/** Read one period's element groups from the cursor until the next change
 *  group or the end. Unrecognised tokens go to `undecoded`. */
function readElements(c: Cursor, p: TafPeriod, undecoded: string[]): void {
  const wx: string[] = [];
  const sky: SkyLayer[] = [];
  while (c.i < c.tokens.length) {
    const t = c.tokens[c.i];
    if (/^FM\d{6}$/.test(t) || t === 'TEMPO' || t === 'BECMG' || /^PROB\d{2}$/.test(t) || t === 'RMK') {
      break;
    }
    c.i += 1;
    const w = windOf(t);
    if (w) {
      p.wind = w;
      continue;
    }
    if (t === 'P6SM') {
      p.visibilitySm = 6;
      p.visibilityPlus = true;
      continue;
    }
    // "1 1/2SM": a whole-mile token followed by the fraction token. The whole
    // number on its own is not a visibility, so it is only consumed when the
    // fraction follows.
    const vis = VIS_SM.exec(t);
    if (vis) {
      const whole = Number(vis[2]);
      const value = vis[3] != null ? whole / Number(vis[3]) : whole;
      p.visibilitySm = round(value, 2);
      p.visibilityPlus = vis[1] === 'P';
      continue;
    }
    if (/^\d$/.test(t) && c.i < c.tokens.length && /^\d\/\dSM$/.test(c.tokens[c.i])) {
      const frac = /^(\d)\/(\d)SM$/.exec(c.tokens[c.i])!;
      c.i += 1;
      p.visibilitySm = round(Number(t) + Number(frac[1]) / Number(frac[2]), 2);
      p.visibilityPlus = false;
      continue;
    }
    // ICAO-format TAFs (military fields issue them) give visibility in metres;
    // 9999 means ten kilometres or more, the same "more than" reading as P6SM.
    const visM = VIS_M.exec(t);
    if (visM) {
      if (t === '9999') {
        p.visibilitySm = 6;
        p.visibilityPlus = true;
      } else {
        p.visibilitySm = round(Number(t) / M_PER_SM, 2);
        p.visibilityPlus = false;
      }
      continue;
    }
    const s = SKY.exec(t);
    if (s) {
      sky.push({
        cover: s[1] as SkyCover,
        baseFtAgl: s[2] != null && s[2] !== '///' ? Number(s[2]) * 100 : null,
      });
      continue;
    }
    if (t === 'NSW' || WX.test(t) || WX_DESCRIPTOR_ONLY.test(t)) {
      wx.push(t);
      continue;
    }
    if (WIND_SHEAR.test(t)) {
      p.windShear = t;
      continue;
    }
    undecoded.push(t);
  }
  if (wx.length > 0) p.wxString = wx.join(' ');
  if (sky.length > 0) {
    p.skyLayers = sky;
    p.ceilingFtAgl = ceilingOf(sky);
  }
}

/**
 * Decode a TAF body (the text `parseTaf` returns: from the station id or a
 * "TAF AMD" prefix through the last group, no communications header) into
 * its periods. Returns null when the header is not a TAF header. A `NIL` or
 * `CNL` forecast decodes to no periods.
 */
export function decodeTaf(raw: string, issuedMs: number | null): DecodedTaf | null {
  const tokens = raw.replace(/=\s*$/, '').trim().split(/\s+/).filter(Boolean);
  const c: Cursor = { tokens, i: 0 };
  if (tokens[c.i] === 'TAF') c.i += 1;
  let amendment: string | null = null;
  if (tokens[c.i] === 'AMD' || tokens[c.i] === 'COR') {
    amendment = tokens[c.i];
    c.i += 1;
  }
  const station = tokens[c.i];
  if (!station || !/^[A-Z]{4}$/.test(station)) return null;
  c.i += 1;
  // Issuance group DDHHMMZ. Optional in the decode: the products feed gives the
  // issuance time separately, and the group only repeats it.
  if (/^\d{6}Z$/.test(tokens[c.i] ?? '')) c.i += 1;
  if (tokens[c.i] === 'AMD' || tokens[c.i] === 'COR') {
    amendment = tokens[c.i];
    c.i += 1;
  }
  const valid = windowOf(tokens[c.i] ?? '', issuedMs);
  if (!valid) {
    if (tokens[c.i] === 'NIL' || tokens[c.i] === 'CNL') {
      return { station, amendment, validFromMs: null, validToMs: null, periods: [], undecoded: [] };
    }
    return null;
  }
  c.i += 1;
  const [validFromMs, validToMs] = valid;

  const periods: TafPeriod[] = [];
  const undecoded: string[] = [];

  const base = emptyPeriod('BASE');
  base.fromMs = validFromMs;
  base.toMs = validToMs;
  let start = c.i;
  readElements(c, base, undecoded);
  base.raw = tokens.slice(start, c.i).join(' ');
  periods.push(base);

  while (c.i < tokens.length) {
    const t = tokens[c.i];
    if (t === 'RMK') break;
    start = c.i;
    c.i += 1;
    const fm = /^FM(\d{2})(\d{2})(\d{2})$/.exec(t);
    if (fm) {
      const p = emptyPeriod('FM');
      p.fromMs = resolveTafTime(Number(fm[1]), Number(fm[2]), Number(fm[3]), issuedMs);
      p.toMs = validToMs;
      // The previous prevailing period ends where this one starts.
      const prev = [...periods].reverse().find((q) => q.change === 'BASE' || q.change === 'FM');
      if (prev) prev.toMs = p.fromMs;
      readElements(c, p, undecoded);
      p.raw = tokens.slice(start, c.i).join(' ');
      periods.push(p);
      continue;
    }
    if (t === 'TEMPO' || t === 'BECMG' || /^PROB\d{2}$/.test(t)) {
      const p = emptyPeriod(t.startsWith('PROB') ? 'PROB' : (t as TafChange));
      if (p.change === 'PROB') {
        p.probability = Number(t.slice(4));
        // "PROB30 TEMPO 2720/2723": the TEMPO after a PROB is part of the
        // same group, not a second period.
        if (tokens[c.i] === 'TEMPO') c.i += 1;
      }
      const w = windowOf(tokens[c.i] ?? '', issuedMs);
      if (w) {
        [p.fromMs, p.toMs] = w;
        c.i += 1;
        // A BECMG ends the prevailing period where its window starts, as a
        // FM group does: from then on the conditions are in transition, and
        // after the window the BECMG's elements prevail (see prevailingFor).
        // aviationweather.gov's decoder draws the same boundary (KOFF,
        // 2026-09-24, five BECMG groups). A TEMPO or PROB ends nothing.
        // Only the first BECMG after a prevailing period ends it; a later
        // one follows a BECMG, whose window is already bounded.
        if (p.change === 'BECMG' && p.fromMs != null) {
          const prev = [...periods].reverse().find((q) => q.change !== 'TEMPO' && q.change !== 'PROB');
          if (prev && (prev.change === 'BASE' || prev.change === 'FM')) prev.toMs = p.fromMs;
        }
      }
      readElements(c, p, undecoded);
      p.raw = tokens.slice(start, c.i).join(' ');
      periods.push(p);
      continue;
    }
    undecoded.push(t);
  }
  return { station, amendment, validFromMs, validToMs, periods, undecoded };
}

/**
 * The conditions prevailing at a row: the last BASE or FM period before it,
 * with every BECMG between the two laid over it, since a BECMG's stated
 * elements prevail once its window has passed. An NSW on a BECMG clears
 * the weather. Returns the period itself when no BECMG intervenes, so a
 * caller can tell an untouched row from a merged one by identity.
 */
export function prevailingFor(periods: TafPeriod[], index: number): TafPeriod | null {
  const becoming: TafPeriod[] = [];
  let base: TafPeriod | null = null;
  for (let i = index; i >= 0; i -= 1) {
    const p = periods[i];
    if (p.change === 'BASE' || p.change === 'FM') {
      base = p;
      break;
    }
    if (p.change === 'BECMG') becoming.unshift(p);
  }
  if (!base || becoming.length === 0) return base;
  const merged: TafPeriod = { ...base };
  for (const b of becoming) {
    if (b.wind) merged.wind = b.wind;
    if (b.visibilitySm != null) {
      merged.visibilitySm = b.visibilitySm;
      merged.visibilityPlus = b.visibilityPlus;
    }
    if (b.wxString != null) merged.wxString = b.wxString === 'NSW' ? null : b.wxString;
    if (b.skyLayers) {
      merged.skyLayers = b.skyLayers;
      merged.ceilingFtAgl = b.ceilingFtAgl;
    }
  }
  return merged;
}

/**
 * The FAA flight category a period's ceiling and visibility fall in, read
 * the way a TAF is read: a change row takes what it states and keeps the
 * prevailing row's figure for what it does not. A row with no usable sky
 * (neither it nor the prevailing row stated one) is treated the way
 * `observedFlightCategory` treats an observation with no sky group: the
 * visibility can still establish MVFR, IFR or LIFR, never VFR.
 */
export function periodFlightCategory(periods: TafPeriod[], index: number): FlightCategory | null {
  const p = periods[index];
  const base = p.change === 'BASE' || p.change === 'FM' ? null : prevailingFor(periods, index - 1);
  const skySource = p.skyLayers != null ? p : base?.skyLayers != null ? base : null;
  const vis = p.visibilitySm ?? base?.visibilitySm ?? null;
  if (skySource) return flightCategory(skySource.ceilingFtAgl, vis);
  const byVisibility = flightCategory(null, vis);
  return byVisibility === 'VFR' ? null : byVisibility;
}

/** Plain words for the present-weather codes NWS offices write in TAFs
 *  (FMH-1 table 12-2; the same table a METAR uses). An unknown code comes
 *  back unchanged so nothing is hidden. */
const WX_WORDS: Record<string, string> = {
  DZ: 'drizzle',
  RA: 'rain',
  SN: 'snow',
  SG: 'snow grains',
  IC: 'ice crystals',
  PL: 'ice pellets',
  GR: 'hail',
  GS: 'small hail',
  UP: 'unknown precipitation',
  BR: 'mist',
  FG: 'fog',
  FU: 'smoke',
  VA: 'volcanic ash',
  DU: 'dust',
  SA: 'sand',
  HZ: 'haze',
  PY: 'spray',
  PO: 'dust whirls',
  SQ: 'squalls',
  FC: 'funnel cloud',
  SS: 'sandstorm',
  DS: 'duststorm',
};
const WX_DESCRIPTOR: Record<string, string> = {
  MI: 'shallow',
  PR: 'partial',
  BC: 'patches of',
  DR: 'drifting',
  BL: 'blowing',
  FZ: 'freezing',
};

export function describeWx(wxString: string): string {
  if (wxString === 'NSW') return 'no significant weather';
  return wxString
    .split(/\s+/)
    .map((code) => {
      const m = WX.exec(code);
      if (!m) {
        const d = WX_DESCRIPTOR_ONLY.exec(code);
        if (!d) return code;
        const word = d[2] === 'TS' ? 'thunderstorm' : d[2] === 'SH' ? 'showers' : 'freezing';
        return [d[1] === '+' ? 'heavy' : d[1] === '-' ? 'light' : d[1] === 'VC' ? 'nearby' : '', word]
          .filter(Boolean)
          .join(' ');
      }
      const intensity = m[1] === '+' ? 'heavy' : m[1] === '-' ? 'light' : m[1] === 'VC' ? 'nearby' : '';
      const phenomena = (m[3].match(/.{2}/g) ?? []).map((ph) => WX_WORDS[ph] ?? ph).join(' and ');
      // The intensity belongs to the precipitation, not the descriptor:
      // +TSRA is a thunderstorm with heavy rain (FMH-1 12.6.8).
      if (m[2] === 'TS') return `thunderstorm with ${[intensity, phenomena].filter(Boolean).join(' ')}`;
      if (m[2] === 'SH') return `${[intensity, phenomena].filter(Boolean).join(' ')} showers`;
      const descriptor = m[2] ? WX_DESCRIPTOR[m[2]] : '';
      return [intensity, descriptor, phenomena].filter(Boolean).join(' ');
    })
    .join(', ');
}
