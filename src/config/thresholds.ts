import type { Citation, JumperClass } from '../domain/types';
import { mphToKt } from '../domain/units';

/**
 * Advisory thresholds and their citations.
 *
 * DESIGN RULE: this dashboard does NOT make go/no-go decisions. Every value
 * here exists only to FLAG a condition worth noting and to point the jumper at
 * the authoritative source so THEY (or the S&TA / instructor / PIC) decide.
 */

const VERIFY_NOTE =
  'AI-derived citation — may be inaccurate. Verify against the linked primary source and a licensed professional before use.';

export const CITATIONS = {
  uspaStudentWinds: {
    source: 'USPA SIM, Section 2-1',
    ref: 'Basic Safety Requirements — winds',
    url: 'https://www.uspa.org/sim/2-1',
    note: VERIFY_NOTE,
  },
  uspaNightBLicense: {
    source: 'USPA SIM, Section 2-1 (BSRs)',
    ref: 'Night jumps require a USPA B license (min 50 jumps)',
    url: 'https://www.uspa.org/sim/2-1',
    note: VERIFY_NOTE,
  },
  far10517: {
    source: '14 CFR § 105.17',
    ref: 'Flight visibility & clearance from cloud (parachute ops)',
    url: 'https://www.law.cornell.edu/cfr/text/14/105.17',
    note: VERIFY_NOTE,
  },
  far10519: {
    source: '14 CFR § 105.19',
    ref: 'Parachute ops between sunset and sunrise (light visible ≥ 3 SM)',
    url: 'https://www.law.cornell.edu/cfr/text/14/105.19',
    note: VERIFY_NOTE,
  },
  far91155: {
    source: '14 CFR § 91.155',
    ref: 'Basic VFR weather minimums',
    url: 'https://www.law.cornell.edu/cfr/text/14/91.155',
    note: VERIFY_NOTE,
  },
  faaDensityAltitude: {
    source: 'FAA-P-8740-2',
    ref: 'Density Altitude (FAA Safety pamphlet)',
    url: 'https://www.faasafety.gov/files/gslac/library/documents/2011/Aug/56396/FAA%20P-8740-02%20DensityAltitude%5Bhi-res%5D%20branded.pdf',
    note: VERIFY_NOTE,
  },
  uspaWeather: {
    source: 'USPA SIM, Section 4-5',
    ref: 'Weather (surface & upper winds, clouds)',
    url: 'https://www.uspa.org/sim/4-5',
    note: VERIFY_NOTE,
  },
  lspcWaiver: {
    source: 'LSPC Waivered Wind Limits',
    ref: 'Club wind-limit policy (posted at the DZ)',
    url: 'https://github.com/amelia-m/lspc-weather/blob/main/docs/lspc-waivered-wind-limits.md',
    note: 'Transcribed from the LSPC posted policy photo — verify against the current posted sign.',
  },
} satisfies Record<string, Citation>;

export interface Thresholds {
  /** Surface wind, knots. */
  windWatchKt: number;
  windCautionKt: number;
  /** Gust spread (gust − sustained), knots — turbulence flag. */
  gustSpreadWatchKt: number;
  /** Absolute gust ceiling, knots (LSPC waiver). undefined = no absolute rule. */
  gustCautionKt?: number;
  /** Guidance + citation for the surface-wind flag (varies by profile). */
  windGuidance: string;
  windCitation: Citation;
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

const STUDENT_WIND_KT = 12; // USPA ~14 mph rounded to whole knots
const LICENSED_WIND_WATCH_KT = 17;
const LICENSED_WIND_CAUTION_KT = 25;

const STUDENT: Thresholds = {
  windWatchKt: STUDENT_WIND_KT - 2,
  windCautionKt: STUDENT_WIND_KT,
  gustSpreadWatchKt: 8,
  windGuidance:
    'USPA recommends max ~14 mph (~12 kt) ground winds for solo students on ram-air reserves.',
  windCitation: CITATIONS.uspaStudentWinds,
  ceilingWatchFt: 5000,
  ceilingCautionFt: 3000,
  visibilityCautionSm: 3,
  precipWatchPct: 25,
  precipCautionPct: 50,
  densityAltExcessWatchFt: 2000,
  densityAltExcessCautionFt: 3500,
  lastLoadWatchMin: 45,
};

const LICENSED: Thresholds = {
  windWatchKt: LICENSED_WIND_WATCH_KT,
  windCautionKt: LICENSED_WIND_CAUTION_KT,
  gustSpreadWatchKt: 10,
  windGuidance:
    'No USPA hard wind limit for licensed jumpers — included for awareness; consider canopy size and currency. Note: most jump pilots will not take off in winds above ~30–35 mph.',
  windCitation: CITATIONS.uspaStudentWinds,
  ceilingWatchFt: 4000,
  ceilingCautionFt: 2500,
  visibilityCautionSm: 3,
  precipWatchPct: 30,
  precipCautionPct: 60,
  densityAltExcessWatchFt: 2500,
  densityAltExcessCautionFt: 4000,
  lastLoadWatchMin: 30,
};

/** Kept for tests / back-compat. */
export const DEFAULT_THRESHOLDS: Record<JumperClass, Thresholds> = {
  student: STUDENT,
  licensed: LICENSED,
};

/* ---- LSPC waivered wind limits (posted policy; all values in mph) ---- */

export type WaiverTierId = 'waiver:0-5' | 'waiver:6-10' | 'waiver:10-20' | 'waiver:21+';
export type WindProfileId = 'student' | 'licensed' | WaiverTierId;

export interface WaiverTier {
  id: WaiverTierId;
  label: string;
  windMph: number;
  gustMph: number;
}

export const WAIVER_TIERS: WaiverTier[] = [
  { id: 'waiver:0-5', label: '0–5 jumps', windMph: 15, gustMph: 16 },
  { id: 'waiver:6-10', label: '6–10 jumps', windMph: 16, gustMph: 18 },
  { id: 'waiver:10-20', label: '10–20 jumps', windMph: 18, gustMph: 19 },
  { id: 'waiver:21+', label: '21+ jumps', windMph: 18, gustMph: 20 },
];

function waiverThresholds(tier: WaiverTier): Thresholds {
  return {
    ...STUDENT,
    windCautionKt: mphToKt(tier.windMph),
    windWatchKt: mphToKt(Math.max(0, tier.windMph - 3)),
    gustCautionKt: mphToKt(tier.gustMph),
    windGuidance:
      `LSPC waivered limit (students, ${tier.label}): max wind ${tier.windMph} mph, gusts under ${tier.gustMph} mph. ` +
      'Any excursion above the USPA BSR requires on-site approval by a USPA instructor; consult the S&TA.',
    windCitation: CITATIONS.lspcWaiver,
  };
}

export function resolveThresholds(id: WindProfileId): Thresholds {
  if (id === 'student') return STUDENT;
  if (id === 'licensed') return LICENSED;
  const tier = WAIVER_TIERS.find((t) => t.id === id);
  return tier ? waiverThresholds(tier) : STUDENT;
}

/** Human label for a profile id, used in the UI. */
export function profileLabel(id: WindProfileId): string {
  if (id === 'student') return 'Student';
  if (id === 'licensed') return 'Licensed';
  const tier = WAIVER_TIERS.find((t) => t.id === id);
  return tier ? `LSPC waiver · ${tier.label}` : 'Student';
}
