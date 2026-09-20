import type { CurrentConditions } from '../domain/types';
import { compass, fmtSpeed, round, type SpeedUnit } from '../domain/units';
import { relativeHumidity } from '../domain/humidity';
import { Panel } from './common/Panel';
import { fmtTime } from './format';
import { METAR_STATION_OFFSET, SITE } from '../config/site';
import { DATA_SOURCES } from '../config/sources';

export function MetarPanel({
  current,
  unit,
}: {
  current: CurrentConditions | null;
  unit: SpeedUnit;
}): JSX.Element {
  return (
    <Panel
      title="Current conditions"
      subtitle={
        current ? `${current.station} · obs ${fmtTime(current.observedAt)}` : SITE.metarStation.id
      }
      sources={[DATA_SOURCES.nwsObservation]}
    >
      {!current ? (
        <p className="muted">No METAR available.</p>
      ) : (
        <>
          {/* Spell out the station behind the ICAO id — "KPMV" alone says nothing
              to a jumper who hasn't memorised the identifier. Only label it from
              config when the observation really is the configured station; a
              METAR from anywhere else must not inherit KPMV's name. */}
          {current.station === SITE.metarStation.id && (
            <p className="muted small station-name">
              {SITE.metarStation.name} ·{' '}
              <span>
                ~{round(METAR_STATION_OFFSET.distanceMi)} mi {METAR_STATION_OFFSET.compass} of the
                DZ
              </span>
            </p>
          )}
          <dl className="kv">
            <dt>Wind</dt>
            <dd>{describeWind(current, unit)}</dd>
            <dt>Visibility</dt>
            <dd>{current.visibilitySm != null ? `${round(current.visibilitySm, 1)} SM` : '—'}</dd>
            <dt>Sky</dt>
            <dd>{describeSky(current)}</dd>
            <dt>Temp / Dew</dt>
            <dd>
              {fmtC(current.tempC)} / {fmtC(current.dewpointC)}
            </dd>
            <dt>Humidity</dt>
            <dd>{describeHumidity(current)}</dd>
            <dt>Altimeter</dt>
            <dd>{current.altimeterInHg != null ? `${current.altimeterInHg.toFixed(2)} inHg` : '—'}</dd>
          </dl>
          <pre className="metar-raw">{current.raw}</pre>
        </>
      )}
    </Panel>
  );
}

function describeWind(c: CurrentConditions, unit: SpeedUnit): string {
  const { directionDeg, speedKt, gustKt } = c.wind;
  if (speedKt == null) return '— (not reported)';
  if (speedKt === 0) return 'Calm';
  const dir = directionDeg != null ? `${compass(directionDeg)} (${directionDeg}°)` : 'variable';
  const g = gustKt != null ? `, gusting ${fmtSpeed(gustKt, unit)}` : '';
  return `${dir} ${fmtSpeed(speedKt, unit)}${g}`;
}

function describeSky(c: CurrentConditions): string {
  if (c.skyLayers.length === 0) return 'Clear';
  return c.skyLayers
    .map((l) => (l.baseFtAgl != null ? `${l.cover} ${l.baseFtAgl.toLocaleString()} ft` : l.cover))
    .join(', ');
}

const fmtC = (c: number | null): string => (c != null ? `${round(c)}°C` : '—');

/** RH % and the temp–dew point spread, both as measured. No verdict attached. */
function describeHumidity(c: CurrentConditions): string {
  if (c.tempC == null || c.dewpointC == null) return '—';
  const rh = round(relativeHumidity(c.tempC, c.dewpointC));
  // Spread in °C to match the Temp / Dew row above (both shown in °C).
  const spreadC = round(c.tempC - c.dewpointC);
  // No "fog favorable" verdict: that fired at a 3 °C spread, the same number
  // behind the fog flag that was removed for having no published source. The
  // RH and the spread are measurements — they stand on their own, and a reader
  // who knows what a tight spread means does not need the app to decide where
  // "tight" begins.
  return `${rh}% RH · ${spreadC}°C spread`;
}
