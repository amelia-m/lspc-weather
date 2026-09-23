import type { Citation } from '../domain/types';
import { CITATIONS } from '../config/thresholds';
import { Panel } from './common/Panel';
import { SourceLink } from './common/SourceLink';

/**
 * The verification checklist, as a page a jumper or instructor can actually
 * open from a phone at the DZ.
 *
 * Each entry is three things and nothing else: the claim as the dashboard
 * makes it today, what the cited source says (quoted, with where and when it
 * was read), and the questions a reader is asked to settle. Nothing here says
 * what the app used to claim or what changed — that reads as a changelog at
 * the DZ, and the reader has to work out which sentence is live. The commit
 * log and the pull requests carry the history.
 *
 * Nothing in the dashboard links here, and that is the point: there is no
 * "Source: LSPC Weather — app heuristic" line left to follow. A threshold no
 * published source sets does not raise a flag at all (thresholds.ts, rule 3),
 * so this page is reached from the footer link and read as a checklist someone
 * works through — not as a glossary the dashboard defers to mid-flag.
 */

/** What a cited source says. `read` names where and when — "the SIM at
 *  uspa.org, 2026-09-22" — because that is the whole claim being made: not
 *  "verified", but read there, then. Every source here is revised, so a
 *  reading without its date would overstate itself. `says` quotes or closely
 *  paraphrases the source and says nothing about the app. */
interface Reading {
  read: string;
  says: string[];
}

interface Lookup {
  id: string;
  title: string;
  /** The sentence the app attaches to this claim, quoted verbatim. */
  claim: string;
  value?: string;
  where: string;
  /** The citation(s) the dashboard attaches to the claim, rendered as the
   *  same links the cards show, so the reader lands on the section. */
  sources: Citation[];
  /** What the citation is cited for, when the link alone would mislead — an
   *  absence, or a sentence the source does not cover. */
  citesNote?: string;
  found?: Reading;
  /** What the reader is asked to confirm or decide — the things a document
   *  could not settle, because they are about how this DZ applies a rule. */
  asks: string[];
}

/** Ordered by what a jumper could act on. */
const LOOKUPS: Lookup[] = [
  {
    id: 'A1',
    title: 'Student ground-wind limit',
    claim:
      'USPA BSR maximum ground winds for solo students: 14 mph (~12 kt) on ram-air canopies, 10 mph on round reserves. An S&TA or Examiner may waive it on site.',
    value: '14 mph, stored as 12 kt — the caution band',
    where: 'Surface wind card, and the Surface wind flag, with Student selected',
    sources: [CITATIONS.uspaStudentWinds],
    found: {
      read: 'the SIM at uspa.org, 2026-09-22',
      says: [
        'Section 2-1 is the Basic Safety Requirements. 2-1 H, “Winds”: “Maximum ground winds — For all solo students [S] — 14 mph for ram-air canopies, 10 mph for round reserves.”',
        'The [S] marking means the requirement may be waived by an S&TA or Examiner (2-2 B).',
      ],
    },
    asks: [
      'The flag fires at 12 kt, which is 14 mph rounded down to whole knots. Is rounding down the right direction for a limit a jumper reads off this card?',
      'The app has one Student profile and its band and flag use the 14 mph figure only; a student on a round reserve gets no flag at 10 mph, and the card says so. Does anyone at this DZ jump a round reserve?',
    ],
  },
  {
    id: 'A2',
    title: 'Minimum opening altitudes',
    claim:
      'USPA BSR minimum container-opening altitudes: students & A-license 3,000 ft AGL, B-license 2,500 ft, C/D 2,500 ft (waiverable by an S&TA to no lower than 2,000 ft), tandem 5,000 ft. These are floors — deploy above your minimum, not at it.',
    where: 'Freefall drift / spot card. Also sets the Deploy dropdown default.',
    sources: [CITATIONS.uspaOpeningAltitude],
    found: {
      read: 'the SIM at uspa.org, 2026-09-22',
      says: [
        'BSR 2-1 I: “Tandem jumps: 5,000 feet AGL [E]; All students and A-license holders: 3,000 feet AGL [E]; B-license holders: 2,500 feet AGL [E]; C- and D-license holders: 2,500 feet AGL [S] (waiverable to no lower than 2,000 feet AGL).” [E] is waiverable by the Executive Committee, [S] by an S&TA or Examiner (2-2 B).',
        '2-2 C describes an S&TA waiving the deployment altitude “from 2,500 feet down to 2,000 feet”, and notes it is the one S&TA waiver that needs no written filing.',
      ],
    },
    asks: [
      'The Deploy default for “licensed” is 2,500 ft, which is both the B and the C/D figure. Does the default read sensibly?',
      'Is the tandem figure set by the SIM, by the manufacturer, or both? It is printed as a BSR minimum.',
    ],
  },
  {
    id: 'A3',
    title: 'Night jumps',
    claim:
      'Between sunset and sunrise, 14 CFR 105.19 requires the jumper to display a light visible for at least 3 statute miles, from open canopy until landing. USPA counts any jump between official sunset and sunrise as a night jump, and says participants should meet USPA B-licence requirements — see SIM 5-3.',
    where: 'Conditions to note, after sunset',
    sources: [CITATIONS.far10519, CITATIONS.uspaNightJumps],
    citesNote: '105.19 for the light; SIM 5-3 for the USPA sentence',
    found: {
      read: 'the SIM at uspa.org, 2026-09-22, and the eCFR, 2026-09-23',
      says: [
        '14 CFR 105.19, in full: “(a) No person may conduct a parachute operation, and no pilot in command of an aircraft may allow a person to conduct a parachute operation from an aircraft between sunset and sunrise, unless the person or object descending from the aircraft displays a light that is visible for at least 3 statute miles. (b) The light required by paragraph (a) of this section must be displayed from the time that the person or object is under a properly functioning open parachute until that person or object reaches the surface.” It says nothing about licences.',
        'SIM 5-3 A: “Any jumps made between official sunset and official sunrise are considered night jumps.”',
        'SIM 5-3 B: participants “should meet all the requirements for a USPA B or higher license”. SIM 3-1 lists performing night jumps among the B licence’s privileges.',
        'BSR 2-1 G: all student jumps take place between official sunrise and official sunset (tandem students, civil twilight).',
      ],
    },
    asks: [
      'The reg says “sunset”; USPA says “official sunset”. The flag fires on the sunset the app computes for the DZ’s coordinates — the Sun card’s figure. Is that what the DZ treats as official sunset?',
    ],
  },
  {
    id: 'A4',
    title: 'No USPA wind limit for licensed jumpers',
    claim:
      'No USPA ground-wind limit for licensed jumpers — the BSR states maximum ground winds for solo students and then that for licensed skydivers they "are unlimited". Judge it on your canopy, your currency and the conditions, with the S&TA. Whether the load flies is a separate question: takeoff limits come from the aircraft’s operating limitations and the pilot in command, not from USPA — ask the PIC.',
    where:
      'Surface wind card with Licensed selected — a standing note under the reading, at any wind speed. No surface-wind flag fires on this profile at any speed.',
    sources: [CITATIONS.uspaLicensedWinds],
    citesNote: 'cited for the absence of a limit',
    found: {
      read: 'the SIM at uspa.org, 2026-09-22',
      says: [
        'BSR 2-1 H states maximum ground winds “For all solo students”, then: “For licensed skydivers are unlimited.”',
      ],
    },
    asks: [
      'The second half — that takeoff limits belong to the aircraft and the PIC rather than to USPA — is cited to the same BSR section, which does not address it. Should it cite nothing and simply point at the PIC?',
      '“Unlimited” in the BSRs is not the same as “fine”. The card leaves the judgement to the jumper and the S&TA. Does that read correctly to an instructor?',
    ],
  },
  {
    id: 'A5',
    title: 'The BSR-excursion rule behind the club waiver',
    claim:
      'Any excursion above the USPA BSR requires on-site approval by a USPA instructor; consult the S&TA.',
    where:
      'Surface wind flag, with any LSPC waiver tier selected. The card carries the club-policy link behind that tier’s limit; this sentence reaches the reader only when the flag fires.',
    sources: [CITATIONS.lspcWaiver, CITATIONS.uspaWaivers],
    citesNote: 'the club policy for the sentence; SIM 2-2 for the waiver rule behind it',
    found: {
      read: 'the SIM at uspa.org, 2026-09-22, and the club document as transcribed in docs/lspc-waivered-wind-limits.md — an undated photo of the posted sign, in this repository since 2026-07-04',
      says: [
        'The club document: “All excursion from the wind limits stated in the BSRs shall be approved on site by at least a USPA instructor before sending a student up in wind conditions higher than stated in the BSR. It is recommended that the S&TA be consulted if available.”',
        'SIM 2-2, “Waivers to the Basic Safety Requirements”: each BSR is waiverable only by the full board “except for those BSRs designated as being waiverable by: S&TA or Examiner only [S]”. The student ground-wind BSR (2-1 H) carries [S].',
        'SIM 2-2 C: an S&TA waiver must be filed in writing on the USPA waiver form, with copies to the Regional Director and USPA Headquarters, and stands until rescinded or the DZ changes hands.',
      ],
    },
    asks: [
      'The club’s posted tiers are a standing waiver in the 2-2 sense. Has it been filed as one, and is the posted sign the current version?',
    ],
  },
  {
    id: 'A6',
    title: 'General weather guidance',
    claim: 'Thunderstorms reported at the station — convective hazard for aircraft and canopies.',
    where: 'Thunderstorm flag (observed) in Conditions to note',
    sources: [CITATIONS.uspaWeather],
    found: {
      read: 'the SIM at uspa.org, 2026-09-22',
      says: [
        'SIM 4-5 is “Weather”. Part B, “Hazardous Weather”, covers gust fronts, turbulence from gusty winds and thermals, thunderstorms generating spontaneously on calm hot humid days, and dust devils.',
        'Part A, “Determining Winds”, notes that winds-aloft reports are forecasts and can change at any time. Part C covers density altitude, including its effect on the aircraft — “slower and flatter rate of climb”, longer takeoff distances.',
      ],
    },
    asks: [
      'Should the density-altitude card cite SIM 4-5 C alongside FAA-P-8740-2 (A10)?',
    ],
  },
  {
    id: 'A7',
    title: 'Exit separation and spotting in strong upper winds',
    claim:
      'Strong upper winds increase freefall drift and lengthen the spot — plan jump run and exit separation accordingly.',
    where: 'Winds aloft card, standing note under the table, at any wind speed',
    sources: [CITATIONS.uspaSpotting],
    found: {
      read: 'the SIM at uspa.org, 2026-09-22',
      says: [
        'SIM 4-7 C, “Exit Separation on Jump Run”: “On days with strong upper headwinds, allow more time between groups on the same pass to get sufficient horizontal separation over the ground.”',
        'It also gives distances: at least 1,000 ft of ground separation between solo jumpers, at least 1,500 ft between small groups, more as groups grow; and that slower-falling groups, having longer exposure to upper headwinds, exit before faster-falling groups when jump run is into the wind.',
      ],
    },
    asks: [
      'Should the card print the 1,000 / 1,500 ft ground-separation figures? They are published and checkable, but they are an operational instruction rather than a weather reading.',
    ],
  },
  {
    id: 'A8',
    title: 'Flight visibility and clearance from cloud',
    claim:
      '14 CFR 105.17 requires at least 3 SM flight visibility below 10,000 ft MSL, and 5 SM at or above it — an exit above 10,000 ft MSL is in the 5 SM row. This reading is surface visibility from the METAR; the rule is about flight visibility at altitude.',
    value: 'Flag fires below 3 SM',
    where:
      'Visibility flag in Conditions to note; the overcast flag (“jumps may not be made into or through clouds”); and the note under the flight category on the Ceiling & sky card, which prints both altitude rows.',
    sources: [CITATIONS.far10517],
    found: {
      read: 'the eCFR (Title 14 current as of 2026-09-21), 2026-09-23',
      says: [
        '“No person may conduct a parachute operation, and no pilot in command of an aircraft may allow a parachute operation to be conducted from that aircraft — (a) Into or through a cloud, or (b) When the flight visibility or the distance from any cloud is less than that prescribed in the following table.”',
        'The table, in full. 1,200 ft or less above the surface regardless of the MSL altitude: 3 SM; 500 ft below, 1,000 ft above, 2,000 ft horizontal. More than 1,200 ft above the surface but less than 10,000 ft MSL: 3 SM; 500 ft below, 1,000 ft above, 2,000 ft horizontal. More than 1,200 ft above the surface and at or above 10,000 ft MSL: 5 SM; 1,000 ft below, 1,000 ft above, 1 mile horizontal.',
        'Brown’s Airport is at 1,182 ft MSL, so a 10,000 ft AGL exit is above 10,000 ft MSL, in the 5 SM / 1 mile row; the freefall passes into the 3 SM row on the way down.',
      ],
    },
    asks: [
      'The flag fires at 3 SM on the METAR’s surface visibility. The reg’s measure is flight visibility at altitude, and at exit the row is 5 SM. Should the flag fire at 5 SM instead? That is a judgement for the S&TA and the PIC.',
    ],
  },
  {
    id: 'A9',
    title: 'Flight category',
    claim:
      'Standard FAA flight category (AIM 7-1-7) from ceiling and visibility — a label for the weather, not a jump rule. Below VFR, expect the pilot’s VFR weather minimums and the cloud-clearance requirements for parachute ops to be the limiting factors; that call belongs to the PIC.',
    value: 'MVFR is a watch; IFR and LIFR a caution',
    where: 'Flight-category flag in Conditions to note, and the category pill on the Ceiling & sky card.',
    sources: [CITATIONS.aimFlightCategory],
    citesNote:
      'for the categories only. The second sentence cites nothing: it names no rule number and no figure, and sends the reader to the PIC.',
    found: {
      read: 'the AIM on faa.gov (Change 3, effective 2026-07-09), 2026-09-23',
      says: [
        'AIM 7-1-7, Categorical Ceiling and Visibility Conditions: “LIFR (Low IFR). Ceiling less than 500 feet and/or visibility less than 1 mile. IFR. Ceiling 500 to less than 1,000 feet and/or visibility 1 to less than 3 miles. MVFR (Marginal VFR). Ceiling 1,000 to 3,000 feet and/or visibility 3 to 5 miles inclusive. VFR. Ceiling greater than 3,000 feet and visibility greater than 5 miles; includes sky clear.”',
        'The AIM says the terms describe “either reported or forecast general ceiling and visibility conditions”.',
        'The pilot’s VFR weather minimums are 14 CFR 91.155, which this app does not cite.',
      ],
    },
    asks: [
      'The app’s bands: a 3,000 ft ceiling or exactly 5 SM is MVFR; 1,000 ft or 3 SM is MVFR rather than IFR; the overall category is the worse of the two. Do those match the definitions above?',
      'A report with no sky group, or a broken layer with no measured height (BKN///), gets no VFR label: visibility alone can make it MVFR, IFR or LIFR, but VFR needs a ceiling. Does that read correctly to a pilot?',
    ],
  },
  {
    id: 'A10',
    title: 'Density altitude and climb performance',
    claim:
      'High density altitude reduces a loaded jump plane’s climb performance — expect longer climbs to altitude.',
    where: 'Density altitude card, as a standing note under the figure. No flag fires on density altitude.',
    sources: [CITATIONS.faaDensityAltitude],
    found: {
      read: 'the linked PDF (FAA-P-8740-2, AFS-8, 2008 edition), 2026-09-23',
      says: [
        'An 8-page PDF whose cover reads “FAA–P–8740–2 • AFS–8 (2008) HQ-08561 Density Altitude”, in a FAASTeam event folder; the pamphlet says copies “may be downloaded or printed at http://FAASafety.gov”.',
        '“From the pilot’s point of view, therefore, an increase in density altitude results in the following: Increased takeoff distance. Reduced rate of climb. Increased TAS (but same IAS) on approach and landing. Increased landing roll distance.” And: “high density altitude has particular implications for takeoff/climb performance and landing distance”.',
        'It defines density altitude as “pressure altitude corrected for nonstandard temperature variations” and gives a rule-of-thumb chart rather than a coefficient; the chart’s rows work out to roughly 100–115 ft per °C.',
        'On humidity: “Humidity is not generally considered a major factor in density altitude computations because the effect of humidity is related to engine power rather than aerodynamic efficiency”; when it is high, “add 10 percent to your computed takeoff distance and anticipate a reduced climb rate”.',
      ],
    },
    asks: [
      'The card’s headline figure folds humidity in (virtual temperature) whenever a dew point is available, so on a humid day it will not match the dry-air number an ASOS or an E6B gives the pilot. Should the headline be the dry-air figure, with the humidity correction as a separate line?',
      'The app computes with 120 ft per °C of deviation from standard temperature; the pamphlet’s chart implies less. Which does the PIC expect to see?',
    ],
  },
];

interface Heuristic {
  id: string;
  what: string;
  value: string;
  where: string;
}

/** Numbers this dashboard invented that are still on screen. A threshold with
 *  no published source does not decide whether a flag appears or paint a
 *  figure in a warning colour; what is left asserts nothing — it sets the
 *  length of a bar — which is why the list is one row. */
const HEURISTICS: Heuristic[] = [
  {
    id: 'B1',
    what: 'Licensed surface-wind bar scale',
    value: '25 kt',
    where: 'Surface wind card, Licensed — sets where the bar tops out. No flag, no band.',
  },
];

export function CitationsPage(): JSX.Element {
  return (
    <div className="app">
      <header className="app-head">
        <div>
          <h1>Citations to verify</h1>
          <p className="app-sub">
            What this dashboard claims, what the source says, and what you are asked to confirm ·{' '}
            <a href="#">back to the dashboard</a>
          </p>
        </div>
      </header>

      <p className="disclaimer">
        <strong>Each entry below is a claim the dashboard makes, what its source says, and the
        questions a reader is asked to settle.</strong>{' '}
        The USPA SIM sections were read at uspa.org on 2026-09-22; 14 CFR 105.17 and 105.19, AIM
        7-1-7 and FAA-P-8740-2 on 2026-09-23. The club&rsquo;s posted wind-limit tiers are a
        transcription of an undated photo of the sign. A reading is each source as served on one
        day, not a licensed professional&rsquo;s sign-off, and knowing a rule is not knowing how
        this DZ applies it. Compare the claim with what the source says, answer the questions, and
        mark each one <em>correct</em>, <em>wrong section</em>, <em>wrong authority</em>, or{' '}
        <em>the claim itself is wrong</em>.
      </p>

      <h2 className="cite-heading">Part A · the USPA and FAA claims</h2>
      <p className="muted small cite-intro">Ordered by what a jumper could act on.</p>

      {LOOKUPS.map((item) => (
        <Panel key={item.id} title={`${item.id} · ${item.title}`}>
          <p className="cite-quote">{item.claim}</p>
          <dl className="kv cite-kv">
            {item.value && (
              <>
                <dt>Value</dt>
                <dd>{item.value}</dd>
              </>
            )}
            <dt>Where</dt>
            <dd>{item.where}</dd>
            <dt>Cites</dt>
            <dd>
              {item.sources.map((s, i) => (
                <span key={s.url}>
                  {i > 0 && ' · '}
                  <SourceLink citation={s} />
                </span>
              ))}
              {item.citesNote && <> — {item.citesNote}</>}
            </dd>
          </dl>
          {item.found && (
            <>
              <p className="cite-found-head">The source says (read in {item.found.read}):</p>
              <ul className="cite-found">
                {item.found.says.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </>
          )}
          {item.asks.length > 0 && (
            <>
              <p className="cite-asks-head">Please confirm:</p>
              <ul className="cite-asks">
                {item.asks.map((ask) => (
                  <li key={ask}>{ask}</li>
                ))}
              </ul>
            </>
          )}
          <p className="cite-verdict">Verdict:</p>
        </Panel>
      ))}

      <h2 className="cite-heading">Part B · instructor judgement, no lookup needed</h2>
      <p className="muted small cite-intro">
        One number invented for this dashboard is still on screen. It is not claimed to come from
        USPA or the FAA, and it triggers nothing — it only decides how long a bar is drawn. Worth a
        glance rather than a ruling.
      </p>

      <Panel title="App thresholds" subtitle="not published limits">
        <div className="sky-scroll">
          <table className="aloft-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Threshold</th>
                <th>Value</th>
                <th>Where</th>
              </tr>
            </thead>
            <tbody>
              {HEURISTICS.map((h) => (
                <tr key={h.id}>
                  <td>{h.id}</td>
                  <td>{h.what}</td>
                  <td>{h.value}</td>
                  <td>{h.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Every wind flag fires at a published limit or not at all. The <strong>Watch</strong>{' '}
          badge appears on the two flags that fire on a reported condition rather than on a number:
          MVFR flight category (AIM 7-1-7) and an overcast layer (14 CFR 105.17).
        </p>
        <p className="muted small">
          The club waiver tiers (0–5 jumps: 15 mph wind / 16 mph gust · 6–10: 16/18 · 10–20: 18/19 ·
          21+: 18/20) are transcribed from the club’s posted policy and are <strong>not</strong> app
          heuristics — please confirm the transcription matches the current posted sign.
        </p>
      </Panel>

      <h2 className="cite-heading">How each source was read</h2>
      <p className="muted small cite-intro">
        The SIM as uspa.org served it on 2026-09-22. The two CFR sections through the eCFR API on
        2026-09-23 — Title 14 as current on 2026-09-21 — which serves the text the linked pages
        render. AIM 7-1-7 from the HTML edition on faa.gov on 2026-09-23, Change 3, effective
        2026-07-09. FAA-P-8740-2 from the linked PDF on 2026-09-23: the 2008 AFS-8 edition, eight
        pages, in a FAASTeam event folder rather than a catalogue — if the link dies, the pamphlet
        is what to search for. None of that is a check by a person who holds the rating; every
        entry above ends in a verdict line for that reason.
      </p>

      <footer className="app-foot">
        <a href="#">← Back to the dashboard</a>
      </footer>
    </div>
  );
}
