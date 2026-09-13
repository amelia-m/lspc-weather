import type { CurrentConditions } from '../domain/types';
import { fmtSpeed, round, toSpeed, type SpeedUnit } from '../domain/units';
import type { Thresholds } from '../config/thresholds';
import { DATA_SOURCES } from '../config/sources';
import { Panel } from './common/Panel';
import { SourceLink } from './common/SourceLink';

/**
 * Surface wind with the active profile's flag bands drawn on a scale.
 *
 * This is the most-read card on the page, and the bands are markers, not a
 * verdict. They also do not all come from the same place, which is why the
 * footnote below splits them rather than hanging one source line under both:
 *
 *  - CAUTION is a published limit for students (the USPA ground-wind figure)
 *    and for waiver tiers (the posted club policy), but for licensed jumpers
 *    nobody published one, so that band is the app's own number.
 *  - WATCH is always the app's: it sits a few knots under the caution band as
 *    an early warning, and no rule defines such a level.
 *
 * Rendering one citation across the pair would credit USPA or the club with a
 * number they never set — the defect this card was fixed for. `thresholds`
 * already carried the citation; the card simply never showed it.
 */
export function SurfaceWindPanel({
  current,
  thresholds: t,
  label,
  unit,
}: {
  current: CurrentConditions | null;
  thresholds: Thresholds;
  label: string;
  unit: SpeedUnit;
}): JSX.Element {
  const speed = current?.wind.speedKt ?? null;
  const gust = current?.wind.gustKt ?? null;
  const max = Math.max(t.windCautionKt + 6, t.gustCautionKt ?? 0, gust ?? 0, speed ?? 0);
  const pct = (v: number): number => Math.min(100, (v / max) * 100);
  const other: SpeedUnit = unit === 'kt' ? 'mph' : 'kt';

  return (
    <Panel
      title="Surface wind"
      subtitle={`${label} flag bands`}
      sources={[DATA_SOURCES.nwsObservation]}
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
          {/* Only bands a published source actually sets are drawn or named. The
              "watch" band is this dashboard's own earlier warning — it still
              raises a flag, but showing it here as a marked limit put an
              unsourced number on the card beside sourced ones. */}
          {t.windLimitCitation ? (
            <>
              <p className="wind-legend">
                Caution ≥ {fmtSpeed(t.windCautionKt, unit)}
                {t.gustCautionKt != null && ` · Gust ceiling ${fmtSpeed(t.gustCautionKt, unit)}`}
              </p>
              <p className="muted small">
                Caution{t.gustCautionKt != null ? ' and gust ceiling' : ''}:{' '}
                <SourceLink citation={t.windLimitCitation} />
              </p>
            </>
          ) : (
            <p className="muted small">
              No sourced wind limit to show for this profile — the reading above is the
              observation only.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}
