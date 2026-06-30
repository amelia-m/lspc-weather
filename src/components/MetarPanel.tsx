import type { CurrentConditions } from '../domain/types';
import { compass, fmtSpeed, round, type SpeedUnit } from '../domain/units';
import { Panel } from './common/Panel';
import { fmtTime } from './format';
import { SITE } from '../config/site';
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
