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
 * It is the single source of truth for that list: the app heuristics cited in
 * CITATIONS link here, so a "Source: LSPC Weather — app heuristic" line in the
 * dashboard leads to the entry explaining what the number is and is not.
 */

interface Lookup {
  id: string;
  title: string;
  onScreen: string;
  value?: string;
  where: string;
  cites: string;
  asks: string[];
}

/** Claims needing someone with a current SIM open.
 *
 *  Each entry states only what can be checked without leaving this repo: the
 *  sentence the app prints, the number behind it, where it appears, and what it
 *  currently links to. The open items are written as questions rather than
 *  suspicions — an AI recollection of what a SIM section says is not evidence,
 *  and putting one in front of an instructor as though it were would repeat the
 *  problem this page exists to fix. */
const LOOKUPS: Lookup[] = [
  {
    id: 'A1',
    title: 'Student ground-wind limit',
    onScreen:
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
    onScreen:
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
    onScreen:
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
    onScreen:
      'No USPA hard wind limit for licensed jumpers — included for awareness; consider canopy size and currency.',
    where: 'Surface wind card with Licensed selected',
    cites: 'USPA SIM, Section 2-1 (BSR), cited for the absence of a limit',
    asks: [
      'Do the BSRs state a wind limit that applies to licensed jumpers? The app asserts they do not, and an absence is easy to get wrong.',
    ],
  },
  {
    id: 'A5',
    title: 'The BSR-excursion rule behind the club waiver',
    onScreen:
      'Any excursion above the USPA BSR requires on-site approval by a USPA instructor; consult the S&TA.',
    where: 'Surface wind card and wind flags, with any LSPC waiver tier selected',
    cites: 'LSPC waivered wind limits (club policy)',
    asks: [
      'The sentence is quoted from the club document, so citing club policy matches what is printed.',
      'The rule underneath it is a SIM one: that a student wind limit exists in the BSRs and an instructor may authorise exceeding it. Should this cite the SIM as well?',
    ],
  },
  {
    id: 'A6',
    title: 'General weather guidance',
    onScreen: 'Source line reads “USPA SIM” and links to the table of contents',
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
    onScreen:
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

/** Numbers this dashboard invented that still drive something on screen.
 *
 *  Flags whose trigger had no published source at all — ceiling bands, a
 *  dew-point spread, a chance of rain, a chance of storms, a gust spread, a
 *  wind speed aloft — were removed outright rather than labelled, so they are
 *  not listed here. What remains are
 *  numbers that shape a flag or a highlight but sit alongside a real citation.
 *  The question is whether they are sensible for this DZ, which is a judgement
 *  rather than a lookup. */
const HEURISTICS: Heuristic[] = [
  { id: 'B1', what: 'Licensed wind watch / caution', value: '17 kt / 25 kt', where: 'Surface wind flag, Licensed' },
  { id: 'B2', what: 'Density altitude excess', value: '2,000 / 3,500 ft students · 2,500 / 4,000 ft licensed', where: 'Density altitude flag' },
  { id: 'B3', what: 'Last load before sunset', value: '45 min students, 30 min licensed', where: 'Daylight flag' },
  { id: 'B4', what: 'Daily gust highlighted', value: '≥ 25 kt', where: '10-day outlook' },
  { id: 'B5', what: 'Daily thunder chance highlighted', value: '≥ 30%', where: '10-day outlook' },
  {
    id: 'B6',
    what: 'Every “watch” band, including on sourced profiles',
    value: 'student: caution − 2 kt · waiver tiers: posted limit − 3 mph',
    where: 'Surface wind flag, all profiles',
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
        Everything below points at a source outside this app. Flags that fired on a number nobody
        published — ceiling bands, a dew-point spread, a chance of rain, a chance of storms — were
        removed from the dashboard rather than relabelled, because a threshold with no source is not
        something a reader can check. The open questions here are written as questions: a guess
        about what a SIM section says is not evidence, and presenting one as though it were would
        repeat the problem this page exists to fix.
      </p>

      <h2 className="cite-heading">Part A · needs a current SIM</h2>
      <p className="muted small cite-intro">
        Section numbers, and whether the rule says what we claim. Ordered by what a jumper could act
        on.
      </p>

      {LOOKUPS.map((item) => (
        <Panel key={item.id} title={`${item.id} · ${item.title}`}>
          <p className="cite-quote">{item.onScreen}</p>
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
        These numbers were invented for this dashboard. None is claimed to come from USPA or the
        FAA — the question is whether they are sensible for this drop zone. B4 and B5 are worth
        particular attention: a number shown in red is an assertion even with no words attached.
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
          <strong>B6 is worth a closer look than its row suggests.</strong> Where a profile has a
          real source — the student limit, the club waiver tiers — that source covers the{' '}
          <em>caution</em> band and the gust ceiling only. The earlier <em>watch</em> band is always
          this dashboard&rsquo;s own, derived by subtracting a couple of units. So a card can be
          honestly sourced and still be showing you a house number first.
        </p>
        <p className="muted small">
          The club waiver tiers (0–5 jumps: 15 mph wind / 16 mph gust · 6–10: 16/18 · 10–20: 18/19 ·
          21+: 18/20) are transcribed from the club’s posted policy and are <strong>not</strong> app
          heuristics — but confirm the transcription matches the current posted waiver.
        </p>
      </Panel>

      <h2 className="cite-heading">Already checked and correct</h2>
      <p className="muted small cite-intro">
        Not everything needs review. These were audited and judged right, so they are deliberately
        absent above: the 3 SM visibility floor → 14 CFR 105.17 (the rule literally says 3 SM);
        overcast / no gaps → 105.17; flight category → AIM 7-1-7; density altitude → FAA-P-8740-2
        (FAA is the correct authority here — a SIM citation would be <em>wrong</em>); and the waiver
        gust ceiling → club policy.
      </p>

      <footer className="app-foot">
        <a href="#">← Back to the dashboard</a>
      </footer>
    </div>
  );
}
