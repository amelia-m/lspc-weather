import { USPA_CANOPY_RISK_QUOTIENT } from '../config/canopies';
import { Panel } from './common/Panel';

/**
 * A pointer to USPA's Canopy Risk Quotient, on the Canopy tab (the
 * maintainer, 2026-11-24: "link this page"; its own card since the tab,
 * 2026-11-25). USPA's questionnaire scores the jumper, which this site does
 * not: the card says what the quiz is and whose, works no score and repeats
 * none of USPA's bands. A link, not a citation (`USPA_CANOPY_RISK_QUOTIENT`).
 */
export function CanopyRiskPanel(): JSX.Element {
  return (
    <Panel title="Canopy Risk Quotient" subtitle="USPA’s self-assessment">
      <p>
        A questionnaire on experience, currency, the canopy and training, scored on USPA&rsquo;s page. This site
        works none of it.
      </p>
      <p>
        <a href={USPA_CANOPY_RISK_QUOTIENT.url} target="_blank" rel="noopener noreferrer">
          {USPA_CANOPY_RISK_QUOTIENT.label}
        </a>
      </p>
    </Panel>
  );
}
