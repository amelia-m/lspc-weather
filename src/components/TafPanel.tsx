import type { TafForecast } from '../domain/types';
import { compass } from '../domain/units';
import { haversineMiles, initialBearingDeg } from '../domain/geo';
import { SITE } from '../config/site';
import { DATA_SOURCES } from '../config/sources';
import { Panel } from './common/Panel';
import { fmtClock } from './format';

export function TafPanel({ taf }: { taf: TafForecast | null }): JSX.Element {
  const { dz, tafStation: st } = SITE;
  const miles = Math.round(haversineMiles(dz.lat, dz.lon, st.lat, st.lon));
  const bearing = compass(initialBearingDeg(dz.lat, dz.lon, st.lat, st.lon));

  return (
    <Panel
      title="TAF (forecast)"
      subtitle={`${st.id} · ~${miles} mi ${bearing} of DZ`}
      sources={[DATA_SOURCES.taf]}
    >
      <p className="muted small">
        Terminal Aerodrome Forecast for {st.name} ({st.id}) — the nearest TAF station, ~{miles} mi{' '}
        {bearing} of the drop zone (KPMV issues no TAF). Regional guidance, not field-specific to
        NE69.
      </p>
      {!taf ? (
        <p className="muted">No TAF available.</p>
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
