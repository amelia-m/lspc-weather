import type { CurrentConditions, HourlyPoint } from '../domain/types';
import { round } from '../domain/units';
import { Panel } from './common/Panel';
import { fmtTime } from './format';

/** Current ceiling + an hourly sky-cover / ceiling timeline (the usairnet
 *  cloud-forecast replacement), built from NWS gridpoint data. */
export function CeilingSkyPanel({
  current,
  hourly,
}: {
  current: CurrentConditions | null;
  hourly: HourlyPoint[];
}): JSX.Element {
  const now = Date.now();
  const upcoming = hourly.filter((h) => h.time >= now - 3600_000).slice(0, 12);

  return (
    <Panel title="Ceiling & sky" subtitle="now + next hours">
      <div className="ceil-now">
        <span className="ceil-label">Ceiling</span>
        <span className="ceil-value">
          {current?.ceilingFtAgl != null
            ? `${current.ceilingFtAgl.toLocaleString()} ft AGL`
            : current
              ? 'No ceiling'
              : '—'}
        </span>
      </div>
      {upcoming.length === 0 ? (
        <p className="muted">No hourly forecast available.</p>
      ) : (
        <div className="sky-timeline">
          {upcoming.map((h) => (
            <div key={h.time} className="sky-col" title={describeHour(h)}>
              <div className="sky-bar-track">
                <div
                  className="sky-bar"
                  style={{ height: `${h.skyCoverPct ?? 0}%` }}
                  data-cover={coverClass(h.skyCoverPct)}
                />
              </div>
              <span className="sky-ceil">
                {h.ceilingFtAgl != null ? `${Math.round(h.ceilingFtAgl / 100) / 10}k` : '—'}
              </span>
              <span className="sky-time">{fmtTime(h.time)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="muted small">Bar height = sky cover %. Label = ceiling (thousands ft AGL).</p>
    </Panel>
  );
}

function describeHour(h: HourlyPoint): string {
  const parts = [fmtTime(h.time)];
  if (h.skyCoverPct != null) parts.push(`${round(h.skyCoverPct)}% cover`);
  if (h.ceilingFtAgl != null) parts.push(`ceiling ${h.ceilingFtAgl.toLocaleString()} ft`);
  if (h.precipProbPct != null) parts.push(`${round(h.precipProbPct)}% precip`);
  return parts.join(' · ');
}

function coverClass(pct: number | null): string {
  if (pct == null) return 'unknown';
  if (pct < 25) return 'few';
  if (pct < 50) return 'sct';
  if (pct < 88) return 'bkn';
  return 'ovc';
}
