import type { CurrentConditions } from '../domain/types';
import { fmtLimitSpeed, fmtSpeed, round, toSpeed, type SpeedUnit } from '../domain/units';
import type { Thresholds } from '../config/thresholds';
import { DATA_SOURCES } from '../config/sources';
import { Panel } from './common/Panel';
import { SourceLink } from './common/SourceLink';

/**
 * Surface wind, against whatever limit a source has actually published for the
 * active profile.
 *
 * This is the most-read card on the page, and the band is a marker, not a
 * verdict. Only a published limit is drawn or named: the USPA ground-wind
 * figure for students, the posted club policy for the waiver tiers.
 *
 * Where nobody published one — licensed jumpers — there is no band, and no
 * surface-wind flag fires anywhere in the app at any speed. That makes this
 * card the only place the profile's own account of that absence can reach a
 * reader, so it prints here as a standing note with its citation, in a 3 kt
 * breeze and in a 60 kt gale alike. It is the same treatment the winds-aloft
 * and density-altitude cards give guidance whose trigger was removed for being
 * a number nobody published: keep the sourced claim, drop the invented
 * threshold, put the claim where it is always readable.
 *
 * Limits print through `fmtLimitSpeed`, not `fmtSpeed`: the waiver's top two
 * tiers post ceilings one mph apart, which collide at whole knots.
 */
export function SurfaceWindPanel({
  current,
  thresholds: t,
  label,
  unit,
  onUnitChange,
}: {
  current: CurrentConditions | null;
  thresholds: Thresholds;
  label: string;
  unit: SpeedUnit;
  /** Page-wide unit setter, handed to the header toggle. Required rather than
   *  optional: this is the most-read card on the page and the one a jumper
   *  compares against a wind limit quoted in mph, so it must never render
   *  without the switch. */
  onUnitChange: (u: SpeedUnit) => void;
}): JSX.Element {
  const speed = current?.wind.speedKt ?? null;
  const gust = current?.wind.gustKt ?? null;
  const max = Math.max(t.windCautionKt + 6, t.gustCautionKt ?? 0, gust ?? 0, speed ?? 0);
  const pct = (v: number): number => Math.min(100, (v / max) * 100);
  const other: SpeedUnit = unit === 'kt' ? 'mph' : 'kt';

  return (
    <Panel
      title="Surface wind"
      /* "flag bands" is only true where a source set one. On the licensed
         profile it named bands over a bar that draws none, for a profile that
         raises no wind flag — a label describing a different card. */
      subtitle={t.windLimitCitation ? `${label} flag bands` : `${label} — no published limit`}
      sources={[DATA_SOURCES.nwsObservation]}
      unit={unit}
      onUnitChange={onUnitChange}
    >
      {speed == null ? (
        <p className="muted">No wind data.</p>
      ) : (
        <>
          <div className="wind-readout">
            <span className="wind-big">{round(toSpeed(speed, unit))}</span>
            <span className="wind-unit">{unit}</span>
            <span className="wind-mph">({fmtSpeed(speed, other)})</span>
            {gust != null && <span className="wind-gust">gust {fmtSpeed(gust, unit)}</span>}
          </div>
          <div className="wind-bar" role="img" aria-label={`Wind ${round(speed)} knots`}>
            {t.windLimitCitation && (
              <div className="wind-band band-caution" style={{ left: `${pct(t.windCautionKt)}%` }} />
            )}
            {t.gustCautionKt != null && (
              <div className="wind-band band-gust" style={{ left: `${pct(t.gustCautionKt)}%` }} />
            )}
            <div className="wind-fill" style={{ width: `${pct(speed)}%` }} />
            {gust != null && <div className="wind-gust-tick" style={{ left: `${pct(gust)}%` }} />}
          </div>
          {/* Only a limit a published source sets is drawn or named. There is
              no earlier "watch" marker: the one that used to sit a few knots
              under this was the app's own arithmetic, and putting an unsourced
              number on the card beside sourced ones lent it their authority.
              It raises no flag now either — it does not exist. */}
          {t.windLimitCitation && (
            <>
              <p className="wind-legend">
                Caution ≥ {fmtLimitSpeed(t.windCautionKt, unit)}
                {t.gustCautionKt != null &&
                  ` · Gust ceiling ${fmtLimitSpeed(t.gustCautionKt, unit)}`}
              </p>
              <p className="muted small">
                Caution{t.gustCautionKt != null ? ' and gust ceiling' : ''}:{' '}
                <SourceLink citation={t.windLimitCitation} />
              </p>
            </>
          )}
        </>
      )}
      {/* Standing note, outside the reading above on purpose: it explains why
          this profile has no limit to draw and no flag to raise, which is true
          whether or not the station reported a wind this minute. */}
      {!t.windLimitCitation && (
        <>
          {/* Split in two: what this dashboard does, then what a source says.
              Running them together would let the app's own silence borrow the
              citation's authority. */}
          <p className="muted small">
            <strong>No published limit for this profile</strong>, so there is no band to draw —
            and no surface-wind flag appears under &ldquo;Conditions to note&rdquo; at any speed.
            The reading is the observation; judging it is yours.
          </p>
          <p className="muted small">
            {t.windGuidance} Source: <SourceLink citation={t.windCitation} />
          </p>
        </>
      )}
    </Panel>
  );
}
