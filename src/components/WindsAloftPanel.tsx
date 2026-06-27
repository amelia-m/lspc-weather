import type { WindsAloftLevel } from '../domain/types';
import { compass } from '../domain/units';
import { Panel } from './common/Panel';

/** Winds aloft at jump altitudes — the skydiver-specific centerpiece. An arrow
 *  points the direction the wind is blowing TOWARD (drift direction). */
export function WindsAloftPanel({ levels }: { levels: WindsAloftLevel[] }): JSX.Element {
  return (
    <Panel title="Winds aloft" subtitle="freefall drift / spot">
      {levels.length === 0 ? (
        <p className="muted">No winds-aloft data.</p>
      ) : (
        <table className="aloft-table">
          <thead>
            <tr>
              <th>Alt (AGL)</th>
              <th>Wind</th>
              <th>Speed</th>
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
                <td className={l.speedKt >= 30 ? 'aloft-strong' : ''}>{l.speedKt} kt</td>
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
    </Panel>
  );
}
