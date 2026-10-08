import { METAR_STATION_OFFSET, SITE } from '../config/site';

/**
 * The banner above the advisories on both tabs.
 *
 * What stays in view is what every reader needs before acting on anything
 * below it: nobody has endorsed this, it decides nothing, its cited limits
 * are readings rather than a professional's sign-off, and who does decide.
 * The provenance behind that (when the citations were read, that the club
 * tiers come from a photo, where the observation is taken) is in a section
 * closed by default. It is detail for a reader checking a value,
 * and printed in full it pushed the advisories down a phone screen.
 */
export function DashboardDisclaimer(): JSX.Element {
  return (
    <div className="disclaimer">
      <p>
        <strong>
          In development: not endorsed or approved by USPA, LSPC, or any licensed professional.
        </strong>{' '}
        Advisory only. This dashboard flags conditions and cites guidance; it does not decide
        whether it is safe to jump. Its cited limits are readings of the sources, not a licensed
        professional&rsquo;s sign-off: verify each against its source before relying on it (the{' '}
        <a href="#citations">citations page</a> lists them). Always confirm conditions with current
        official sources, the S&amp;TA, and the pilot in command.
      </p>
      <details className="disclaimer-more">
        <summary>About the sources</summary>
        <p>
          The citations to the USPA SIM, the CFRs and the FAA began as AI recollections and were
          read at their sources on 2026-09-22 and 2026-09-23 (one SIM section on 2026-10-08); the club wind tiers are transcribed
          from an undated photo of the posted sign. The citations page records what each source
          says and what a reading could not settle.
        </p>
        <p>
          Observations are from {SITE.metarStation.id} (~{Math.round(METAR_STATION_OFFSET.distanceMi)} mi{' '}
          {METAR_STATION_OFFSET.compass}); forecasts and winds are gridded to the drop zone.
        </p>
      </details>
    </div>
  );
}
