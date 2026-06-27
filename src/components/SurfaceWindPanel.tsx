import type { CurrentConditions, JumperClass } from '../domain/types';
import { ktToMph, round } from '../domain/units';
import { DEFAULT_THRESHOLDS } from '../config/thresholds';
import { Panel } from './common/Panel';

/** Surface wind with limit bands drawn from the active thresholds. The bands
 *  are sourced markers, not a verdict. */
export function SurfaceWindPanel({
  current,
  jumperClass,
}: {
  current: CurrentConditions | null;
  jumperClass: JumperClass;
}): JSX.Element {
  const t = DEFAULT_THRESHOLDS[jumperClass];
  const speed = current?.wind.speedKt ?? null;
  const gust = current?.wind.gustKt ?? null;
  const max = Math.max(t.windCautionKt + 6, gust ?? 0, speed ?? 0);
  const pct = (v: number): number => Math.min(100, (v / max) * 100);

  return (
    <Panel title="Surface wind" subtitle={`${jumperClass} limits`}>
      {speed == null ? (
        <p className="muted">No wind data.</p>
      ) : (
        <>
          <div className="wind-readout">
            <span className="wind-big">{round(speed)}</span>
            <span className="wind-unit">kt</span>
            <span className="wind-mph">({round(ktToMph(speed))} mph)</span>
            {gust != null && <span className="wind-gust">gust {round(gust)} kt</span>}
          </div>
          <div className="wind-bar" role="img" aria-label={`Wind ${round(speed)} knots`}>
            <div className="wind-band band-watch" style={{ left: `${pct(t.windWatchKt)}%` }} />
            <div className="wind-band band-caution" style={{ left: `${pct(t.windCautionKt)}%` }} />
            <div className="wind-fill" style={{ width: `${pct(speed)}%` }} />
            {gust != null && <div className="wind-gust-tick" style={{ left: `${pct(gust)}%` }} />}
          </div>
          <p className="wind-legend">
            Watch ≥ {t.windWatchKt} kt · Caution ≥ {t.windCautionKt} kt
            {jumperClass === 'student' && ' (USPA student ≈ 14 mph)'}
          </p>
        </>
      )}
    </Panel>
  );
}
