import { useEffect, useMemo, useState } from 'react';
import type { WindsAloftLevel } from '../domain/types';
import { compass, round } from '../domain/units';
import { estimateDrift, type DriftLeg } from '../domain/spot';
import { DATA_SOURCES } from '../config/sources';
import { CITATIONS, recommendedDeployFt, type WindProfileId } from '../config/thresholds';
import { Panel } from './common/Panel';
import { SelectField } from './common/SelectField';

/** Build an inclusive numeric range [lo, hi] stepping by `step`. */
const range = (lo: number, hi: number, step: number): number[] =>
  Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => lo + i * step);

// Exit / deploy altitudes in 500-ft steps; fall rate in 10-mph steps. Exit
// tops out at the DZ's usual 10k but allows higher (winds data runs to 13k).
const EXIT_OPTIONS = range(3000, 13000, 500);
const DEPLOY_OPTIONS = range(2000, 6000, 500);
const FALL_RATE_OPTIONS = range(90, 180, 10);

const fmtFt = (ft: number): string => `${ft.toLocaleString()} ft`;
const fmtMph = (mph: number): string => `${mph} mph`;

const fmtDist = (ft: number): string =>
  `${Math.round(ft).toLocaleString()} ft · ${(ft / 5280).toFixed(2)} mi`;

const dir = (deg: number): string => `${compass(deg)} (${round(deg)}°)`;

/** Freefall + canopy drift / spot estimate from the winds-aloft layers, in the
 *  spirit of Mark Schulze's tool. Editable exit/deploy/fall-rate inputs. */
export function DriftPanel({
  levels,
  profile,
}: {
  levels: WindsAloftLevel[];
  profile: WindProfileId;
}): JSX.Element {
  const [exitFt, setExit] = useState(10000);
  const [deployFt, setDeploy] = useState(() => recommendedDeployFt(profile));
  const [fallRate, setFallRate] = useState(120);

  // Deploy defaults to the active profile's USPA minimum opening altitude, and
  // follows a later profile switch. Keep it below exit (exit's floor is 3,000,
  // the highest recommendation, so the fallback only bites if exit is set that
  // low). Not in the exit dep list on purpose — an exit change shouldn't reset
  // a manually chosen deploy; setExitSafe handles that case instead.
  useEffect(() => {
    const rec = recommendedDeployFt(profile);
    setDeploy(rec < exitFt ? rec : exitFt - 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Deploy must stay below exit. Offer only lower altitudes, and if a new exit
  // drops at or below the current deploy, pull deploy down to the highest still-
  // valid option.
  const deployOptions = DEPLOY_OPTIONS.filter((a) => a < exitFt);
  const setExitSafe = (v: number): void => {
    setExit(v);
    if (deployFt >= v) {
      const valid = DEPLOY_OPTIONS.filter((a) => a < v);
      setDeploy(valid.length ? valid[valid.length - 1] : DEPLOY_OPTIONS[0]);
    }
  };

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
            <SelectField
              label="Exit (ft AGL)"
              value={exitFt}
              options={EXIT_OPTIONS}
              format={fmtFt}
              onChange={setExitSafe}
            />
            <SelectField
              label="Deploy (ft AGL)"
              value={deployFt}
              options={deployOptions}
              format={fmtFt}
              onChange={setDeploy}
            />
            <SelectField
              label="Fall rate (mph)"
              value={fallRate}
              options={FALL_RATE_OPTIONS}
              format={fmtMph}
              onChange={setFallRate}
            />
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
            USPA BSR minimum container-opening altitudes:{' '}
            <strong>students &amp; A-license 3,000 ft AGL</strong>, B-license 2,500 ft, C/D 2,000 ft
            (tandem 5,000 ft). These are floors — deploy above your minimum, not at it. See the{' '}
            <a href={CITATIONS.uspaOpeningAltitude.url} target="_blank" rel="noopener noreferrer">
              USPA SIM §2-1 (BSR)
            </a>
            ; AI-derived, verify against the current SIM.
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
