/**
 * When each source section the dashboard cites or quotes was last read,
 * where, in which edition, and how. One entry per section: a part a
 * citation's link lands on (several citations can share one: 2-1 H backs both
 * wind-limit claims), or a SIM part the #citations page quotes beside it.
 *
 * This is the record the citation notes take their dates from (SIM_READ_NOTE
 * in thresholds.ts), and the list at the end of the #citations page. A test
 * holds every citation to an entry here, and every citation note to its
 * entry's date, so the two cannot drift. Reading a section is not an
 * instructor's sign-off: each entry says what was read, not that a rule was
 * approved.
 *
 * The SIM is pinned two ways. `edition` is what uspa.org calls its online
 * SIM on the day ("2026 SIM"); USPA revises it within an edition through
 * change documents, and the page's list of them did not load on 2026-10-08
 * ("Downloads is currently unavailable", in a browser too on 2026-10-09).
 * When it did, seen in a browser on 2026-10-10, it held only an Archive
 * folder: 2021-2022 SIM Rev1 to Rev4 and 2023-2024 SIM Rev1 to Rev3, none
 * for the 2026 SIM. So the edition name alone does not say which text was
 * read. `simPart` does: a SHA-256 of the part's text as
 * simPartText reduces it, taken from the page served that day, for every SIM
 * part a claim cites or quotes. scripts/simText.live.ts takes it again daily
 * and fails when a part's text has changed, which is the signal to read it
 * again, or when a SIM quote on #citations is in none of the parts tied to
 * its entry (by a source's link, or `quotedIn`).
 */
import type { CITATIONS } from './thresholds';

/** The edition year uspa.org's SIM page names in its heading ("2026
 *  Skydiver's Information Manual", read 2026-10-08 and 2026-10-09). The daily SIM check
 *  (scripts/simText.live.ts) fails when the heading names another year. */
export const SIM_EDITION_YEAR = 2026;

/** What uspa.org calls the online SIM. */
export const SIM_EDITION = `${SIM_EDITION_YEAR} SIM`;

/** The day every SIM part below was last read in full and every quote of
 *  it on the #citations page checked against it. */
export const SIM_LAST_READ = '2026-10-08';

export type CitationKey = keyof typeof CITATIONS;

/** Where a SIM part's text is on the section page (from `anchor` to
 *  `until`, or to the end of the page's content module when null), and its fingerprint on
 *  the day it was read: SHA-256 of simPartText, and its length in
 *  characters. */
export interface SimPart {
  section: string;
  anchor: string;
  until: string | null;
  sha256: string;
  chars: number;
}

interface Reading {
  /** e.g. "USPA SIM 2-1 H, Winds". */
  section: string;
  /** YYYY-MM-DD; null where nobody has read the source itself, only a copy
   *  of it (the club's sign, PD's chart). */
  lastRead: string | null;
  /** The edition or revision as the publisher states it. */
  edition: string;
  /** How it was read: from where, in what form. */
  how: string;
}

/** A section one or more citations link to. The page links the first
 *  citation's URL, so the address is written once, in thresholds.ts. */
export interface CitedReading extends Reading {
  kind: 'cited';
  citations: [CitationKey, ...CitationKey[]];
  /** Checklist entries that quote this part without citing it. */
  quotedIn?: [string, ...string[]];
  simPart?: SimPart;
}

/** A SIM part no citation links to, quoted on #citations by the checklist
 *  entries named; the page links its own anchor. */
export interface QuotedReading extends Reading {
  kind: 'quoted';
  quotedIn: [string, ...string[]];
  simPart: SimPart;
}

export type SourceReading = CitedReading | QuotedReading;

/** The citations whose link lands on a reading; none for a part only
 *  quoted. */
export const citationsOf = (r: SourceReading): readonly CitationKey[] => (r.kind === 'cited' ? r.citations : []);

const SIM_HOW =
  'the online SIM at uspa.org, the section page as served; every quote of it on this page checked against that text';

/** One SIM part. Named fields, so an anchor and its end cannot trade
 *  places unnoticed; `title` is the part's letter and heading as the page
 *  prints them (3-1's parts are named, not lettered). */
const sim = (
  p: SimPart & { title: string } & (
      | Pick<CitedReading, 'citations' | 'quotedIn'>
      | { citations?: undefined; quotedIn: [string, ...string[]] }
    ),
): SourceReading => {
  const common = {
    section: `USPA SIM ${p.section}${/^[A-Z],/.test(p.title) ? ' ' : ', '}${p.title}`,
    lastRead: SIM_LAST_READ,
    edition: SIM_EDITION,
    how: SIM_HOW,
    simPart: { section: p.section, anchor: p.anchor, until: p.until, sha256: p.sha256, chars: p.chars },
  };
  if (p.citations) return { ...common, kind: 'cited', citations: p.citations, ...(p.quotedIn ? { quotedIn: p.quotedIn } : {}) };
  return { ...common, kind: 'quoted', quotedIn: p.quotedIn };
};

export const READING_LOG: SourceReading[] = [
  // The parts a citation links to.
  sim({
    section: '2-1',
    anchor: '1H',
    until: '1I',
    title: 'H, Winds',
    citations: ['uspaStudentWinds', 'uspaLicensedWinds'],
    sha256: '08145bc3ac97f635b5c1d109592c2b2e854a6cea6a40321f8f0ae84723634b1c',
    chars: 146,
  }),
  sim({
    section: '2-1',
    anchor: '1I',
    until: '1J',
    title: 'I, Minimum Opening Altitudes',
    citations: ['uspaOpeningAltitude'],
    sha256: 'd3d1c75934696b5f27d3d158ddf281545d8b66a0a6c7fdf220f93430a04cbd23',
    chars: 316,
  }),
  sim({
    section: '2-2',
    anchor: '2B',
    until: '2C',
    title: 'B, Classification of Waivers',
    citations: ['uspaWaivers'],
    sha256: 'f4cf2ddf17418d8c3729625ef8f837ad55c5aab18ae08ac7628dd760b60e1121',
    chars: 511,
  }),
  sim({
    section: '4-5',
    anchor: '5B',
    until: '5C',
    title: 'B, Hazardous Weather',
    citations: ['uspaWeather'],
    sha256: 'c3c535629eecc959f4b543473138ef8cf2625259bcf62b5219e1db99fb1ca4e4',
    chars: 2071,
  }),
  sim({
    section: '4-7',
    anchor: '7A',
    until: '7B',
    title: 'A, Why Spotting is Important',
    citations: ['uspaSpottingWho'],
    sha256: 'c45f6d141108b2c16d57aa463ea3c2bb10bd1b8ab0b3c91c495afa0021d573f4',
    chars: 578,
  }),
  sim({
    section: '4-7',
    anchor: '7C',
    until: '7D',
    title: 'C, Exit Separation on Jump Run',
    citations: ['uspaSpotting'],
    sha256: '4f208b027cc5f5b58ddf0e3947d5ba031f599649136f86e821391884b2a55daf',
    chars: 1171,
  }),
  sim({
    section: '5-3',
    anchor: '3A',
    until: '3B',
    title: 'A, Introduction and Definition',
    citations: ['uspaNightJumps'],
    sha256: '96ddb07f6f0c18a7314913c1cf54d8184712c5643e5faee9bb1a4ebb7be0c3a1',
    chars: 929,
  }),
  // The parts #citations quotes beside them. 2-1 G holds anchors of its own
  // (1G4, 1G4b, 1G5) and 4-7 B one named SPACE; each part runs to the next
  // lettered part, which is why the end is named.
  sim({
    section: '2-1',
    anchor: '1G',
    until: '1H',
    title: 'G, Student Skydivers',
    quotedIn: ['A3'],
    sha256: '81aa9ed6c8b29835cfaec2cd16d91bcb02069e78c72ea9dedb666793cd2bbb5d',
    chars: 8824,
  }),
  sim({
    section: '2-2',
    anchor: '2C',
    until: '2D',
    title: 'C, Procedures for Filing Waivers',
    quotedIn: ['A1', 'A2', 'A5'],
    sha256: '3be7b76ead1c9d2e901641ce1c2042e8e7ad6f909178f7eae2ba16cd39b4dd76',
    chars: 1764,
  }),
  sim({
    section: '3-1',
    anchor: 'Blicense',
    until: 'Clicense',
    title: 'B License',
    quotedIn: ['A3'],
    sha256: 'cac041ce461e1482214a25c0710d0efb8deec65c60044e67dcf3baef4c41bec7',
    chars: 971,
  }),
  sim({
    section: '4-5',
    anchor: '5A',
    until: '5B',
    title: 'A, Determining Winds',
    quotedIn: ['A6'],
    sha256: 'b393b3b3dc8b0b82c530af91334255eb8a1eb8a858ff32edec0bb07acc440e01',
    chars: 501,
  }),
  sim({
    section: '4-5',
    anchor: '5C',
    until: null,
    title: 'C, Density Altitude',
    quotedIn: ['A6'],
    sha256: 'b6365d9584d668faf1d108a4a5726a9e5d4ac2aa734564e14841225eda661aaf',
    chars: 1063,
  }),
  sim({
    section: '4-7',
    anchor: '7B',
    until: '7C',
    title: 'B, Priorities',
    quotedIn: ['A11'],
    sha256: '694f57cbd7432dd9f389716c6674f6545ae4a7bb788c3efaeea6f085db996e26',
    chars: 1976,
  }),
  sim({
    section: '5-3',
    anchor: '3B',
    until: '3C',
    title: 'B, Qualifications',
    quotedIn: ['A3'],
    sha256: '289f93bddc21a29949cf5a0ff635ee095630ec0a549b8b00c52f765e7dc19d45',
    chars: 452,
  }),
  sim({
    section: '5-3',
    anchor: '3E',
    until: '3F',
    title: 'E, Procedures',
    quotedIn: ['A11'],
    sha256: '6650b8ee1f7d9db1d023a771b7db1a7d6ce0d2ae16c59285b34dd273836947f3',
    chars: 2356,
  }),
  // Everything else.
  {
    kind: 'cited',
    section: '14 CFR 105.17, Flight visibility and clearance from cloud requirements',
    citations: ['far10517'],
    lastRead: '2026-09-23',
    edition: 'Title 14 as current on 2026-09-21',
    how: 'the eCFR API (api/versioner/v1/full/2026-09-21/title-14.xml); the linked page answers a script with a bot check',
  },
  {
    kind: 'cited',
    section: '14 CFR 105.19, Parachute operations between sunset and sunrise',
    citations: ['far10519'],
    lastRead: '2026-09-23',
    edition: 'Title 14 as current on 2026-09-21',
    how: 'the eCFR API, as for 105.17',
  },
  {
    kind: 'cited',
    section: 'FAA AIM 7-1-7, Categorical Outlooks',
    citations: ['aimFlightCategory'],
    lastRead: '2026-09-23',
    edition: 'Change 3, effective 2026-07-09',
    how: 'the HTML AIM on faa.gov',
  },
  {
    kind: 'cited',
    section: 'FAA-P-8740-2, Density Altitude',
    citations: ['faaDensityAltitude'],
    lastRead: '2026-09-23',
    edition: 'AFS-8, 2008',
    how: 'the linked PDF (8 pages)',
  },
  {
    kind: 'cited',
    section: 'NWS Density Altitude, Station Pressure and Pressure Altitude calculators (WFO El Paso wxcalc)',
    citations: ['nwsDensityAltitude'],
    lastRead: '2026-10-09',
    edition: 'the pages as served, their metadata dated January 2025 (Density Altitude) and August 2023 (Station Pressure, Pressure Altitude)',
    how: 'each page’s script (virtualTemperature, vaporPressure and densityAltitude; the station-pressure line of decideConvert; altpress) and the formula sheet each links (densityAltitude.pdf, stationPressure.pdf, pressureAltitude.pdf)',
  },
  {
    kind: 'cited',
    section: 'Performance Designs, Navigator Wing Loading Chart',
    citations: ['pdNavigator'],
    lastRead: null,
    edition: 'TABLE-0122 Rev.A',
    how: 'the maintainer’s transcription of the chart (text and a screenshot that agree); the page draws the chart by script, which did not open under automation',
  },
  {
    kind: 'cited',
    section: 'Performance Designs, Wing Loading Chart Interpretation',
    citations: ['pdWingLoadingGuide'],
    lastRead: '2026-10-08',
    edition: 'CN-0089 Rev. 0',
    how: 'the PDF as performancedesigns.com served it',
  },
  {
    kind: 'cited',
    section: 'LSPC Waivered Wind Limits',
    citations: ['lspcWaiver'],
    lastRead: null,
    edition: 'undated: a photo of the posted sign',
    how: 'a transcription of an undated photo of the sign, in this repository since 2026-07-04; not yet checked against the sign as posted now',
  },
];
