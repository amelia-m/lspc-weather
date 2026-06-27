import type { CurrentConditions } from '../domain/types';
import { ktToMph, round } from '../domain/units';
import type { Thresholds } from '../config/thresholds';
import { DATA_SOURCES } from '../config/sources';
import { Panel } from './common/Panel';

/** Surface wind with limit bands drawn from the active profile's thresholds.
 *  The bands are sourced markers, not a verdict. */
export function SurfaceWindPanel({
  current,
  thresholds: t,
  label,
}: {
  current: CurrentConditions | null;
  thresholds: Thresholds;
  label: string;
}): JSX.Element {
  const speed = current?.wind.speedKt ?? null;
  const gust = current?.wind.gustKt ?? null;
  const max = Math.max(t.windCautionKt + 6, t.gustCautionKt ?? 0, gust ?? 0, speed ?? 0);
  const pct = (v: number): number => Math.min(100, (v / max) * 100);

  return (
    <Panel title="Surface wind" subtitle={`${label} limits`} sources={[DATA_SOURCES.nwsObservation]}>
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
            {t.gustCautionKt != null && (
              <div className="wind-band band-gust" style={{ left: `${pct(t.gustCautionKt)}%` }} />
            )}
            <div className="wind-fill" style={{ width: `${pct(speed)}%` }} />
            {gust != null && <div className="wind-gust-tick" style={{ left: `${pct(gust)}%` }} />}
          </div>
          <p className="wind-legend">
            Watch ≥ {round(t.windWatchKt)} kt · Caution ≥ {round(t.windCautionKt)} kt (
            {round(ktToMph(t.windCautionKt))} mph)
            {t.gustCautionKt != null &&
              ` · Gust ceiling ${round(ktToMph(t.gustCautionKt))} mph (${round(t.gustCautionKt)} kt)`}
          </p>
        </>
      )}
    </Panel>
  );
}
