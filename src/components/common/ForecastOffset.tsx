import {
  offsetBarPosition,
  offsetFromNow,
  STEP_BACK_HOURS,
  STEP_FORWARD_HOURS,
} from '../../domain/forecastHour';

/** The bar's ends, in hours from now: the step window plus the half hour
 *  the nearest hour can sit off the clock, rounded out (see
 *  `offsetBarPosition`). The words carry the exact gap. */
const BAR_BACK_H = STEP_BACK_HOURS + 1;
const BAR_FORWARD_H = STEP_FORWARD_HOURS + 1;

/**
 * How far the forecast being shown is from the current time, as words and
 * as a bar: a line for now, the valid time as a dot, the stretch between
 * them filled. The words are the figure; the bar makes the size and direction
 * of the gap readable at a glance, which is what a jumper stepping the table
 * an hour at a time needs to keep in view. Neutral colours only: a gap in
 * time is not a condition, and the rule on this app is that nothing gets a
 * warning colour without a published limit behind it.
 */
export function ForecastOffset({
  validMs,
  now,
  compact = false,
}: {
  validMs: number;
  now: number;
  /** Words only, for a card that follows another card's choice. */
  compact?: boolean;
}): JSX.Element {
  const off = offsetFromNow(validMs, now);
  if (compact) return <strong>{off.text}</strong>;
  const { nowPct, markPct, beyond } = offsetBarPosition(off.minutes, BAR_BACK_H * 60, BAR_FORWARD_H * 60);
  const left = Math.min(nowPct, markPct);
  const width = Math.abs(markPct - nowPct);
  return (
    <div className="fc-offset">
      <div className="fc-track" aria-hidden>
        <span className="fc-track-span" style={{ left: `${left}%`, width: `${width}%` }} />
        <span className="fc-track-now" style={{ left: `${nowPct}%` }} />
        <span
          className={`fc-track-mark${beyond ? ` fc-track-beyond-${beyond}` : ''}`}
          style={{ left: `${markPct}%` }}
        />
      </div>
      <div className="fc-track-labels" aria-hidden>
        <span>−{BAR_BACK_H} h</span>
        <span className="fc-track-now-label" style={{ left: `${nowPct}%` }}>
          now
        </span>
        <span>+{BAR_FORWARD_H} h</span>
      </div>
      <p className="fc-offset-text" aria-live="polite">
        <strong>{off.text}</strong>
      </p>
    </div>
  );
}
