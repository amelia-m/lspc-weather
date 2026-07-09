import type { SourceStatus, TafForecast } from '../domain/types';
import { compass } from '../domain/units';
import { haversineMiles, initialBearingDeg } from '../domain/geo';
import { SITE } from '../config/site';
import { DATA_SOURCES } from '../config/sources';
import { Panel } from './common/Panel';
import { fmtClock } from './format';

export function TafPanel({
  taf,
  status,
}: {
  taf: TafForecast | null;
  status: SourceStatus;
}): JSX.Element {
  const { dz, tafStations } = SITE;
  const primary = tafStations[0];
  // The chain reports which station's TAF it found; fall back to the primary
  // for labeling when there is no TAF at all.
  const st = tafStations.find((s) => s.id === taf?.station) ?? primary;
  const miles = Math.round(haversineMiles(dz.lat, dz.lon, st.lat, st.lon));
  const bearing = compass(initialBearingDeg(dz.lat, dz.lon, st.lat, st.lon));

  return (
    <Panel
      title="TAF (forecast)"
      subtitle={taf ? `${st.id} · ~${miles} mi ${bearing} of DZ` : 'nearest available'}
      sources={[DATA_SOURCES.taf]}
    >
      <p className="muted small">
        Terminal Aerodrome Forecast for {st.name} ({st.id}), ~{miles} mi {bearing} of the drop zone
        (KPMV issues no TAF). Regional guidance, not field-specific to NE69.
      </p>
      {taf && taf.station !== primary.id && (
        <p className="muted small">
          {primary.id} ({primary.name}) had no TAF on the NWS feed — its USAF-issued TAF isn&rsquo;t
          always carried there — so this is the next-nearest station.
        </p>
      )}
      {!taf ? (
        <p className="muted">
          {status.error
            ? `TAF unavailable — ${status.error}. Retrying automatically; the raw TAF is on the AWC link below.`
            : status.pending
              ? 'Fetching TAF…'
              : `No TAF available from ${tafStations.map((s) => s.id).join(', ')}.`}
        </p>
      ) : (
        <>
          <dl className="kv">
            <dt>Issued</dt>
            <dd>{taf.issuedMs != null ? fmtClock(taf.issuedMs) : '—'}</dd>
            <dt>Valid</dt>
            <dd>{taf.validRaw ? `${taf.validRaw} (UTC day/hr)` : '—'}</dd>
          </dl>
          <pre className="metar-raw">{taf.raw}</pre>
        </>
      )}
    </Panel>
  );
}
