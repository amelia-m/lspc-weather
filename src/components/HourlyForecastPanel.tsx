import type { HourlyPoint } from '../domain/types';
import { DATA_SOURCES } from '../config/sources';
import { Panel } from './common/Panel';
import { HourlyChart } from './common/HourlyChart';

/** Richer hourly chart: surface wind + gust (kt) with precip probability bars,
 *  over the next ~18 hours, from the NWS gridpoint forecast. */
export function HourlyForecastPanel({ hourly }: { hourly: HourlyPoint[] }): JSX.Element {
  const now = Date.now();
  const points = hourly.filter((h) => h.time >= now - 3600_000).slice(0, 18);
  const hasWind = points.some((p) => p.windSpeedKt != null);

  return (
    <Panel title="Hourly wind" subtitle="next ~18 h" sources={[DATA_SOURCES.nwsForecast]}>
      {!hasWind ? (
        <p className="muted">No hourly forecast available.</p>
      ) : (
        <>
          <HourlyChart points={points} />
          <p className="hc-legend">
            <span className="hc-key hc-key-wind" /> wind &nbsp;
            <span className="hc-key hc-key-gust" /> gust (kt) &nbsp;
            <span className="hc-key hc-key-precip" /> precip&nbsp;chance
          </p>
        </>
      )}
    </Panel>
  );
}
