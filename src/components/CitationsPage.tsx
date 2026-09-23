import { Panel } from './common/Panel';

/**
 * The verification checklist, as a page a jumper or instructor can actually
 * open from a phone at the DZ.
 *
 * Every USPA reference in this dashboard began as an AI recollection, written
 * in an environment that could not reach uspa.org. On 2026-09-22 that changed:
 * the SIM sections behind these claims were fetched from uspa.org and read, and
 * each entry below now records what the section says rather than asking whether
 * it exists. Two claims were wrong and are fixed; two citations that pointed at
 * the SIM contents page now name sections.
 *
 * That is a smaller thing than it sounds, and the entries say so where it
 * matters. What was read is the SIM as the website served it on one day, not a
 * printed edition, and USPA revises it. Reading a rule is also not the same as
 * knowing how a DZ applies it — the remaining `asks` are the questions that
 * still need an instructor rather than a document.
 *
 * Nothing in the dashboard links here, and that is the point: there is no
 * "Source: LSPC Weather — app heuristic" line left to follow. A threshold no
 * published source sets no longer raises a flag at all (thresholds.ts, rule 3),
 * so this page is reached from the footer link and read as a checklist someone
 * works through — not as a glossary the dashboard defers to mid-flag.
 */

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
  found?: string[];
  /** What is still open. An entry keeps its asks after a reading when the
   *  reading did not settle them — a section can confirm a number and still
   *  leave how the DZ applies it to an instructor. */
  asks: string[];
}

/** The claims, what the cited section says, and what is still open.
 *
 *  Each entry states the sentence the app attaches to the claim, the number
 *  behind it, where it appears (or that it currently appears nowhere), and what
 *  it links to. `found` records what the section said when it was read on
 *  2026-09-22; `asks` is what a reading could not settle. Where a reading
 *  contradicted the app, the entry says what was wrong and what changed, rather
 *  than quietly reading as though the app had been right all along. */
const LOOKUPS: Lookup[] = [
  {
    id: 'A1',
    title: 'Student ground-wind limit',
    claim:
      'USPA BSR maximum ground winds for solo students: 14 mph (~12 kt) on ram-air canopies, 10 mph on round reserves. An S&TA or Examiner may waive it on site.',
    value: '14 mph, stored as 12 kt — the caution band',
    where: 'Surface wind card, and the Surface wind flag, with Student selected',
    cites: 'USPA SIM, Section 2-1 (BSR)',
    found: [
      'Section 2-1 is the Basic Safety Requirements, and 2-1 H (“Winds”) reads: “Maximum ground winds — For all solo students [S] — 14 mph for ram-air canopies, 10 mph for round reserves.” The 14 mph figure is confirmed.',
      'It is stated as a maximum, not a recommendation. The app said USPA “recommends” it; that wording is gone. The [S] marking means it is waiverable by an S&TA or Examiner (SIM 2-2 B), which is what the club document means by “approved on site”.',
      'The canopy qualifier was slightly off: the BSR pairs 14 mph with ram-air canopies and 10 mph with round reserves. The app said “on ram-air reserves”. Both figures are now shown.',
    ],
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
    found: [
      'The app was wrong about C/D. BSR 2-1 I reads: “Tandem jumps: 5,000 feet AGL [E]; All students and A-license holders: 3,000 feet AGL [E]; B-license holders: 2,500 feet AGL [E]; C- and D-license holders: 2,500 feet AGL [S] (waiverable to no lower than 2,000 feet AGL).” The app printed a flat 2,000 ft for C/D, which is the waiver floor, not the BSR minimum. Corrected on the card. (The bracketed letters are the BSR’s waiverability markers — [E] the Executive Committee, [S] an S&TA or Examiner; see 2-2 B.)',
      'SIM 2-2 C corroborates the direction, describing an S&TA waiving the deployment altitude “from 2,500 feet down to 2,000 feet”, and notes this is the one S&TA waiver that needs no written filing.',
      'Tandem 5,000 ft, students & A 3,000 ft and B 2,500 ft are all as the app stated.',
    ],
    asks: [
      'The Deploy default is 2,500 ft for “licensed”. That is now both the B and the C/D BSR figure, so it is no longer conservative relative to C/D — confirm the default still reads sensibly.',
      'Is the tandem figure set by the SIM, by the manufacturer, or both? It is printed to users as a BSR minimum.',
    ],
  },
  {
    id: 'A3',
    title: 'Night jumps',
    claim:
      'Parachute ops between sunset and sunrise require a light visible for at least 3 statute miles (14 CFR 105.19). USPA counts any jump between official sunset and sunrise as a night jump, and says participants should meet USPA B-licence requirements — see SIM 5-3.',
    where: 'Conditions to note, after sunset',
    cites: '14 CFR 105.19 for the light; USPA SIM 5-3 (Night Jumps) for the USPA claim',
    found: [
      'The flag used to make both claims and offer only 14 CFR 105.19 — a reg about lighting an aircraft and a jumper, which is not where a licence requirement would live. It now carries a second citation to SIM 5-3, which is. Note this entry cannot say what 105.19 does or does not contain: ecfr.gov is unreachable from the environment this was written in, so the CFR half remains unread.',
      'SIM 5-3 A: “Any jumps made between official sunset and official sunrise are considered night jumps.” So the flag firing at sunset matches USPA’s own definition as well as the reg’s trigger — the app’s second open question is answered.',
      'SIM 5-3 B says participants “should meet all the requirements for a USPA B or higher license” — a recommendation, not a BSR. SIM 3-1 lists performing night jumps among the B licence’s privileges and requires 50 jumps for it, so the “50 jumps” figure is right. The app said USPA “requires”; it now says “should”.',
      'Separately, BSR 2-1 G requires all student jumps to take place between official sunrise and sunset (tandem students, civil twilight).',
    ],
    asks: [
      'The 14 CFR 105.19 half has not been checked — ecfr.gov is not reachable from the environment this was written in. Only the USPA half was read.',
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
    found: [
      'This was the most consequential open item on the page, and the app has it right. BSR 2-1 H states maximum ground winds “For all solo students”, then: “For licensed skydivers are unlimited.” The absence is explicit, not inferred, so the app is not silent where a published limit exists.',
      'The guidance now quotes that phrase rather than describing the limit as merely “written for students”.',
    ],
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
    found: [
      'The SIM rule underneath it has been identified: 2-2 (“Waivers to the Basic Safety Requirements”). Each BSR is waiverable only by the full board “except for those BSRs designated as being waiverable by: S&TA or Examiner only [S]”. The student ground-wind BSR carries [S], so an S&TA may waive it — which is the authority the club document is exercising.',
      'SIM 2-2 C adds that an S&TA waiver must be filed in writing on the USPA waiver form, with copies to the Regional Director and USPA Headquarters, and remains in place until rescinded or the DZ changes hands.',
      'The sentence is quoted from the club document, so citing club policy still matches what is printed.',
    ],
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
    found: [
      'The section has been identified, so this citation no longer points at the SIM contents page. SIM 4-5 is “Weather”; its part B, “Hazardous Weather”, covers gust fronts, turbulence from gusty winds and thermals, thunderstorms generating spontaneously on calm hot humid days, and dust devils.',
      'Part A (“Determining Winds”) is the section behind the BSR pre-jump requirement, and notes that winds-aloft reports are only forecasts and can change at any time.',
      'Part C covers density altitude, including its effect on the aircraft — “slower and flatter rate of climb”, longer takeoff distances. That is a USPA source for the claim on the density-altitude card, which currently cites only the FAA pamphlet.',
    ],
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
    found: [
      'The section has been identified, so this citation no longer points at the SIM contents page. SIM 4-7 C is “Exit Separation on Jump Run”: “On days with strong upper headwinds, allow more time between groups on the same pass to get sufficient horizontal separation over the ground.”',
      'It also gives distances the app does not: at least 1,000 ft of ground separation between solo jumpers, at least 1,500 ft between small groups, more as groups grow. And that slower-falling groups, having longer exposure to upper headwinds, should exit before faster-falling groups when jump run is into the wind.',
      'The note stands on the card at any wind speed. The 20 kt trigger that used to gate it was the app’s own; 4-7 sets separation distances, not a wind speed at which to start caring, so there is nothing published to restore it from.',
    ],
    asks: [
      'Should the card print the 1,000 / 1,500 ft ground-separation figures? They are published and checkable, but they are an operational instruction rather than a weather reading, and this dashboard has so far stayed out of telling jumpers how to run a load.',
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
          These references began as AI recollections. The USPA ones have since been read; the FAA
          and CFR ones have not.
        </strong>{' '}
        Every claim below was written by an AI assistant in an environment that could not reach
        uspa.org. On 2026-09-22 the SIM sections were fetched from uspa.org and read, and each Part
        A entry now records what the section says. Two claims were wrong and are fixed. That is
        still not the same as an instructor signing this off: what was read is the website&rsquo;s
        SIM on one day, USPA revises it, and knowing a rule is not knowing how this DZ applies it.
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
        Section numbers, and whether the rule says what we claim. The SIM sections were fetched from
        uspa.org and read on 2026-09-22 — that is the website&rsquo;s SIM on one day, not a printed
        edition, and USPA revises it. Two claims were wrong and are fixed (A2, A3); two citations
        that pointed at the contents page now name sections (A6, A7). The FAA and CFR references
        remain unread: those sites were not reachable. Ordered by what a jumper could act on.
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
              <p className="cite-found-head">Read in the SIM, 2026-09-22:</p>
              <ul className="cite-found">
                {item.found.map((f) => (
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

      <h2 className="cite-heading">Why some citations are not on the list</h2>
      <p className="muted small cite-intro">
        Part A is where the <em>section number</em> is uncertain. These are absent from it because
        the authority cited looks like the right <em>kind</em> of authority for the claim: flight
        visibility and cloud clearance to 14 CFR 105.17, the flight categories to AIM 7-1-7,
        density altitude to FAA-P-8740-2 rather than to USPA — an aircraft-performance matter, so a
        SIM citation there would be citing the wrong body entirely — and the waiver gust ceiling to
        the club’s own posted policy.
      </p>
      <p className="muted small cite-intro">
        That is a judgement about attribution, reached by reading this repository. It is{' '}
        <strong>not</strong> a check against the documents, and nothing here has been read in the
        source — the same caveat that applies to every entry above. If you have the CFR or the AIM
        to hand they are still worth a glance; they are only ranked lower because a wrong body is
        easier to spot than a wrong section.
      </p>

      <footer className="app-foot">
        <a href="#">← Back to the dashboard</a>
      </footer>
    </div>
  );
}
