import { PILOT_LINKS } from '../config/sources';
import { Panel } from './common/Panel';

/**
 * Where a pilot briefs from, one link each: NOTAMs, TFRs, nearby METARs,
 * PIREPs, the GFA, SIGMETs and the Chart Supplement. This site cannot read
 * NOTAMs or TFRs itself (FAA's NOTAM API needs a key, and none of these
 * pages can be read from a browser on another site), so it links to the
 * services that answer for them rather than summarising them. A briefing is
 * the pilot in command's; nothing here stands in for one.
 */
export function PilotLinksPanel(): JSX.Element {
  return (
    <Panel title="Pilot briefing links" subtitle="FAA and aviationweather.gov">
      <ul className="pilot-links">
        {PILOT_LINKS.map((l) => (
          <li key={l.url}>
            <a href={l.url} target="_blank" rel="noopener noreferrer">
              {l.label}
            </a>
            <span className="muted small"> {l.note}</span>
          </li>
        ))}
      </ul>
      <p className="muted small">
        Links only: these services answer for what they show. A standard briefing comes from
        Flight Service.
      </p>
    </Panel>
  );
}
