import type { CurrentConditions, HourlyPoint } from '../domain/types';
import { round } from '../domain/units';
import { DATA_SOURCES } from '../config/sources';
import { Panel } from './common/Panel';
import { fmtTime } from './format';

/** Hourly precipitation-probability timeline from the NWS gridpoint forecast,
 *  plus a current-weather flag if precip/thunder is in the METAR. */
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
  const maxNext6 = next6.reduce<number | null>(
    (m, h) => (h.precipProbPct != null && (m == null || h.precipProbPct > m) ? h.precipProbPct : m),
    null,
  );
  const wx = current?.wxString?.trim();

  return (
    <Panel title="Precipitation" subtitle="chance over next hours" sources={[DATA_SOURCES.nwsForecast]}>
      <div className="ceil-now">
        <span className="ceil-label">Max next 6 h</span>
        <span className="ceil-value">{maxNext6 != null ? `${round(maxNext6)}%` : '—'}</span>
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
        <div className="sky-timeline">
          {upcoming.map((h) => (
            <div
              key={h.time}
              className="sky-col"
              title={`${fmtTime(h.time)} · ${h.precipProbPct != null ? round(h.precipProbPct) + '%' : '—'}`}
            >
              <div className="sky-bar-track">
                <div
                  className="sky-bar precip-bar"
                  style={{ height: `${h.precipProbPct ?? 0}%` }}
                />
              </div>
              <span className="sky-ceil">{h.precipProbPct != null ? `${round(h.precipProbPct)}` : '—'}</span>
              <span className="sky-time">{fmtTime(h.time)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="muted small">Bar height = chance of precipitation (%). Label = same, per hour.</p>
    </Panel>
  );
}
