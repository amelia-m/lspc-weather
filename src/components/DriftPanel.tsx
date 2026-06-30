import { useMemo, useState } from 'react';
import type { WindsAloftLevel } from '../domain/types';
import { compass, round } from '../domain/units';
import { estimateDrift, type DriftLeg } from '../domain/spot';
import { DATA_SOURCES } from '../config/sources';
import { Panel } from './common/Panel';

const fmtDist = (ft: number): string =>
  `${Math.round(ft).toLocaleString()} ft · ${(ft / 5280).toFixed(2)} mi`;

const dir = (deg: number): string => `${compass(deg)} (${round(deg)}°)`;

/** Freefall + canopy drift / spot estimate from the winds-aloft layers, in the
 *  spirit of Mark Schulze's tool. Editable exit/deploy/fall-rate inputs. */
export function DriftPanel({ levels }: { levels: WindsAloftLevel[] }): JSX.Element {
  const [exitFt, setExit] = useState(13000);
  const [deployFt, setDeploy] = useState(3000);
  const [fallRate, setFallRate] = useState(120);

  const drift = useMemo(
    () =>
      estimateDrift(levels, {
        exitFtAgl: exitFt,
        deployFtAgl: deployFt,
        fallRateMph: fallRate,
        canopyRateFpm: 1000,
      }),
    [levels, exitFt, deployFt, fallRate],
  );

  const spotToward = (drift.total.towardDeg + 180) % 360;

  return (
    <Panel title="Freefall drift / spot" subtitle="estimate" sources={[DATA_SOURCES.openMeteo]}>
      {levels.length === 0 ? (
        <p className="muted">No winds-aloft data.</p>
      ) : (
        <>
          <div className="drift-inputs">
            <label>
              Exit (ft AGL)
              <input
                type="number"
                step={500}
                value={exitFt}
                onChange={(e) => setExit(clamp(parseFloat(e.target.value), 1000, 18000))}
              />
            </label>
            <label>
              Deploy (ft AGL)
              <input
                type="number"
                step={250}
                value={deployFt}
                onChange={(e) => setDeploy(clamp(parseFloat(e.target.value), 1000, 6000))}
              />
            </label>
            <label>
              Fall rate (mph)
              <input
                type="number"
                step={5}
                value={fallRate}
                onChange={(e) => setFallRate(clamp(parseFloat(e.target.value), 80, 200))}
              />
            </label>
          </div>

          <dl className="kv">
            <dt>Freefall drift</dt>
            <dd>{legText(drift.freefall)}</dd>
            <dt>Canopy drift*</dt>
            <dd>{legText(drift.canopy)}</dd>
            <dt>Total drift</dt>
            <dd>{legText(drift.total)}</dd>
          </dl>

          <p className="drift-spot">
            Plan to spot <strong>upwind</strong>: exit ~{fmtDist(drift.total.distanceFt)} toward{' '}
            <strong>{dir(spotToward)}</strong> of the target so you drift back over it.
          </p>

          <p className="muted small">
            *Canopy drift assumes you don’t steer (1,000 ft/min descent); you normally fly it out.
            Rough estimate only — winds are a model forecast and the spot is the jumpmaster/pilot’s
            call.
          </p>
        </>
      )}
    </Panel>
  );
}

const legText = (leg: DriftLeg): string => `${fmtDist(leg.distanceFt)} toward ${dir(leg.towardDeg)}`;

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}
