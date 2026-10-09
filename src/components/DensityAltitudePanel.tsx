import type { DensityAltitudeResult } from '../domain/types';
import { fmtTemp, fmtTempDelta, type TempUnit } from '../domain/units';
import { Panel } from './common/Panel';
import { SourceLink } from './common/SourceLink';
import { CITATIONS } from '../config/thresholds';
import { DATA_SOURCES } from '../config/sources';

/** A difference with its sign. "Above field" goes negative on a cold,
 *  high-pressure day, which a bare "+" printed as "+-361". */
const fmtSigned = (ft: number): string => `${ft >= 0 ? '+' : ''}${ft.toLocaleString()}`;


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
          {/* The dry figure is the headline: FAA-P-8740-2's density altitude,
              from pressure and temperature, the one the pilot in command
              works out. The humidity figure is a row of its own, named, so
              a reader comparing the headline with their own never meets a
              correction they did not make (src/domain/densityAltitude.ts). */}
          <div className="da-readout">
            <span className="da-big">{da.densityAltitudeFt.toLocaleString()}</span>
            <span className="da-unit">ft DA</span>
          </div>
          <dl className="kv">
            <dt>Field elevation</dt>
            <dd>{da.fieldElevationFt.toLocaleString()} ft</dd>
            <dt>Above field</dt>
            <dd>{fmtSigned(da.densityAltitudeFt - da.fieldElevationFt)} ft</dd>
            <dt>Pressure altitude</dt>
            <dd>{da.pressureAltitudeFt.toLocaleString()} ft</dd>
            <dt>Station pressure</dt>
            <dd>{da.stationPressureInHg.toFixed(2)} inHg</dd>
            {/* To a tenth, unlike the whole degrees the other cards print:
                these are the values the figures were worked from, which a
                reader re-working them in the NWS calculator needs, and half
                a degree moves the result about 30 ft. */}
            <dt>Temperature</dt>
            <dd>{fmtTemp(da.oatC, tempUnit, 1)}</dd>
            <dt>ISA deviation</dt>
            <dd>{fmtTempDelta(da.isaDeviationC, tempUnit, true, 1)}</dd>
            <dt>Dew point</dt>
            <dd>{da.dewpointC == null ? 'not reported' : fmtTemp(da.dewpointC, tempUnit, 1)}</dd>
            <dt>With humidity</dt>
            <dd>
              {da.humidDensityAltitudeFt == null ? '–' : `${da.humidDensityAltitudeFt.toLocaleString()} ft`}
            </dd>
          </dl>
          {/* This used to reach the reader as a flag that fired once DA ran
              2,000–4,000 ft above the field — bands nobody published. The claim
              itself is FAA-cited and holds at any DA, so it stands here under
              the figure rather than appearing only past an invented threshold.
              The number above is the reading; judging it is the reader's job,
              with the PIC's. */}
          <p className="muted small">
            High density altitude reduces a loaded jump plane’s climb performance — expect longer
            climbs to altitude. The headline is the FAA’s density altitude, “pressure altitude
            corrected for nonstandard temperature variations”, which leaves humidity out; when
            humidity is high, the same pamphlet says to “add 10 percent to your computed takeoff
            distance and anticipate a reduced climb rate”. Source:{' '}
            <SourceLink citation={CITATIONS.faaDensityAltitude} />
          </p>
          <p className="muted small">
            Both figures are worked with the National Weather Service calculators’ formulas: the
            altimeter setting reduced to the station pressure at the field, the pressure altitude
            from it, then the density altitude. Given the station pressure, temperature and dew point
            above, the NWS calculator gives the humidity row to within about ten feet (the rows are
            rounded); the headline is its formula with the temperature in place of the virtual
            temperature. Source:{' '}
            <SourceLink citation={CITATIONS.nwsDensityAltitude} />
          </p>
        </>
      )}
    </Panel>
  );
}
