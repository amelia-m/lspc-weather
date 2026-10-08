import { useState } from 'react';
import type { CurrentConditions, HourlyPoint } from '../domain/types';
import { hourBlocks } from '../domain/hourBlocks';
import { round } from '../domain/units';
import { DATA_SOURCES } from '../config/sources';
import { Panel } from './common/Panel';
import { fmtShortHour, fmtTime } from './format';

/** Hours per block in the collapsed view. */
const BLOCK_HOURS = 3;

/** Precipitation-probability timeline from the NWS gridpoint forecast, in
 *  3-hour blocks by default and every hour on request, plus a
 *  current-weather flag if precip/thunder is in the METAR. */
export function PrecipPanel({
  hourly,
  current,
  initialEachHour = false,
}: {
  hourly: HourlyPoint[];
  current: CurrentConditions | null;
  /** For a test to render the expanded view; the app starts on blocks. */
  initialEachHour?: boolean;
}): JSX.Element {
  const [eachHour, setEachHour] = useState(initialEachHour);
  const now = Date.now();
  const upcoming = hourly.filter((h) => h.time >= now - 3600_000).slice(0, 12);
  // The first six hours shown: exactly the first two 3-hour blocks, so the
  // figures above the bars and the bars themselves cover the same hours.
  const next6 = upcoming.slice(0, 6);
  const maxOf = (pick: (h: HourlyPoint) => number | null): number | null =>
    next6.reduce<number | null>((m, h) => {
      const v = pick(h);
      return v != null && (m == null || v > m) ? v : m;
    }, null);
  const maxNext6 = maxOf((h) => h.precipProbPct);
  const thunderNext6 = maxOf((h) => h.thunderProbPct);
  // QPF is a per-period accumulation the expander repeats across the period's
  // hours, so the max over the window is the largest forecast period total.
  const qpfNext6 = maxOf((h) => h.precipAmountIn);
  const wx = current?.wxString?.trim();

  return (
    <Panel
      title="Precipitation & storms"
      subtitle="chance over next hours"
      sources={[DATA_SOURCES.nwsForecast]}
    >
      <div className="ceil-now">
        <span className="ceil-label">Precip · max next 6 h</span>
        <span className="ceil-value">{maxNext6 != null ? `${round(maxNext6)}%` : '—'}</span>
      </div>
      <div className="ceil-now">
        <span className="ceil-label">Thunderstorm · max next 6 h</span>
        {/* No colour on this figure: 30% was the app's own idea of when a
            forecast storm chance becomes notable, and nothing published sets
            it. The percentage is shown plainly for the reader to judge. */}
        <span className="ceil-value">
          {thunderNext6 != null ? `${round(thunderNext6)}%` : '—'}
        </span>
      </div>
      <div className="ceil-now">
        <span className="ceil-label">Rain amount · fcst period</span>
        <span className="ceil-value">
          {qpfNext6 != null ? `${qpfNext6 < 0.01 ? '0' : qpfNext6.toFixed(2)} in` : '—'}
        </span>
      </div>
      {wx && (
        <p className="muted small">
          Now at {current?.station}: <strong>{wx}</strong>
          {/TS/.test(wx) && ' — thunderstorm reported'}
        </p>
      )}
      {upcoming.length === 0 ? (
        <p className="muted">No hourly forecast available.</p>
      ) : (
        <>
          <div className="sky-scroll">
            <div className="sky-timeline">
              {hourBlocks(upcoming, eachHour ? 1 : BLOCK_HOURS, (h) => h.precipProbPct).map((b) => {
                const span = eachHour
                  ? fmtTime(b.start)
                  : `${fmtShortHour(b.start)}\u2013${fmtShortHour(b.start + b.hours * 3_600_000)}`;
                return (
                  <div key={b.start} className="sky-col" title={`${span} · ${b.max != null ? round(b.max) + '%' : '—'}`}>
                    <div className="sky-bar-track">
                      <div className="sky-bar precip-bar" style={{ height: `${b.max ?? 0}%` }} />
                    </div>
                    <span className="sky-ceil">{b.max != null ? `${round(b.max)}` : '—'}</span>
                    <span className="sky-time">{span}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <button type="button" className="aloft-toggle" aria-expanded={eachHour} onClick={() => setEachHour((v) => !v)}>
            {eachHour ? 'Show 3-hour blocks' : 'Show each hour'}
          </button>
        </>
      )}
      <p className="muted small">
        {eachHour
          ? 'Bar height = chance of precipitation (%). Label = same, per hour.'
          : 'Bar height = the highest hourly chance of precipitation (%) in each block of up to 3 hours. Label = same. The chance of precipitation at some time in a block can be higher than any one hour’s.'}
      </p>
    </Panel>
  );
}
