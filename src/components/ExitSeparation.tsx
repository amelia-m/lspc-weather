import { useState } from 'react';
import type { WindsAloftLevel } from '../domain/types';
import { compass, round } from '../domain/units';
import { estimateExitSeparation, secondsToCover, windAtAltitude, windOnTrack } from '../domain/exitSeparation';
import { CITATIONS, EXIT_SEPARATION_FT } from '../config/thresholds';
import { SelectField } from './common/SelectField';
import { SourceLink } from './common/SourceLink';

/** Jump-run bearings offered: every ten degrees, as a pilot gives one. */
const BEARINGS = Array.from({ length: 36 }, (_, i) => i * 10);
/** North is 360 on a compass rose, never 0. */
const fmtBearing = (deg: number): string => `${deg === 0 ? 360 : deg}° ${compass(deg)}`;
const fmtFt = (ft: number): string => `${ft.toLocaleString('en-US')} ft`;
const MAX_KT = 250;

/** A speed the reader typed, or null while the box is empty, not a number,
 *  not above zero, or beyond any jump plane. */
const parseKt = (s: string): number | null => {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 && n <= MAX_KT ? n : null;
};

/** Named from the figure as printed: a run square across the wind works out
 *  a headwind of minus a few quadrillionths of a knot, which is no tailwind. */
const alongWord = (headwindKt: number): string => (round(headwindKt) < 0 ? 'Tailwind' : 'Headwind');

/**
 * Seconds between groups on jump run, on the Drift card, which has the exit
 * altitude and the forecast hour already (src/domain/exitSeparation.ts has
 * the method and why each input is the reader's).
 *
 * The bearing opens on the forecast wind's own direction at exit altitude,
 * a jump run into the wind, and follows it until the reader picks one: a
 * starting value for an input, labelled as that, not a recommendation. The
 * airspeed starts empty and is not stored: no source read here publishes one
 * for the club's plane, so a default would work a figure for nobody. The
 * pilot's GPS ground speed, when entered, replaces the estimate, since it is
 * measured and the estimate rests on a forecast.
 *
 * No verdict and no colour: two published distances, the speeds they were
 * divided by, and what the figure leaves out.
 */
export function ExitSeparation({
  levels,
  exitFtAgl,
  initialIndicatedKt,
  initialTrackDeg,
  initialGpsKt,
}: {
  levels: readonly WindsAloftLevel[];
  exitFtAgl: number;
  /** For a test to render a worked example; the app passes none. */
  initialIndicatedKt?: number;
  initialTrackDeg?: number;
  initialGpsKt?: number;
}): JSX.Element {
  const [chosenTrack, setTrack] = useState<number | null>(initialTrackDeg ?? null);
  const [ias, setIas] = useState(initialIndicatedKt != null ? String(initialIndicatedKt) : '');
  const [gps, setGps] = useState(initialGpsKt != null ? String(initialGpsKt) : '');

  const wind = windAtAltitude(levels, exitFtAgl);
  // A calm has no direction to fly into or to print: the bearing box still
  // needs a value, but nothing says it is "into the wind".
  const calm = wind != null && round(wind.speedKt) === 0;
  // Into the forecast wind, to the nearest bearing offered, until chosen.
  const intoWind = wind ? (Math.round(wind.directionDeg / 10) * 10) % 360 : 0;
  const track = chosenTrack ?? intoWind;
  const iasKt = parseKt(ias);
  const gpsKt = parseKt(gps);
  const onTrack = wind ? windOnTrack(wind.directionDeg, wind.speedKt, track) : null;
  const est = iasKt != null ? estimateExitSeparation(levels, { exitFtAgl, trackDeg: track, indicatedKt: iasKt }) : null;
  // The measured speed over the estimate whenever the reader has one.
  const gsKt = gpsKt ?? est?.groundSpeedKt ?? null;

  return (
    <div className="exit-sep">
      <h3 className="exit-sep-title">Exit separation on jump run</h3>
      {!wind ? (
        <p className="muted small">
          The winds table has no row at {fmtFt(exitFtAgl)} AGL for this hour, so there is no wind to work a ground
          speed from. The pilot&rsquo;s GPS ground speed, entered below, still gives the seconds.
        </p>
      ) : (
        <p className="muted small">
          Forecast wind at {fmtFt(exitFtAgl)} AGL:{' '}
          {calm ? 'calm' : `from ${compass(wind.directionDeg)} (${round(wind.directionDeg)}°) at ${round(wind.speedKt)} kt`}.
        </p>
      )}
      <div className="drift-inputs">
        {wind && (
          <SelectField
            label={chosenTrack == null && !calm ? 'Jump run toward (° true; into the forecast wind)' : 'Jump run toward (° true)'}
            value={track}
            options={BEARINGS}
            format={fmtBearing}
            onChange={setTrack}
          />
        )}
        {wind && (
          <label>
            Airspeed on jump run (kt indicated)
            <input
              type="text"
              inputMode="decimal"
              value={ias}
              placeholder="from the pilot"
              onChange={(e) => setIas(e.target.value)}
            />
          </label>
        )}
        <label>
          GPS ground speed (kt), if the pilot has it
          <input type="text" inputMode="decimal" value={gps} placeholder="optional" onChange={(e) => setGps(e.target.value)} />
        </label>
      </div>

      {/* The words in the labels, which may wrap; each figure short, on one
          line (the Wing loading card's grid): on a phone a value column of
          sentences broke "9 s between exits" over two lines. */}
      <dl className="kv wl-kv exit-sep-kv">
        {onTrack && (
          <>
            <dt>
              {alongWord(onTrack.headwindKt)} on a run toward {fmtBearing(track)}
            </dt>
            <dd>{Math.abs(round(onTrack.headwindKt))} kt</dd>
            <dt>Crosswind on it</dt>
            <dd>{round(onTrack.crosswindKt)} kt</dd>
          </>
        )}
        {est && gpsKt == null && (
          <>
            <dt>True airspeed, from {round(iasKt!)} kt indicated</dt>
            <dd>about {round(est.tasKt)} kt</dd>
          </>
        )}
        {gsKt != null && gsKt > 0 && (
          <>
            <dt>{gpsKt != null ? 'Ground speed, from the pilot’s GPS' : 'Ground speed, an estimate'}</dt>
            {/* Knots only: with the mph beside it this was the one value too
                wide for a 320 px card, and a jump run's speed is spoken in
                knots. */}
            <dd>
              {gpsKt != null ? '' : 'about '}
              {round(gsKt)} kt
            </dd>
            {EXIT_SEPARATION_FT.map((s) => (
              <SecondsRow key={s.ft} between={s.between} ft={s.ft} seconds={secondsToCover(s.ft, gsKt)} />
            ))}
          </>
        )}
      </dl>

      {/* Each case in which there is no count to give, said as what it is. */}
      {wind && gpsKt == null && iasKt == null && (
        <p className="muted small">
          Enter the plane&rsquo;s indicated airspeed on jump run, or the pilot&rsquo;s GPS ground speed, for the
          seconds between groups.
        </p>
      )}
      {gpsKt == null && est && est.groundSpeedKt == null && (
        <p className="exit-sep-none">
          The forecast crosswind on this bearing is at or above the plane&rsquo;s true airspeed, so no heading
          holds this line over the ground.
        </p>
      )}
      {gpsKt == null && est && est.groundSpeedKt != null && est.groundSpeedKt <= 0 && (
        <p className="exit-sep-none">
          The forecast headwind on this bearing is at or above the plane&rsquo;s true airspeed: it makes no
          ground, so no count of seconds gives the distance.
        </p>
      )}

      <p className="muted small">
        Seconds between exits for the ground separation SIM 4-7 C gives: &ldquo;at least 1,000 feet&rdquo; between
        solo jumpers and &ldquo;at least 1,500 feet&rdquo; between small groups, &ldquo;adding more as the size of
        the groups increase&rdquo; (it gives no figure for larger groups, so none is worked here). Rounded up to
        the second.
        {gpsKt == null && est && (
          <>
            {' '}
            The ground speed is an estimate: the forecast wind for the hour above, and a true airspeed worked from
            the indicated one with {est.tempForecast ? 'the forecast temperature' : 'the standard temperature (the forecast has none)'}{' '}
            and standard pressure at exit altitude. The pilot&rsquo;s GPS reads the real one; entering it replaces
            the estimate.
          </>
        )}{' '}
        This is separation at exit and nothing after it: the same part says slower-falling groups are blown
        farther downwind, which this does not work out. Source: <SourceLink citation={CITATIONS.uspaSpotting} />
      </p>
    </div>
  );
}

function SecondsRow({ between, ft, seconds }: { between: string; ft: number; seconds: number | null }): JSX.Element {
  return (
    <>
      <dt>
        {between}, at least {fmtFt(ft)}: between exits
      </dt>
      <dd>
        <strong>{seconds} s</strong>
      </dd>
    </>
  );
}
