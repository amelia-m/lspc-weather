import type { Citation, JumperClass } from '../domain/types';

/**
 * Advisory thresholds and their citations.
 *
 * DESIGN RULE: this dashboard does NOT make go/no-go decisions. Every value
 * here exists only to FLAG a condition worth noting and to point the jumper at
 * the authoritative source so THEY (or the S&TA / instructor / PIC) decide.
 *
 * CITATION ACCURACY: the numbers below reflect well-established USPA and FAA
 * guidance corroborated from multiple sources. They could NOT be fetched live
 * from this build environment (its egress proxy blocks uspa.org / ecfr.gov /
 * law.cornell.edu — an org policy, not an API limit). Re-verify each value
 * against the linked primary source before relying on it operationally; the
 * `note` field on flagged citations carries that caveat into the UI.
 */

const VERIFY_NOTE =
  'AI-derived citation — may be inaccurate. Verify against the linked primary source and a licensed professional before use.';

export const CITATIONS = {
  uspaStudentWinds: {
    source: 'USPA SIM, Section 2-1',
    ref: 'Basic Safety Requirements — winds',
    url: 'https://www.uspa.org/sim',
    note: VERIFY_NOTE,
  },
  far10517: {
    source: '14 CFR § 105.17',
    ref: 'Flight visibility & clearance from cloud (parachute ops)',
    url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-105/subpart-B/section-105.17',
    note: VERIFY_NOTE,
  },
  far91155: {
    source: '14 CFR § 91.155',
    ref: 'Basic VFR weather minimums',
    url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91/subpart-B/section-91.155',
    note: VERIFY_NOTE,
  },
  faaDensityAltitude: {
    source: 'FAA-P-8740-2',
    ref: 'Density Altitude (FAA Safety pamphlet)',
    url: 'https://www.faasafety.gov/files/gslac/library/documents/2011/Aug/56396/FAA%20P-8740-02%20DensityAltitude%5Bhi-res%5D%20branded.pdf',
    note: VERIFY_NOTE,
  },
  uspaWeather: {
    source: 'USPA SIM, Section 5-1',
    ref: 'Weather (clouds, winds, spotting)',
    url: 'https://www.uspa.org/sim',
    note: VERIFY_NOTE,
  },
} satisfies Record<string, Citation>;

export interface Thresholds {
  /** Surface wind, knots. */
  windWatchKt: number;
  windCautionKt: number;
  /** Gust spread (gust − sustained), knots. */
  gustSpreadWatchKt: number;
  /** Ceiling / cloud base AGL, ft. */
  ceilingWatchFt: number;
  ceilingCautionFt: number;
  /** Visibility, statute miles (105.17 floor below 10k MSL is 3 SM). */
  visibilityCautionSm: number;
  /** Precip probability, percent. */
  precipWatchPct: number;
  precipCautionPct: number;
  /** Density altitude above field elevation, ft (C-182 climb concern). */
  densityAltExcessWatchFt: number;
  densityAltExcessCautionFt: number;
  /** Minutes before sunset to start flagging "last load" pressure. */
  lastLoadWatchMin: number;
}

/**
 * Student limit (14 mph ≈ 12 kt) is USPA's recommended ceiling for solo
 * students on ram-air reserves (SIM 2-1). Licensed jumpers have no USPA hard
 * wind limit, so the licensed profile flags more conservatively only as info.
 */
const STUDENT_WIND_KT = 12; // 14 mph rounded to whole knots
const LICENSED_WIND_WATCH_KT = 17;
const LICENSED_WIND_CAUTION_KT = 25;

export const DEFAULT_THRESHOLDS: Record<JumperClass, Thresholds> = {
  student: {
    windWatchKt: STUDENT_WIND_KT - 2,
    windCautionKt: STUDENT_WIND_KT,
    gustSpreadWatchKt: 8,
    ceilingWatchFt: 5000,
    ceilingCautionFt: 3000,
    visibilityCautionSm: 3,
    precipWatchPct: 25,
    precipCautionPct: 50,
    densityAltExcessWatchFt: 2000,
    densityAltExcessCautionFt: 3500,
    lastLoadWatchMin: 45,
  },
  licensed: {
    windWatchKt: LICENSED_WIND_WATCH_KT,
    windCautionKt: LICENSED_WIND_CAUTION_KT,
    gustSpreadWatchKt: 10,
    ceilingWatchFt: 4000,
    ceilingCautionFt: 2500,
    visibilityCautionSm: 3,
    precipWatchPct: 30,
    precipCautionPct: 60,
    densityAltExcessWatchFt: 2500,
    densityAltExcessCautionFt: 4000,
    lastLoadWatchMin: 30,
  },
};
