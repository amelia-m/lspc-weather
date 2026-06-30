import type { WindsAloftLevel } from '../domain/types';
import { compass, cToF, fmtSpeed, round, type SpeedUnit } from '../domain/units';
import { DATA_SOURCES } from '../config/sources';
import { Panel } from './common/Panel';

/** Winds aloft at jump altitudes — the skydiver-specific centerpiece. An arrow
 *  points the direction the wind is blowing TOWARD (drift direction). */
export function WindsAloftPanel({
  levels,
  unit,
}: {
  levels: WindsAloftLevel[];
  unit: SpeedUnit;
}): JSX.Element {
  return (
    <Panel
      title="Winds aloft"
      subtitle="freefall drift / spot"
      sources={[DATA_SOURCES.openMeteo, DATA_SOURCES.markschulze]}
    >
      {levels.length === 0 ? (
        <p className="muted">No winds-aloft data.</p>
      ) : (
        <table className="aloft-table">
          <thead>
            <tr>
              <th>Alt (AGL)</th>
              <th>Wind</th>
              <th>Speed</th>
              <th>Temp</th>
              <th aria-label="drift" />
            </tr>
          </thead>
          <tbody>
            {[...levels].reverse().map((l) => (
              <tr key={l.altitudeFtAgl}>
                <td>{l.altitudeFtAgl === 0 ? 'Surface' : `${l.altitudeFtAgl.toLocaleString()} ft`}</td>
                <td>
                  {compass(l.directionDeg)} ({l.directionDeg}°)
                </td>
                <td className={l.speedKt >= 30 ? 'aloft-strong' : ''}>{fmtSpeed(l.speedKt, unit)}</td>
                <td>{l.tempC != null ? `${l.tempC}°C / ${round(cToF(l.tempC))}°F` : '—'}</td>
                <td>
                  <span
                    className="aloft-arrow"
                    style={{ transform: `rotate(${(l.directionDeg + 180) % 360}deg)` }}
                    aria-hidden
                  >
                    ↑
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted small">Arrow shows drift direction (where wind pushes you).</p>
      <p className="muted small">
        Same Open-Meteo data source as{' '}
        <a href={DATA_SOURCES.markschulze.url} target="_blank" rel="noopener noreferrer">
          Mark Schulze’s Winds Aloft
        </a>
        , the popular skydiving winds tool.
      </p>
      <p className="muted small">
        Each 1,000-ft level is <strong>linearly interpolated</strong> from the model’s pressure-level
        winds (Open-Meteo gives wind at fixed pressure surfaces — e.g. 925/850/700 hPa — with their
        geopotential heights, which we convert to ft MSL and interpolate to these AGL altitudes).
        Direction is interpolated along the shortest compass arc. These are a model{' '}
        <strong>forecast</strong> for the DZ, not a measured sounding, so treat them as guidance.
      </p>
    </Panel>
  );
}
