/**
 * The TAF half of the daily sky-parity check, pure so a test can pin it:
 * one decoded period of the app's (`decodeTaf`) set against the `fcsts`
 * entry aviationweather.gov serves beside the same text, as lines naming
 * each difference. scripts/skyParity.live.ts fetches both and fails the
 * run on any line; the rules for what counts as a difference live here.
 */
import type { TafPeriod } from './taf';
import type { SkyLayer } from './types';
import { NO_CLOUD_COVERS } from './normalize';

const NO_CLOUD = new Set<string>(NO_CLOUD_COVERS);
export const cloudsOnly = (layers: SkyLayer[]): SkyLayer[] => layers.filter((l) => !NO_CLOUD.has(l.cover));

/** The parts of aviationweather.gov's TAF JSON the comparison reads. Field
 *  names as the API served them on 2026-09-24; `visib` is a number or the
 *  string "6+", `wdir` a number or "VRB". */
export interface AwcFcst {
  timeFrom?: number;
  timeTo?: number;
  timeBec?: number | null;
  fcstChange?: string | null;
  probability?: number | null;
  wdir?: number | string | null;
  wspd?: number | null;
  wgst?: number | null;
  visib?: number | string | null;
  wxString?: string | null;
  clouds?: Array<{ cover?: string; base?: number | null; type?: string | null }>;
  /** The period's QNH, hPa, rounded to whole (1020 for QNH3012INS,
   *  2026-10-21). */
  altim?: number | null;
  /** TX/TN groups, on the period they are written in. */
  temp?: Array<{ validTime?: number; surfaceTemp?: number; maxOrMin?: string }>;
}
/** aviationweather sends an empty string, not null, for an element a
 *  change group does not state (a TEMPO's visib on 2026-09-24 read ""), so
 *  "present" has to exclude both. */
export const present = <T,>(v: T | null | undefined | ''): v is T => v != null && v !== '';
const normNoWx = (wx: string | null): string | null => (wx === 'NSW' ? null : wx);

/** Differences between one decoded period and aviationweather's, as lines;
 *  empty when they agree. */
export function comparePeriod(p: TafPeriod, f: AwcFcst): string[] {
  const out: string[] = [];
  const theirChange = f.fcstChange ?? (f.probability != null ? 'PROB' : 'BASE');
  if (p.change !== theirChange && !(p.change === 'PROB' && f.probability != null)) {
    out.push(`change ${p.change} vs ${theirChange}`);
  }
  if (p.fromMs != null && f.timeFrom != null && p.fromMs / 1000 !== f.timeFrom) {
    out.push(`from ${new Date(p.fromMs).toISOString()} vs ${new Date(f.timeFrom * 1000).toISOString()}`);
  }
  // A BECMG's window end is their timeBec; its timeTo runs on to the next
  // change, which the app does not model.
  const theirTo = p.change === 'BECMG' ? (f.timeBec ?? f.timeTo) : f.timeTo;
  if (p.toMs != null && theirTo != null && p.toMs / 1000 !== theirTo) {
    out.push(`to ${new Date(p.toMs).toISOString()} vs ${new Date(theirTo * 1000).toISOString()}`);
  }
  const theirSpd = present(f.wspd) ? f.wspd : null;
  const theirGst = present(f.wgst) ? f.wgst : null;
  const theirDir = present(f.wdir) ? f.wdir : null;
  if (p.wind) {
    if (p.wind.speedKt !== theirSpd) out.push(`wind speed ${p.wind.speedKt} vs ${f.wspd}`);
    if ((p.wind.gustKt ?? null) !== theirGst) out.push(`gust ${p.wind.gustKt} vs ${f.wgst}`);
    const ourDir = p.wind.variable ? 'VRB' : p.wind.speedKt === 0 ? 0 : p.wind.directionDeg;
    if (ourDir !== theirDir) out.push(`wind dir ${ourDir} vs ${f.wdir}`);
  } else if (theirSpd != null) {
    out.push(`wind not stated by app, theirs ${f.wdir}/${f.wspd}`);
  }
  const theirVisRaw = present(f.visib) ? f.visib : null;
  if (p.visibilitySm != null) {
    const ourVis = p.visibilityPlus ? '6+' : p.visibilitySm;
    const theirVis =
      typeof theirVisRaw === 'string' && /^\d+(\.\d+)?$/.test(theirVisRaw) ? Number(theirVisRaw) : theirVisRaw;
    const same =
      typeof ourVis === 'number' && typeof theirVis === 'number'
        ? Math.abs(ourVis - theirVis) < 0.01
        : ourVis === theirVis;
    if (!same) out.push(`visibility ${ourVis} vs ${f.visib}`);
  } else if (theirVisRaw != null) {
    out.push(`visibility not stated by app, theirs ${f.visib}`);
  }
  const ourWx = normNoWx(p.wxString ?? null);
  const theirWx = normNoWx(f.wxString?.replace(/\s+/g, ' ').trim() || null);
  if (ourWx !== theirWx) out.push(`weather ${ourWx} vs ${theirWx}`);
  const ourClouds = cloudsOnly(p.skyLayers ?? []).map((l) => `${l.cover}${l.baseFtAgl ?? ''}`);
  const theirClouds = (f.clouds ?? [])
    .filter((c) => c.cover && !NO_CLOUD.has(c.cover))
    .map((c) => `${c.cover}${c.base ?? ''}`);
  if (ourClouds.join(' ') !== theirClouds.join(' ')) {
    out.push(`clouds ${ourClouds.join(' ') || '(none)'} vs ${theirClouds.join(' ') || '(none)'}`);
  }
  // QNH: theirs is whole hPa, so ours converted must be within one of it.
  // Not "must round to it": on 2026-11-03 aviationweather gave 1007 hPa for
  // QNH2972INS at KOFF and KBLV, where 29.72 × 33.8639 is 1006.43, while
  // 68 of 70 QNH groups in twenty USAF TAFs read that day matched the
  // rounded conversion and no single factor fits all 70 (docs/
  // open-questions.md, "Done: the sky-parity run of 2026-11-03"). A
  // hectopascal is about three hundredths of an inch, so the check
  // catches a misread figure (29.27 for 29.72 is 15 hPa) but not every
  // off-by-one-hundredth, with either rule: 30.17 and 30.18 both round to
  // 1022.
  const theirQnh = present(f.altim) ? f.altim : null;
  if (p.qnhInHg != null || theirQnh != null) {
    const oursHpa = p.qnhInHg != null ? p.qnhInHg * HPA_PER_INHG : null;
    if (oursHpa == null || theirQnh == null || Math.abs(oursHpa - theirQnh) >= 1) {
      out.push(`QNH ${p.qnhInHg ?? '(none)'} inHg vs ${theirQnh ?? '(none)'} hPa`);
    }
  }
  return out;
}

export const HPA_PER_INHG = 33.8639;
