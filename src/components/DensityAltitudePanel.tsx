import type { DensityAltitudeResult } from '../domain/types';
import { fmtTempDelta, type TempUnit } from '../domain/units';
import { Panel } from './common/Panel';
import { SourceLink } from './common/SourceLink';
import { CITATIONS } from '../config/thresholds';
import { DATA_SOURCES } from '../config/sources';

export function DensityAltitudePanel({
  da,
  tempUnit = 'F',
  onTempUnitChange,
}: {
  da: DensityAltitudeResult | null;
  /** Page-wide temperature unit and its setter, for the card's °F/°C switch.
   *  Optional so a test can render the card without them; App passes both. */
  tempUnit?: TempUnit;
  onTempUnitChange?: (u: TempUnit) => void;
}): JSX.Element {
  return (
    <Panel
      className="panel-secondary"
      title="Density altitude"
      subtitle="C-182 climb performance"
      sources={[DATA_SOURCES.iemObservation, DATA_SOURCES.nwsObservation]}
      tempUnit={tempUnit}
      onTempUnitChange={onTempUnitChange}
    >
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
            <dd>{fmtTempDelta(da.isaDeviationC, tempUnit, true, 1)}</dd>
          </dl>
          {/* This used to reach the reader as a flag that fired once DA ran
              2,000–4,000 ft above the field — bands nobody published. The claim
              itself is FAA-cited and holds at any DA, so it stands here under
              the figure rather than appearing only past an invented threshold.
              The number above is the reading; judging it is the reader's job,
              with the PIC's. */}
          <p className="muted small">
            High density altitude reduces a loaded jump plane’s climb performance — expect longer
            climbs to altitude.{' '}
            {da.humidityCorrected
              ? 'Humidity-corrected (virtual temperature).'
              : 'Dry-air estimate (no dew point available).'}{' '}
            Source: <SourceLink citation={CITATIONS.faaDensityAltitude} />
          </p>
        </>
      )}
    </Panel>
  );
}
