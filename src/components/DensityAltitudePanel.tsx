import type { DensityAltitudeResult } from '../domain/types';
import { Panel } from './common/Panel';
import { SourceLink } from './common/SourceLink';
import { CITATIONS } from '../config/thresholds';

export function DensityAltitudePanel({
  da,
}: {
  da: DensityAltitudeResult | null;
}): JSX.Element {
  return (
    <Panel title="Density altitude" subtitle="C-182 climb performance">
      {!da ? (
        <p className="muted">Needs altimeter + temperature from the METAR.</p>
      ) : (
        <>
          <div className="da-readout">
            <span className="da-big">{da.densityAltitudeFt.toLocaleString()}</span>
            <span className="da-unit">ft DA</span>
          </div>
          <dl className="kv">
            <dt>Field elevation</dt>
            <dd>{da.fieldElevationFt.toLocaleString()} ft</dd>
            <dt>Above field</dt>
            <dd>+{(da.densityAltitudeFt - da.fieldElevationFt).toLocaleString()} ft</dd>
            <dt>Pressure altitude</dt>
            <dd>{da.pressureAltitudeFt.toLocaleString()} ft</dd>
            <dt>ISA deviation</dt>
            <dd>
              {da.isaDeviationC >= 0 ? '+' : ''}
              {da.isaDeviationC}°C
            </dd>
          </dl>
          <p className="muted small">
            Higher DA = slower climb for a loaded jump plane. Source:{' '}
            <SourceLink citation={CITATIONS.faaDensityAltitude} />
          </p>
        </>
      )}
    </Panel>
  );
}
