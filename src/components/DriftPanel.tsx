import { useEffect, useMemo, useState } from 'react';
import type { WindsAloftLevel, WindsAloftSource } from '../domain/types';
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
  source,
}: {
  levels: WindsAloftLevel[];
  profile: WindProfileId;
  /** Which source produced `levels`. The card credited Open-Meteo whatever it
   *  was actually handed, so on the NOAA FD fallback it named a source the
   *  numbers had not come from. */
  source?: WindsAloftSource | null;
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
      // Highest deploy option still below the new exit. If none exists (only
      // possible if exit's floor is ever dropped below deploy's), leave deploy
      // as-is rather than forcing a value at or above exit.
      const valid = DEPLOY_OPTIONS.filter((a) => a < v);
      if (valid.length) setDeploy(valid[valid.length - 1]);
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
    <Panel
      title="Freefall drift / spot"
      subtitle="estimate"
      sources={[source === 'nws-fd' ? DATA_SOURCES.fdWinds : DATA_SOURCES.openMeteo]}
    >
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

          {/* Only when the winds source stops above the ground — on the NOAA FD
              fallback, whose lowest level is 3,000 ft MSL. The number is
              invisible in the result otherwise: the drift figure looks the same
              whether the last stretch of canopy flight was integrated over real
              levels or over an assumed one, and that stretch is the wind the
              jumper lands in. */}
          {drift.extrapolatedBelowFtAgl > 0 && (
            <p className="muted small">
              <strong>
                Below {drift.extrapolatedBelowFtAgl.toLocaleString()} ft AGL this assumes the wind
                at {drift.extrapolatedBelowFtAgl.toLocaleString()} ft.
              </strong>{' '}
              The winds source in use has no level under that, so the last{' '}
              {drift.extrapolatedBelowFtAgl.toLocaleString()} ft of canopy descent carries that wind
              rather than a forecast one — the part of the flight where wind usually changes most.
              Read the ground wind off the Surface wind card and treat the canopy figure as the
              rougher half of this estimate.
            </p>
          )}

          <p className="muted small">
            USPA BSR minimum container-opening altitudes:{' '}
            <strong>students &amp; A-license 3,000 ft AGL</strong>, B-license 2,500 ft, C/D
            2,500 ft (waiverable by an S&amp;TA to no lower than 2,000 ft), tandem 5,000 ft. These
            are floors — deploy above your minimum, not at it. See the{' '}
            <a href={CITATIONS.uspaOpeningAltitude.url} target="_blank" rel="noopener noreferrer">
              USPA SIM §2-1 (BSR)
            </a>
            ; section text read at uspa.org on 2026-09-22 — re-check against the current SIM.
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
