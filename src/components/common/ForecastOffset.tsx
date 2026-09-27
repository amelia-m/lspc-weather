import { offsetBarPosition, offsetFromNow } from '../../domain/forecastHour';

/** Hours either side of now that the bar spans edge to edge. Three covers
 *  the hour-by-hour stepping a jumper does for the next few loads; a farther
 *  hour pins to the edge with an arrow, and the words carry the exact gap. */
const SPAN_HOURS = 3;

/**
 * How far the forecast being shown is from the current time, as words and
 * as a bar: now in the middle, the valid time as a dot, the stretch between
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
  const { markPct, beyond } = offsetBarPosition(off.minutes, SPAN_HOURS * 60);
  const left = Math.min(50, markPct);
  const width = Math.abs(markPct - 50);
  return (
    <div className="fc-offset">
      <div className="fc-track" aria-hidden>
        <span className="fc-track-span" style={{ left: `${left}%`, width: `${width}%` }} />
        <span className="fc-track-now" />
        <span
          className={`fc-track-mark${beyond ? ` fc-track-beyond-${beyond}` : ''}`}
          style={{ left: `${markPct}%` }}
        />
      </div>
      <div className="fc-track-labels" aria-hidden>
        <span>−{SPAN_HOURS} h</span>
        <span>now</span>
        <span>+{SPAN_HOURS} h</span>
      </div>
      <p className="fc-offset-text" aria-live="polite">
        <strong>{off.text}</strong>
      </p>
    </div>
  );
}
