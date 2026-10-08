import type { CurrentConditions, HourlyPoint } from '../domain/types';
import { round } from '../domain/units';
import { DATA_SOURCES } from '../config/sources';
import { Panel } from './common/Panel';
import { fmtShortHour, fmtTime } from './format';

/** A time under every third hourly bar. */
const LABEL_EVERY = 3;

/** Hourly precipitation-probability timeline from the NWS gridpoint forecast,
 *  plus a current-weather flag if precip/thunder is in the METAR. The bars
 *  stay hourly (NWS serves the chance hour by hour) but narrow, with a time
 *  label every 3 hours, so twelve hours fit across a phone without a scroll. */
export function PrecipPanel({
  hourly,
  current,
}: {
  hourly: HourlyPoint[];
  current: CurrentConditions | null;
}): JSX.Element {
  const now = Date.now();
  const upcoming = hourly.filter((h) => h.time >= now - 3600_000).slice(0, 12);
  const next6 = upcoming.filter((h) => h.time <= now + 6 * 3600_000);
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
        <div className="sky-scroll">
          <div className="sky-timeline precip-timeline">
            {upcoming.map((h, i) => (
              <div
                key={h.time}
                className="sky-col"
                title={`${fmtTime(h.time)} · ${h.precipProbPct != null ? round(h.precipProbPct) + '%' : '—'}`}
              >
                <div className="sky-bar-track">
                  <div className="sky-bar precip-bar" style={{ height: `${h.precipProbPct ?? 0}%` }} />
                </div>
                <span className="sky-ceil">{h.precipProbPct != null ? `${round(h.precipProbPct)}` : '—'}</span>
                {/* Every third hour named; the bars between keep their own
                    hour and figure, on hover and above. */}
                <span className="sky-time">{i % LABEL_EVERY === 0 ? fmtShortHour(h.time) : '\u00a0'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="muted small">
        Bar height = chance of precipitation (%), one bar per hour. Label = same; times every{' '}
        {LABEL_EVERY} hours.
      </p>
    </Panel>
  );
}
