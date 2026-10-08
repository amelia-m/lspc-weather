/**
 * When each source section the dashboard cites was last read, where, in
 * which edition, and how. One entry per section a citation's link lands on;
 * several citations can share one (2-1 H backs both wind-limit claims).
 *
 * This is the record the citation notes take their dates from (SIM_READ_NOTE
 * in thresholds.ts), and the table on the #citations page. A test holds every
 * citation to an entry here, and every citation note to its entry's date, so
 * the two cannot drift. Reading a section is not an instructor's sign-off:
 * each entry says what was read, not that a rule was approved.
 *
 * The SIM is pinned two ways. `edition` is what uspa.org calls its online
 * SIM on the day ("2026 SIM"); USPA revises it within an edition through
 * change documents, and the page's list of them did not load on 2026-10-08
 * ("Downloads is currently unavailable"), so the edition name alone does not
 * say which text was read. `fingerprint` does: a SHA-256 of the part's text
 * as simPartText reduces it, taken from the page served that day.
 * scripts/simText.live.ts takes it again daily and fails when a part's text
 * has changed, which is the signal to read it again.
 */

/** What uspa.org calls the online SIM, read on its SIM page on 2026-10-08. */
export const SIM_EDITION = '2026 SIM';

/** The day every cited SIM part below was last read in full and its quotes
 *  on the #citations page checked against it. */
export const SIM_LAST_READ = '2026-10-08';

export interface SourceReading {
  /** e.g. "USPA SIM 2-1 H, Winds". */
  section: string;
  /** Keys of CITATIONS whose link lands on this section; the page links the
   *  first one's URL, so the address is written once, in thresholds.ts. */
  citations: string[];
  /** YYYY-MM-DD; null where nobody has read the source itself, only a copy
   *  of it (the club's sign). */
  lastRead: string | null;
  /** The edition or revision as the publisher states it. */
  edition: string;
  /** How it was read: from where, in what form. */
  how: string;
  /** For a SIM part: where the text is on the page, and its fingerprint on
   *  `lastRead` (SHA-256 of simPartText, and its length in characters). */
  simPart?: { section: string; anchor: string; sha256: string; chars: number };
}

const SIM_HOW =
  'the online SIM at uspa.org, the section page as served, the part from its anchor to the next; every quote of it on this page checked against that text';

const sim = (
  section: string,
  anchor: string,
  title: string,
  citations: string[],
  sha256: string,
  chars: number,
): SourceReading => ({
  section: `USPA SIM ${section} ${anchor.slice(-1)}, ${title}`,
  citations,
  lastRead: SIM_LAST_READ,
  edition: SIM_EDITION,
  how: SIM_HOW,
  simPart: { section, anchor, sha256, chars },
});

export const READING_LOG: SourceReading[] = [
  sim('2-1', '1H', 'Winds', ['uspaStudentWinds', 'uspaLicensedWinds'],
    '08145bc3ac97f635b5c1d109592c2b2e854a6cea6a40321f8f0ae84723634b1c',
    146,
  ),
  sim('2-1', '1I', 'Minimum Opening Altitudes', ['uspaOpeningAltitude'],
    'd3d1c75934696b5f27d3d158ddf281545d8b66a0a6c7fdf220f93430a04cbd23',
    316,
  ),
  sim('2-2', '2B', 'Classification of Waivers', ['uspaWaivers'],
    'f4cf2ddf17418d8c3729625ef8f837ad55c5aab18ae08ac7628dd760b60e1121',
    511,
  ),
  sim('4-5', '5B', 'Hazardous Weather', ['uspaWeather'],
    'c3c535629eecc959f4b543473138ef8cf2625259bcf62b5219e1db99fb1ca4e4',
    2071,
  ),
  sim('4-7', '7A', 'Why Spotting is Important', ['uspaSpottingWho'],
    'c45f6d141108b2c16d57aa463ea3c2bb10bd1b8ab0b3c91c495afa0021d573f4',
    578,
  ),
  sim('4-7', '7C', 'Exit Separation on Jump Run', ['uspaSpotting'],
    '4f208b027cc5f5b58ddf0e3947d5ba031f599649136f86e821391884b2a55daf',
    1171,
  ),
  sim('5-3', '3A', 'Introduction and Definition', ['uspaNightJumps'],
    '96ddb07f6f0c18a7314913c1cf54d8184712c5643e5faee9bb1a4ebb7be0c3a1',
    929,
  ),
  {
    section: '14 CFR 105.17, Flight visibility and clearance from cloud requirements',
    citations: ['far10517'],
    lastRead: '2026-09-23',
    edition: 'Title 14 as current on 2026-09-21',
    how: 'the eCFR API (api/versioner/v1/full/2026-09-21/title-14.xml); the linked page answers a script with a bot check',
  },
  {
    section: '14 CFR 105.19, Parachute operations between sunset and sunrise',
    citations: ['far10519'],
    lastRead: '2026-09-23',
    edition: 'Title 14 as current on 2026-09-21',
    how: 'the eCFR API, as for 105.17',
  },
  {
    section: 'FAA AIM 7-1-7, Categorical Outlooks',
    citations: ['aimFlightCategory'],
    lastRead: '2026-09-23',
    edition: 'Change 3, effective 2026-07-09',
    how: 'the HTML AIM on faa.gov',
  },
  {
    section: 'FAA-P-8740-2, Density Altitude',
    citations: ['faaDensityAltitude'],
    lastRead: '2026-09-23',
    edition: 'AFS-8, 2008',
    how: 'the linked PDF (8 pages)',
  },
  {
    section: 'Performance Designs, Navigator Wing Loading Chart',
    citations: ['pdNavigator'],
    lastRead: '2026-10-08',
    edition: 'TABLE-0122 Rev.A',
    how: 'the maintainer’s transcription of the chart (text and a screenshot that agree); the page draws the chart by script, which did not open under automation',
  },
  {
    section: 'Performance Designs, Wing Loading Chart Interpretation',
    citations: ['pdWingLoadingGuide'],
    lastRead: '2026-10-08',
    edition: 'CN-0089 Rev. 0',
    how: 'the PDF as performancedesigns.com served it',
  },
  {
    section: 'LSPC Waivered Wind Limits',
    citations: ['lspcWaiver'],
    lastRead: null,
    edition: 'undated: a photo of the posted sign',
    how: 'a transcription of an undated photo of the sign, in this repository since 2026-07-04; not yet checked against the sign as posted now',
  },
];
