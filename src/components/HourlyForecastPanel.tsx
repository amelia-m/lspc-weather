import { useState } from 'react';
import type { HourlyPoint } from '../domain/types';
import type { SpeedUnit } from '../domain/units';
import { DATA_SOURCES } from '../config/sources';
import { Panel } from './common/Panel';
import { HourlyChart } from './common/HourlyChart';

/** Selectable forecast horizons (hours). 18 h is the default working window;
 *  the longer options are offered only when the data actually reaches them. */
const HORIZONS = [18, 36, 72] as const;

/** Richer hourly chart: surface wind + gust with precip probability bars, over
 *  a selectable horizon (default ~18 h), from the NWS gridpoint forecast. */
export function HourlyForecastPanel({
  hourly,
  unit,
  onUnitChange,
}: {
  hourly: HourlyPoint[];
  unit: SpeedUnit;
  /** Page-wide unit setter, handed to the header toggle. Required rather than
   *  optional, like the other wind cards: the chart and its gust legend are
   *  labelled in whichever unit is active, so the card should never be able to
   *  show speeds a reader cannot re-express.
   *
   *  It deliberately goes to the header and not next to the 18/36/72 h control
   *  below, which changes how far out the chart looks rather than how it reads
   *  — two pill groups side by side would invite one to be taken for the
   *  other. */
  onUnitChange: (u: SpeedUnit) => void;
}): JSX.Element {
  const [hours, setHours] = useState<number>(HORIZONS[0]);
  const now = Date.now();
  const future = hourly.filter((h) => h.time >= now - 3600_000);
  // Offer a longer horizon only when the data extends past the previous option
  // (otherwise the longer window would show nothing new). The default is always
  // available.
  const options: number[] = HORIZONS.filter((_, i) => i === 0 || future.length > HORIZONS[i - 1]);
  const effectiveHours = options.includes(hours) ? hours : HORIZONS[0];
  const points = future.slice(0, effectiveHours);
  const hasWind = points.some((p) => p.windSpeedKt != null);

  return (
    <Panel
      title="Hourly wind"
      subtitle={`next ~${points.length || effectiveHours} h`}
      sources={[DATA_SOURCES.nwsForecast]}
      unit={unit}
      onUnitChange={onUnitChange}
    >
      {!hasWind ? (
        <p className="muted">No hourly forecast available.</p>
      ) : (
        <>
          {options.length > 1 && (
            <div className="range-toggle" role="group" aria-label="Forecast horizon">
              {options.map((h) => (
                <button
                  key={h}
                  className={h === effectiveHours ? 'active' : ''}
                  onClick={() => setHours(h)}
                >
                  {h}h
                </button>
              ))}
            </div>
          )}
          <HourlyChart points={points} unit={unit} />
          <p className="hc-legend">
            <span className="hc-key hc-key-wind" /> wind &nbsp;
            <span className="hc-key hc-key-gust" /> gust ({unit}) &nbsp;
            <span className="hc-key hc-key-precip" /> precip&nbsp;chance
          </p>
        </>
      )}
    </Panel>
  );
}
