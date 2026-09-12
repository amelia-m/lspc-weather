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
  confidence: string;
  asks: string[];
}

/** Claims needing someone with a current SIM open. Ordered by what a jumper
 *  could act on: the wind limit and opening altitudes decide who gets on the
 *  plane; the weather flags are awareness aids. */
const LOOKUPS: Lookup[] = [
  {
    id: 'A1',
    title: 'Student ground-wind limit',
    onScreen:
      'USPA recommends max ~14 mph (~12 kt) ground winds for solo students on ram-air reserves.',
    value: '14 mph, stored as 12 kt · caution at 12 kt, watch at 10 kt',
    where: 'Surface wind card, and the Surface wind flag, with Student selected',
    cites: 'USPA SIM, Section 2-1 (BSR)',
    confidence: 'Section: high · Wording: low',
    asks: [
      'Is Section 2-1 the Basic Safety Requirements? Everything else here depends on it.',
      'Does the app say “recommends” where the SIM states a requirement? The club waiver treats this limit as needing instructor approval to exceed, which a recommendation would not.',
      'Is “on ram-air reserves” backwards? The canopy-type distinction may historically have run the other way, with the lower limit applying to rounds.',
    ],
  },
  {
    id: 'A2',
    title: 'Minimum opening altitudes',
    onScreen:
      'USPA BSR minimum container-opening altitudes: students & A-license 3,000 ft AGL, B-license 2,500 ft, C/D 2,000 ft (tandem 5,000 ft). These are floors — deploy above your minimum, not at it.',
    where: 'Freefall drift / spot card. Also sets the Deploy dropdown default.',
    cites: 'USPA SIM, Section 2-1 (BSR)',
    confidence: 'Section: high · Figures: medium',
    asks: [
      'Verify the tandem 5,000 ft figure specifically — tandem minimums have moved across recent SIM editions, and this number is printed to users.',
      'The Deploy default is 2,500 ft for “licensed”, the B-licence floor, even though C/D is 2,000 ft. Deliberately conservative and user-changeable — confirm it is not confusing.',
    ],
  },
  {
    id: 'A3',
    title: 'Night jumps — a claim with no supporting citation',
    onScreen:
      'Parachute ops between sunset and sunrise require a light visible for at least 3 statute miles (14 CFR 105.19); USPA also requires a B license (min 50 jumps) for night jumps.',
    where: 'Conditions to note, after sunset',
    cites: '14 CFR 105.19 only',
    confidence: 'None — section unknown',
    asks: [
      'One sentence, two authorities, one source. 14 CFR 105.19 is a lighting rule and says nothing about USPA, B licences or 50 jumps — so the half deciding whether you personally may jump is uncited.',
      'Which SIM section carries the night-jump licence requirement, and is “B licence, minimum 50 jumps” accurate?',
      'Does USPA define night at civil sunset? The flag fires the moment the sun sets because that is the FAA trigger. If USPA uses a different boundary, the app asserts a USPA rule at an FAA timestamp.',
    ],
  },
  {
    id: 'A4',
    title: 'No USPA wind limit for licensed jumpers — verifying an absence',
    onScreen:
      'No USPA hard wind limit for licensed jumpers — included for awareness; consider canopy size and currency.',
    value: 'Watch 17 kt, caution 25 kt — both app-invented, see Part B',
    where: 'Surface wind card with Licensed selected',
    cites: 'USPA SIM, Section 2-1 (BSR), cited for the absence of a limit',
    confidence: 'Section: high · The absence claim: medium',
    asks: [
      'Confirm the BSRs really state no wind limit for licensed jumpers. An absence is easy to get wrong and hard to notice.',
    ],
  },
  {
    id: 'A5',
    title: 'The BSR-excursion rule behind the club waiver',
    onScreen:
      'Any excursion above the USPA BSR requires on-site approval by a USPA instructor; consult the S&TA.',
    where: 'Surface wind card and wind flags, with any LSPC waiver tier selected',
    cites: 'LSPC waivered wind limits (club policy)',
    confidence: 'Section: medium',
    asks: [
      'Citing club policy is right for the sentence as printed, since it is quoted from the club document.',
      'But the mechanism underneath — that a student wind limit exists in the BSRs and an instructor may authorise exceeding it — is a SIM claim, and it decides whether a student gets on the plane. Likely wants a dual citation.',
    ],
  },
  {
    id: 'A6',
    title: 'General weather guidance — which section, if any?',
    onScreen: 'Source line reads “USPA SIM” and links to the table of contents',
    where: 'Weather-related flags in Conditions to note',
    cites: 'uspa.org/sim — no section',
    confidence: 'None — deliberately not guessed',
    asks: [
      'The BSRs govern winds, opening altitudes and cloud clearance. None of those cover “it is gusty” or “40% chance of storms”, so the section carrying general weather guidance is unidentified and the link stays on the contents page rather than claiming a precision it lacks.',
      'Which section or sections govern this? It probably splits — turbulence and canopy flight in wind is a different subject from convection, which is different again from spotting.',
    ],
  },
  {
    id: 'A7',
    title: 'Exit separation and spotting in strong upper winds',
    onScreen:
      'Strong upper winds increase freefall drift and lengthen the spot — plan jump run and exit separation accordingly.',
    where: 'Winds aloft flag in Conditions to note',
    cites: 'USPA SIM contents page',
    confidence: 'That some section covers it: moderate-high · Which one: none',
    asks: [
      'An operational instruction with real collision consequences, sourced to a document index. If the SIM covers exit or group separation, it should point there.',
    ],
  },
];

interface Heuristic {
  id: string;
  what: string;
  value: string;
  where: string;
}

/** Numbers the app invented. Not claimed to come from USPA or the FAA — the
 *  question is whether they are sensible for this DZ, which is an instructor's
 *  judgement rather than a lookup. */
const HEURISTICS: Heuristic[] = [
  { id: 'B1', what: 'Licensed wind watch / caution', value: '17 kt / 25 kt', where: 'Surface wind, Licensed' },
  { id: 'B2', what: 'Gust spread → “Gusty wind”', value: '8 kt students, 10 kt licensed', where: 'Gusty wind flag' },
  { id: 'B3', what: 'Ceiling watch / caution', value: '5,000 / 3,000 ft students · 4,000 / 2,500 ft licensed', where: 'Ceiling flag' },
  { id: 'B4', what: 'Density altitude excess', value: '2,000 / 3,500 ft students · 2,500 / 4,000 ft licensed', where: 'Density altitude flag' },
  { id: 'B5', what: 'Last load before sunset', value: '45 min students, 30 min licensed', where: 'Daylight flag' },
  { id: 'B6', what: 'Precipitation chance', value: 'watch 25%, caution 50%', where: 'Precipitation flag' },
  { id: 'B7', what: 'Thunderstorm chance', value: 'watch 10%, caution 30%', where: 'Thunderstorm flag' },
  { id: 'B8', what: 'Fog / dew-point spread', value: 'watch 3 °C, caution 1 °C', where: 'Fog / low cloud flag' },
  { id: 'B9', what: 'Winds aloft info / watch', value: '20 kt / 30 kt', where: 'Winds aloft flag' },
  { id: 'B10', what: 'Winds aloft shown in red', value: '≥ 30 kt', where: 'Winds aloft table' },
  { id: 'B11', what: 'Daily gust highlighted', value: '≥ 25 kt', where: '10-day outlook' },
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

      <h2 className="cite-heading">Part A · needs a current SIM</h2>
      <p className="muted small cite-intro">
        Section numbers, and whether the rule says what we claim. Ordered by what a jumper could act
        on.
      </p>

      {LOOKUPS.map((item) => (
        <Panel key={item.id} title={`${item.id} · ${item.title}`} subtitle={item.confidence}>
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
        FAA — the question is whether they are sensible for this drop zone. B9–B11 are worth
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
