import { Panel } from './common/Panel';

/**
 * The verification checklist, as a page a jumper or instructor can actually
 * open from a phone at the DZ.
 *
 * Every reference in this dashboard began as an AI recollection, written in an
 * environment that could not reach the sources. On 2026-09-22 that changed for
 * USPA: the SIM sections behind these claims were fetched from uspa.org and
 * read. On 2026-09-23 the rest followed — 14 CFR 105.17 and 105.19 through the
 * eCFR, AIM 7-1-7 on faa.gov and FAA-P-8740-2 from the linked PDF. Each entry
 * below records what the source says and when it was read, rather than asking
 * whether it exists. Two USPA claims were wrong and are fixed; two citations
 * that pointed at the SIM contents page now name sections; the CFR and FAA
 * claims held, and two sentences that said more than their section does were
 * tightened.
 *
 * That is a smaller thing than it sounds, and the entries say so where it
 * matters. What was read is each source as served on one day — the SIM, the
 * CFR and the AIM are all revised. Reading a rule is also not the same as
 * knowing how a DZ applies it — the remaining `asks` are the questions that
 * still need an instructor or the PIC rather than a document.
 *
 * Nothing in the dashboard links here, and that is the point: there is no
 * "Source: LSPC Weather — app heuristic" line left to follow. A threshold no
 * published source sets no longer raises a flag at all (thresholds.ts, rule 3),
 * so this page is reached from the footer link and read as a checklist someone
 * works through — not as a glossary the dashboard defers to mid-flag.
 */

/** A reading of a cited source. `read` names where and when — "the SIM at
 *  uspa.org, 2026-09-22" — because that is the whole claim being made: not
 *  "verified", but read there, then. Every source here is revised, so a
 *  reading without its date would overstate itself. */
interface Reading {
  read: string;
  says: string[];
}

interface Lookup {
  id: string;
  title: string;
  /** The sentence the app attaches to this claim, quoted verbatim. Usually it
   *  is on screen; `where` says so, and says so when it is not — a claim that
   *  has dropped off the page still has to be checked, because the citation
   *  behind it is still in the code and could be rendered again. Named for the
   *  claim rather than the screen so no entry has to pretend to be visible. */
  claim: string;
  value?: string;
  where: string;
  cites: string;
  /** What the cited section actually says, where it has been read. Quoted or
   *  closely paraphrased, with the sub-section, so a reader can go and land on
   *  the same words rather than take this page's summary for it. */
  found?: Reading;
  /** What is still open. An entry keeps its asks after a reading when the
   *  reading did not settle them — a section can confirm a number and still
   *  leave how the DZ applies it to an instructor. */
  asks: string[];
}

/** The claims, what the cited section says, and what is still open.
 *
 *  Each entry states the sentence the app attaches to the claim, the number
 *  behind it, where it appears (or that it currently appears nowhere), and what
 *  it links to. `found` records what the section said when it was read, and
 *  names the source and the date; `asks` is what a reading could not settle.
 *  Where a reading contradicted the app, the entry says what was wrong and what
 *  changed, rather than quietly reading as though the app had been right all
 *  along. */
const LOOKUPS: Lookup[] = [
  {
    id: 'A1',
    title: 'Student ground-wind limit',
    claim:
      'USPA BSR maximum ground winds for solo students: 14 mph (~12 kt) on ram-air canopies, 10 mph on round reserves. An S&TA or Examiner may waive it on site.',
    value: '14 mph, stored as 12 kt — the caution band',
    where: 'Surface wind card, and the Surface wind flag, with Student selected',
    cites: 'USPA SIM, Section 2-1 (BSR)',
    found: {
      read: 'the SIM at uspa.org, 2026-09-22',
      says: [
        'Section 2-1 is the Basic Safety Requirements, and 2-1 H (“Winds”) reads: “Maximum ground winds — For all solo students [S] — 14 mph for ram-air canopies, 10 mph for round reserves.” The 14 mph figure is confirmed.',
        'It is stated as a maximum, not a recommendation. The app said USPA “recommends” it; that wording is gone. The [S] marking means it is waiverable by an S&TA or Examiner (SIM 2-2 B), which is what the club document means by “approved on site”.',
        'The canopy qualifier was slightly off: the BSR pairs 14 mph with ram-air canopies and 10 mph with round reserves. The app said “on ram-air reserves”. Both figures are now shown.',
      ],
    },
    asks: [
      'The app flags at 12 kt, being 14 mph rounded down to whole knots. Is rounding down the right direction for a limit a jumper reads off this card?',
    ],
  },
  {
    id: 'A2',
    title: 'Minimum opening altitudes',
    claim:
      'USPA BSR minimum container-opening altitudes: students & A-license 3,000 ft AGL, B-license 2,500 ft, C/D 2,500 ft (waiverable by an S&TA to no lower than 2,000 ft), tandem 5,000 ft. These are floors — deploy above your minimum, not at it.',
    where: 'Freefall drift / spot card. Also sets the Deploy dropdown default.',
    cites: 'USPA SIM, Section 2-1 (BSR)',
    found: {
      read: 'the SIM at uspa.org, 2026-09-22',
      says: [
        'The app was wrong about C/D. BSR 2-1 I reads: “Tandem jumps: 5,000 feet AGL [E]; All students and A-license holders: 3,000 feet AGL [E]; B-license holders: 2,500 feet AGL [E]; C- and D-license holders: 2,500 feet AGL [S] (waiverable to no lower than 2,000 feet AGL).” The app printed a flat 2,000 ft for C/D, which is the waiver floor, not the BSR minimum. Corrected on the card. (The bracketed letters are the BSR’s waiverability markers — [E] the Executive Committee, [S] an S&TA or Examiner; see 2-2 B.)',
        'SIM 2-2 C corroborates the direction, describing an S&TA waiving the deployment altitude “from 2,500 feet down to 2,000 feet”, and notes this is the one S&TA waiver that needs no written filing.',
        'Tandem 5,000 ft, students & A 3,000 ft and B 2,500 ft are all as the app stated.',
      ],
    },
    asks: [
      'The Deploy default is 2,500 ft for “licensed”. That is now both the B and the C/D BSR figure, so it is no longer conservative relative to C/D — confirm the default still reads sensibly.',
      'Is the tandem figure set by the SIM, by the manufacturer, or both? It is printed to users as a BSR minimum.',
    ],
  },
  {
    id: 'A3',
    title: 'Night jumps',
    claim:
      'Between sunset and sunrise, 14 CFR 105.19 requires the jumper to display a light visible for at least 3 statute miles, from open canopy until landing. USPA counts any jump between official sunset and sunrise as a night jump, and says participants should meet USPA B-licence requirements — see SIM 5-3.',
    where: 'Conditions to note, after sunset',
    cites: '14 CFR 105.19 for the light; USPA SIM 5-3 (Night Jumps) for the USPA claim',
    found: {
      read: 'the SIM at uspa.org, 2026-09-22, and the eCFR, 2026-09-23',
      says: [
        '14 CFR 105.19, read through the eCFR on 2026-09-23, reads in full: “(a) No person may conduct a parachute operation, and no pilot in command of an aircraft may allow a person to conduct a parachute operation from an aircraft between sunset and sunrise, unless the person or object descending from the aircraft displays a light that is visible for at least 3 statute miles. (b) The light required by paragraph (a) of this section must be displayed from the time that the person or object is under a properly functioning open parachute until that person or object reaches the surface.”',
        'So the trigger is sunset to sunrise, as the flag has it, and the 3-statute-mile figure is the section’s. The light is the descending jumper’s, shown from open canopy to the surface — an earlier version of this entry called 105.19 “a reg about lighting an aircraft and a jumper”, which it is not, and the flag now says whose light it is. The section says nothing about licences, which is why the USPA half cites SIM 5-3.',
        'SIM 5-3 A: “Any jumps made between official sunset and official sunrise are considered night jumps.” So the flag firing at sunset matches USPA’s own definition as well as the reg’s trigger — the app’s second open question is answered.',
        'SIM 5-3 B says participants “should meet all the requirements for a USPA B or higher license” — a recommendation, not a BSR. SIM 3-1 lists performing night jumps among the B licence’s privileges and requires 50 jumps for it, so the “50 jumps” figure is right. The app said USPA “requires”; it now says “should”.',
        'Separately, BSR 2-1 G requires all student jumps to take place between official sunrise and sunset (tandem students, civil twilight).',
      ],
    },
    asks: [
      'The reg says “sunset”; USPA says “official sunset”. The flag fires on the sunset the app computes for the DZ’s coordinates — the Sun card’s figure. Confirm that is what the DZ treats as official sunset.',
    ],
  },
  {
    id: 'A4',
    title: 'No USPA wind limit for licensed jumpers',
    claim:
      'No USPA ground-wind limit for licensed jumpers — the BSR states maximum ground winds for solo students and then that for licensed skydivers they "are unlimited". Judge it on your canopy, your currency and the conditions, with the S&TA. Whether the load flies is a separate question: takeoff limits come from the aircraft’s operating limitations and the pilot in command, not from USPA — ask the PIC.',
    where:
      'Surface wind card with Licensed selected — a standing note under the reading, at any wind speed. No surface-wind flag fires on this profile at any speed.',
    cites: 'USPA SIM, Section 2-1 (BSR), cited for the absence of a limit',
    found: {
      read: 'the SIM at uspa.org, 2026-09-22',
      says: [
        'This was the most consequential open item on the page, and the app has it right. BSR 2-1 H states maximum ground winds “For all solo students”, then: “For licensed skydivers are unlimited.” The absence is explicit, not inferred, so the app is not silent where a published limit exists.',
        'The guidance now quotes that phrase rather than describing the limit as merely “written for students”.',
      ],
    },
    asks: [
      'The second half — that takeoff limits belong to the aircraft and the PIC rather than to USPA — is still cited to the same BSR section, which does not address it. Should it cite nothing and simply point at the PIC?',
      '“Unlimited” in the BSRs is not the same as “fine”. The card leaves the judgement to the jumper and the S&TA; confirm that reads correctly to an instructor.',
    ],
  },
  {
    id: 'A5',
    title: 'The BSR-excursion rule behind the club waiver',
    claim:
      'Any excursion above the USPA BSR requires on-site approval by a USPA instructor; consult the S&TA.',
    where:
      'Surface wind flag, with any LSPC waiver tier selected. The card carries the club-policy link behind that tier’s limit, but this sentence itself reaches the reader only when the flag fires.',
    cites: 'LSPC waivered wind limits (club policy)',
    found: {
      read: 'the SIM at uspa.org, 2026-09-22, and the club document as transcribed in docs/lspc-waivered-wind-limits.md — an undated photo of the posted sign, in this repository since 2026-07-04',
      says: [
        'The SIM rule underneath it has been identified: 2-2 (“Waivers to the Basic Safety Requirements”). Each BSR is waiverable only by the full board “except for those BSRs designated as being waiverable by: S&TA or Examiner only [S]”. The student ground-wind BSR carries [S], so an S&TA may waive it — which is the authority the club document is exercising.',
        'SIM 2-2 C adds that an S&TA waiver must be filed in writing on the USPA waiver form, with copies to the Regional Director and USPA Headquarters, and remains in place until rescinded or the DZ changes hands.',
        'The sentence is quoted from the club document, so citing club policy still matches what is printed.',
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
    cites: 'USPA SIM, Section 4-5 (Weather)',
    found: {
      read: 'the SIM at uspa.org, 2026-09-22',
      says: [
        'The section has been identified, so this citation no longer points at the SIM contents page. SIM 4-5 is “Weather”; its part B, “Hazardous Weather”, covers gust fronts, turbulence from gusty winds and thermals, thunderstorms generating spontaneously on calm hot humid days, and dust devils.',
        'Part A (“Determining Winds”) is the section behind the BSR pre-jump requirement, and notes that winds-aloft reports are only forecasts and can change at any time.',
        'Part C covers density altitude, including its effect on the aircraft — “slower and flatter rate of climb”, longer takeoff distances. That is a USPA source for the claim on the density-altitude card, which currently cites only the FAA pamphlet.',
      ],
    },
    asks: [
      'Should the density-altitude card cite SIM 4-5 C alongside FAA-P-8740-2? It has not been changed, because the FAA pamphlet is the more specific source for the figures.',
    ],
  },
  {
    id: 'A7',
    title: 'Exit separation and spotting in strong upper winds',
    claim:
      'Strong upper winds increase freefall drift and lengthen the spot — plan jump run and exit separation accordingly.',
    where: 'Winds aloft card, standing note under the table',
    cites: 'USPA SIM, Section 4-7 (Spotting)',
    found: {
      read: 'the SIM at uspa.org, 2026-09-22',
      says: [
        'The section has been identified, so this citation no longer points at the SIM contents page. SIM 4-7 C is “Exit Separation on Jump Run”: “On days with strong upper headwinds, allow more time between groups on the same pass to get sufficient horizontal separation over the ground.”',
        'It also gives distances the app does not: at least 1,000 ft of ground separation between solo jumpers, at least 1,500 ft between small groups, more as groups grow. And that slower-falling groups, having longer exposure to upper headwinds, should exit before faster-falling groups when jump run is into the wind.',
        'The note stands on the card at any wind speed. The 20 kt trigger that used to gate it was the app’s own; 4-7 sets separation distances, not a wind speed at which to start caring, so there is nothing published to restore it from.',
      ],
    },
    asks: [
      'Should the card print the 1,000 / 1,500 ft ground-separation figures? They are published and checkable, but they are an operational instruction rather than a weather reading, and this dashboard has so far stayed out of telling jumpers how to run a load.',
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
    cites: '14 CFR § 105.17',
    found: {
      read: 'the eCFR (Title 14 current as of 2026-09-21), 2026-09-23',
      says: [
        'The section reads: “No person may conduct a parachute operation, and no pilot in command of an aircraft may allow a parachute operation to be conducted from that aircraft — (a) Into or through a cloud, or (b) When the flight visibility or the distance from any cloud is less than that prescribed in the following table.” Paragraph (a) is the overcast flag’s claim, confirmed.',
        'The table, in full. 1,200 ft or less above the surface regardless of the MSL altitude: 3 SM; 500 ft below, 1,000 ft above, 2,000 ft horizontal. More than 1,200 ft above the surface but less than 10,000 ft MSL: 3 SM; 500 ft below, 1,000 ft above, 2,000 ft horizontal. More than 1,200 ft above the surface and at or above 10,000 ft MSL: 5 SM; 1,000 ft below, 1,000 ft above, 1 mile horizontal. The 3 SM floor and the 500 / 1,000 / 2,000 ft figures the app printed are the first two rows, confirmed.',
        'The app printed only the below-10,000 ft rows. Brown’s Airport is at 1,182 ft MSL, so a 10,000 ft AGL exit is above 10,000 ft MSL and sits in the 5 SM / 1-mile row. The card and the flag now print both rows.',
        'The sky card used to say jumps “require VFR flight conditions” and cite this section for it. 105.17 does not mention VFR; the pilot’s VFR minimums are 14 CFR 91.155, which the app does not cite. The sentence now says what 105.17 says.',
      ],
    },
    asks: [
      'The flag fires at 3 SM on the METAR’s surface visibility. The reg’s measure is flight visibility at altitude, and at exit the row is 5 SM. Should the flag fire at 5 SM instead? It has been left at the lower row so the app does not hold a surface reading to a figure written for altitude — but that is a judgement, and it is the S&TA’s and the PIC’s.',
    ],
  },
  {
    id: 'A9',
    title: 'Flight category',
    claim:
      'Standard FAA flight category (AIM 7-1-7) from ceiling and visibility — a label for the weather, not a jump rule. Below VFR, expect the pilot’s VFR weather minimums and the cloud-clearance requirements for parachute ops to be the limiting factors; that call belongs to the PIC.',
    value: 'MVFR is a watch; IFR and LIFR a caution',
    where: 'Flight-category flag in Conditions to note, and the category pill on the Ceiling & sky card.',
    cites:
      'FAA AIM 7-1-7, for the categories. The second sentence cites nothing: it names no rule number and no figure, and sends the reader to the PIC.',
    found: {
      read: 'the AIM on faa.gov (Change 3, effective 2026-07-09), 2026-09-23',
      says: [
        'AIM 7-1-7, Categorical Ceiling and Visibility Conditions: “LIFR (Low IFR). Ceiling less than 500 feet and/or visibility less than 1 mile. IFR. Ceiling 500 to less than 1,000 feet and/or visibility 1 to less than 3 miles. MVFR (Marginal VFR). Ceiling 1,000 to 3,000 feet and/or visibility 3 to 5 miles inclusive. VFR. Ceiling greater than 3,000 feet and visibility greater than 5 miles; includes sky clear.”',
        'The app’s bands match at every boundary, including the inclusive ends: a 3,000 ft ceiling or exactly 5 SM is MVFR, and 1,000 ft or 3 SM is MVFR rather than IFR. The overall category is the worse of the two, which is what the AIM’s “and/or” gives.',
        'The AIM says the terms describe “either reported or forecast general ceiling and visibility conditions” — a classification, not a rule — which is how the flag presents it.',
        'The second sentence is not an AIM claim and the AIM link is not offered for it. It says the pilot’s VFR minimums and the parachute cloud-clearance rules will be what binds below VFR, and names neither: the pilot’s minimums are 14 CFR 91.155, which this app does not cite (the flag used to name it while linking only to the AIM, and a test now keeps it out), and 105.17 has its own entry, A8. It is a referral to the PIC, deliberately without a number.',
      ],
    },
    asks: [],
  },
  {
    id: 'A10',
    title: 'Density altitude and climb performance',
    claim:
      'High density altitude reduces a loaded jump plane’s climb performance — expect longer climbs to altitude.',
    where: 'Density altitude card, as a standing note under the figure. No flag fires on density altitude.',
    cites: 'FAA-P-8740-2',
    found: {
      read: 'the linked PDF (FAA-P-8740-2, AFS-8, 2008 edition), 2026-09-23',
      says: [
        'The link still resolves: an 8-page PDF whose cover reads “FAA–P–8740–2 • AFS–8 (2008) HQ-08561 Density Altitude”. It is a copy in a FAASTeam event folder rather than a catalogue page, and no other FAA home for the pamphlet was found; the pamphlet itself says copies “may be downloaded or printed at http://FAASafety.gov”.',
        'It supports the claim. “From the pilot’s point of view, therefore, an increase in density altitude results in the following: Increased takeoff distance. Reduced rate of climb. Increased TAS (but same IAS) on approach and landing. Increased landing roll distance.” And: “high density altitude has particular implications for takeoff/climb performance and landing distance”.',
        'It does not state the 120 ft per °C rule the app computes with. It defines density altitude as “pressure altitude corrected for nonstandard temperature variations” and gives a rule-of-thumb chart; the chart’s rows work out to roughly 100–115 ft per °C, so the app’s figure runs a couple of hundred feet higher on a hot day than the chart would. The card cites the pamphlet for the claim, not for the number.',
        'On humidity it says the opposite of what the card’s “humidity-corrected” label might suggest: “Humidity is not generally considered a major factor in density altitude computations because the effect of humidity is related to engine power rather than aerodynamic efficiency”, and advises instead to “add 10 percent to your computed takeoff distance and anticipate a reduced climb rate” when it is high. The app folds humidity into the density figure (virtual temperature); the pamphlet does not.',
      ],
    },
    asks: [
      'Should the card headline the dry-air figure — what an ASOS or an E6B gives the pilot — with the humidity correction as a separate line? Today the headline includes it whenever a dew point is available, so on a humid day it will not match the number the PIC computes.',
      'Is 120 ft per °C the coefficient the PIC uses? The pamphlet’s chart implies less. Either is an approximation; the question is which one the reader expects to see.',
    ],
  },
];

interface Heuristic {
  id: string;
  what: string;
  value: string;
  where: string;
}

/** Numbers this dashboard invented that are still on screen.
 *
 *  Anything that decided whether a flag appeared, or painted a figure in a
 *  warning colour, was removed rather than labelled: a threshold with no
 *  published source is not something a reader can check, so it does not get to
 *  assert anything. What is left asserts nothing — it sets the length of a
 *  bar — which is why the list is one row. */
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
            What this dashboard claims, what the rule says, and what is still open ·{' '}
            <a href="#">back to the dashboard</a>
          </p>
        </div>
      </header>

      <p className="disclaimer">
        <strong>
          These references began as AI recollections. Every one has since been read at its source.
        </strong>{' '}
        Every claim below was written by an AI assistant in an environment that could not reach the
        sources. On 2026-09-22 the SIM sections were fetched from uspa.org and read; on 2026-09-23
        the two CFR sections, AIM 7-1-7 and the FAA density-altitude pamphlet followed. Each Part A
        entry records what the source says and when it was read. Two USPA claims were wrong and are
        fixed; the CFR and FAA claims held, with two sentences tightened where the app said more
        than its section does. That is still not the same as an instructor signing this off: what
        was read is each source as served on one day, all of them are revised, and knowing a rule
        is not knowing how this DZ applies it.
        Mark each one <em>correct</em>, <em>wrong section</em>, <em>wrong authority</em>, or{' '}
        <em>the claim itself is wrong</em>.
      </p>
      <p className="muted small cite-intro">
        Everything below points at a source outside this app, so every item is one you can settle
        with a document. There is no “app heuristic” line left to rule on: where nothing published
        set a number, the flag that fired on it was removed rather than relabelled — and finding a
        real section for a citation does not license bringing any of those numbers back.
      </p>

      <h2 className="cite-heading">Part A · the USPA and FAA claims</h2>
      <p className="muted small cite-intro">
        Section numbers, and whether the rule says what we claim. The SIM sections were read at
        uspa.org on 2026-09-22; the CFR sections through the eCFR, AIM 7-1-7 on faa.gov and
        FAA-P-8740-2 from the linked PDF on 2026-09-23. Each is the source as served on one day,
        not a printed edition, and each is revised. Two USPA claims were wrong and are fixed (A2,
        A3); two citations that pointed at the contents page now name sections (A6, A7); the sky
        card&rsquo;s &ldquo;VFR flight conditions&rdquo; claim, which 105.17 does not make, is gone
        (A8). Ordered by what a jumper could act on.
      </p>

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
            <dt>Cites now</dt>
            <dd>{item.cites}</dd>
          </dl>
          {item.found && (
            <>
              <p className="cite-found-head">Read in {item.found.read}:</p>
              <ul className="cite-found">
                {item.found.says.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </>
          )}
          {item.asks.length > 0 && (
            <>
              <p className="cite-asks-head">Still open:</p>
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
          No flag fires on a “watch” <em>threshold</em> any more. Every wind profile used to carry
          one — the student caution minus 2 kt, the waiver tiers minus 3 mph — so a card could be
          honestly sourced and still warn you first on a number of the app’s own. Those bands are
          gone; the wind flags fire at the published limit or not at all. The <strong>Watch</strong>{' '}
          badge is still in use, on the two flags that fire on a reported condition rather than on
          a number: MVFR flight category (AIM 7-1-7) and an overcast layer (14 CFR 105.17). Nothing
          to rule on there — it is noted so a Watch badge on the dashboard does not read as a
          leftover.
        </p>
        <p className="muted small">
          The club waiver tiers (0–5 jumps: 15 mph wind / 16 mph gust · 6–10: 16/18 · 10–20: 18/19 ·
          21+: 18/20) are transcribed from the club’s posted policy and are <strong>not</strong> app
          heuristics — but confirm the transcription matches the current posted waiver.
        </p>
      </Panel>

      <h2 className="cite-heading">How each source was read</h2>
      <p className="muted small cite-intro">
        The SIM as uspa.org served it on 2026-09-22. The two CFR sections through the eCFR API on
        2026-09-23 — Title 14 as current on 2026-09-21 — which serves the text the linked pages
        render; the pages themselves answer a script with a bot check. AIM 7-1-7 from the HTML
        edition on faa.gov on 2026-09-23, Change 3, effective 2026-07-09. FAA-P-8740-2 from the
        linked PDF on 2026-09-23: the 2008 AFS-8 edition, eight pages, sitting in a FAASTeam event
        folder rather than a catalogue — no other FAA home for it was found, so if the link dies
        the pamphlet is what to search for.
      </p>
      <p className="muted small cite-intro">
        None of that is a check by a person who holds the rating. Every entry above still ends in a
        verdict line for that reason.
      </p>

      <footer className="app-foot">
        <a href="#">← Back to the dashboard</a>
      </footer>
    </div>
  );
}
