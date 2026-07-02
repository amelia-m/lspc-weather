import { useEffect, useMemo, useState } from 'react';
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
            <NumberField label="Exit (ft AGL)" value={exitFt} step={500} min={1000} max={18000} onCommit={setExit} />
            <NumberField label="Deploy (ft AGL)" value={deployFt} step={250} min={1000} max={6000} onCommit={setDeploy} />
            <NumberField label="Fall rate (mph)" value={fallRate} step={5} min={80} max={200} onCommit={setFallRate} />
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

/**
 * Numeric input that lets you type freely (including clearing the field mid-edit)
 * and only clamps to [min,max] on blur or Enter. Clamping on every keystroke — as
 * this did before — snapped a half-typed value straight to the minimum, making the
 * field feel impossible to change.
 */
function NumberField({
  label,
  value,
  step,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onCommit: (n: number) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(String(value));

  // Reflect external changes (e.g. a future reset) back into the field.
  useEffect(() => setDraft(String(value)), [value]);

  const commit = (): void => {
    const n = clamp(parseFloat(draft), min, max);
    onCommit(n);
    setDraft(String(n));
  };

  return (
    <label>
      {label}
      <input
        type="number"
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}
