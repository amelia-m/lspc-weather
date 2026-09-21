import { Panel } from './common/Panel';

/**
 * The verification checklist, as a page a jumper or instructor can actually
 * open from a phone at the DZ.
 *
 * Every USPA reference in this dashboard was derived by an AI assistant and
 * none has been checked against a current SIM — the environment the code was
 * written in cannot reach uspa.org. Rather than let that sit as a footnote, this
 * page names each unverified claim and the number behind it, so the check can be
 * done by someone holding the real document.
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
  asks: string[];
}

/** Claims needing someone with a current SIM open.
 *
 *  Each entry states only what can be checked without leaving this repo: the
 *  sentence the app attaches to the claim, the number behind it, where it
 *  appears (or that it currently appears nowhere), and what it links to. The
 *  open items are written as questions rather than suspicions — an AI
 *  recollection of what a SIM section says is not evidence, and putting one in
 *  front of an instructor as though it were would repeat the problem this page
 *  exists to fix. */
const LOOKUPS: Lookup[] = [
  {
    id: 'A1',
    title: 'Student ground-wind limit',
    claim:
      'USPA recommends max ~14 mph (~12 kt) ground winds for solo students on ram-air reserves.',
    value: '14 mph, stored as 12 kt — the caution band',
    where: 'Surface wind card, and the Surface wind flag, with Student selected',
    cites: 'USPA SIM, Section 2-1 (BSR)',
    asks: [
      'Is Section 2-1 the Basic Safety Requirements, and is 14 mph the figure it states?',
      'The app says USPA “recommends” this. Does the SIM state it as a requirement? The club’s own waiver document reads “All excursion from the wind limits stated in the BSRs shall be approved on site”, which describes a limit rather than a recommendation.',
      'Does the limit depend on canopy type, and if so in which direction? The app qualifies it “on ram-air reserves”.',
    ],
  },
  {
    id: 'A2',
    title: 'Minimum opening altitudes',
    claim:
      'USPA BSR minimum container-opening altitudes: students & A-license 3,000 ft AGL, B-license 2,500 ft, C/D 2,000 ft (tandem 5,000 ft). These are floors — deploy above your minimum, not at it.',
    where: 'Freefall drift / spot card. Also sets the Deploy dropdown default.',
    cites: 'USPA SIM, Section 2-1 (BSR)',
    asks: [
      'Are all four figures current?',
      'Is the tandem figure set by the SIM, by the manufacturer, or both? It is printed to users as a BSR minimum.',
      'The Deploy default is 2,500 ft for “licensed” — the B-licence floor — even though C/D is 2,000 ft. It is deliberately conservative and the user can change it; confirm it is not confusing.',
    ],
  },
  {
    id: 'A3',
    title: 'Night jumps',
    claim:
      'Parachute ops between sunset and sunrise require a light visible for at least 3 statute miles (14 CFR 105.19); USPA also requires a B license (min 50 jumps) for night jumps.',
    where: 'Conditions to note, after sunset',
    cites: '14 CFR 105.19 — the only link offered, for both halves of the sentence',
    asks: [
      'The sentence makes two claims from two authorities and offers one source. Does 14 CFR 105.19 support the USPA licence claim? If not, which SIM section does, and is “B license, minimum 50 jumps” accurate?',
      'Does USPA define a night jump as beginning at civil sunset? The flag fires the moment the sun sets, because that is the 14 CFR 105.19 trigger.',
    ],
  },
  {
    id: 'A4',
    title: 'No USPA wind limit for licensed jumpers',
    claim:
      'No USPA hard wind limit for licensed jumpers — the BSR ground-wind limit is written for students. Judge it on your canopy, your currency and the conditions, with the S&TA. Whether the load flies is a separate question: takeoff limits come from the aircraft’s operating limitations and the pilot in command, not from USPA — ask the PIC.',
    where:
      'Surface wind card with Licensed selected — a standing note under the reading, at any wind speed. It used to reach the reader only through a flag that fired on a number the app invented; that flag is gone, so the claim now stands on its own.',
    cites: 'USPA SIM, Section 2-1 (BSR), cited for the absence of a limit',
    asks: [
      'Do the BSRs state a wind limit that applies to licensed jumpers? The app asserts they do not, and an absence is easy to get wrong.',
      'If the BSRs DO set a limit that applies to licensed jumpers, this is the most consequential error on the page: no surface-wind flag fires on that profile at any speed, so the app would be silent exactly where it should warn.',
      'The second half — that takeoff limits belong to the aircraft and the PIC rather than to USPA — is cited to the same BSR section. Is that the right authority for it, or should it cite nothing and simply point at the PIC?',
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
    asks: [
      'The sentence is quoted from the club document, so citing club policy matches what is printed.',
      'The rule underneath it is a SIM one: that a student wind limit exists in the BSRs and an instructor may authorise exceeding it. Should this cite the SIM as well?',
    ],
  },
  {
    id: 'A6',
    title: 'General weather guidance',
    claim: 'Source line reads “USPA SIM” and links to the table of contents',
    where: 'Thunderstorm flag (observed) in Conditions to note',
    cites: 'uspa.org/sim — no section identified',
    asks: [
      'Which SIM section, if any, covers general weather guidance — turbulence and canopy flight in wind, convection, spotting? No section has been identified, so the link goes to the contents page rather than claiming a precision it does not have.',
      'It may resolve to more than one section, in which case this citation should be split.',
    ],
  },
  {
    id: 'A7',
    title: 'Exit separation and spotting in strong upper winds',
    claim:
      'Strong upper winds increase freefall drift and lengthen the spot — plan jump run and exit separation accordingly.',
    where: 'Winds aloft card, standing note under the table',
    cites: 'uspa.org/sim — no section identified',
    asks: [
      'Does the SIM cover exit or group separation? This is an operational instruction and the link currently goes to a document index.',
      'It used to appear only once upper winds passed 20 kt — a number the app invented. It now stands on the card for any wind, so the guidance no longer depends on an unsourced trigger.',
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
            What this dashboard claims, and what nobody has checked yet ·{' '}
            <a href="#">back to the dashboard</a>
          </p>
        </div>
      </header>

      <p className="disclaimer">
        <strong>None of the USPA references in this dashboard have been verified.</strong> They were
        derived by an AI assistant, and the environment the code was written in cannot reach
        uspa.org, so no section number below was confirmed against a current SIM. This page exists
        so that check can actually happen — it names each unverified claim and the number behind it.
        Mark each one <em>correct</em>, <em>wrong section</em>, <em>wrong authority</em>, or{' '}
        <em>the claim itself is wrong</em>.
      </p>
      <p className="muted small cite-intro">
        Everything below points at a source outside this app, so every item is one you can settle
        with a document. There is no “app heuristic” line left to rule on: where nothing published
        set a number, the flag that fired on it was removed rather than relabelled. The open items
        are written as questions because a guess about what a SIM section says is not evidence, and
        putting one in front of you as though it were would repeat the problem this page exists to
        fix.
      </p>

      <h2 className="cite-heading">Part A · needs a current SIM</h2>
      <p className="muted small cite-intro">
        Section numbers, and whether the rule says what we claim. Ordered by what a jumper could act
        on.
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
          <ul className="cite-asks">
            {item.asks.map((ask) => (
              <li key={ask}>{ask}</li>
            ))}
          </ul>
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
