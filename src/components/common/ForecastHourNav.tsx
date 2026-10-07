import { SITE } from '../../config/site';
import { ForecastOffset } from './ForecastOffset';
import { fmtClock, fmtTime } from '../format';

/** The hour buttons, when the winds source has more than one hour to offer.
 *  The NOAA FD fallback is one bulletin and gets none. One object, held by
 *  `useWindsHour` and handed to every card that shows the winds hour, so a
 *  step on any of them moves all of them. */
export interface WindsHourNav {
  canBack: boolean;
  canForward: boolean;
  /** True while the cards follow the hour nearest the clock. */
  following: boolean;
  onStep: (delta: -1 | 1) => void;
  /** Back to following the hour nearest the clock. */
  onFollow: () => void;
}

/** UTC "1800Z". Mark Schulze's Winds Aloft — the tool jumpers cross-check the
 *  winds table against — labels its forecast in exactly this form, so printing
 *  it verbatim turns the comparison into a character match instead of
 *  arithmetic. */
export function fmtZulu(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}${mm}Z`;
}

/** Local calendar day at the DZ, for deciding whether a time needs its weekday
 *  spelled out: a late-evening load can be looking at a forecast hour that has
 *  already crossed midnight local. */
const localDay = (ms: number): string =>
  new Date(ms).toLocaleDateString('en-CA', { timeZone: SITE.timeZone });

/** Local clock for the valid time — bare time on today, weekday-qualified once
 *  the forecast hour falls on a different local day. */
const fmtValidLocal = (ms: number, now: number): string =>
  localDay(ms) === localDay(now) ? fmtTime(ms) : fmtClock(ms);

/** Keyboard focus after a click that may take the focused button away: a
 *  step that reaches the end of the window disables the button in hand, and
 *  "Back to the nearest hour" removes itself, and either drops focus to the
 *  top of the page. Hand it to a step button still in use instead, once the
 *  click's re-render is done. */
function keepFocusIn(host: Element | null, lost: () => boolean): void {
  setTimeout(() => {
    if (!lost()) return;
    host?.querySelector<HTMLButtonElement>('.fc-step:not(:disabled)')?.focus();
  }, 0);
}

/**
 * The winds forecast hour, between a −1 h and a +1 h button as Mark Schulze's
 * page lays it out (so the control reads as moving this time), how far that
 * hour is from now, and the way back to the clock once stepped. Shown on the
 * Winds aloft card and on the drift card, both driven by the same
 * `WindsHourNav`: the drift estimate is worked from the winds table's hour,
 * and a reader who steps it from either card sees the other move with it
 * rather than two cards quietly on different hours.
 *
 * Two copies on one page need two things only one copy did not. Names a
 * screen reader can tell apart (`forLabel`, appended to each button's name,
 * as the unit toggle names itself after its card), and one announcement per
 * step: the offset line is a live region on one card only (`live`).
 */
export function ForecastHourNav({
  validMs,
  now,
  hourNav,
  forLabel,
  live = true,
}: {
  validMs: number;
  now: number;
  /** Step buttons; absent on a source with one hour. */
  hourNav?: WindsHourNav | null;
  /** Appended to every button's accessible name, e.g. "for the drift
   *  estimate", on a second copy of this control. */
  forLabel?: string;
  /** Whether the offset line announces its changes. */
  live?: boolean;
}): JSX.Element {
  const shifted = hourNav != null && !hourNav.following;
  const named = (base: string): string => (forLabel ? `${base} ${forLabel}` : base);
  const step = (e: { currentTarget: HTMLButtonElement }, delta: -1 | 1): void => {
    const btn = e.currentTarget;
    hourNav?.onStep(delta);
    keepFocusIn(btn.closest('.fc-hour'), () => btn.disabled);
  };
  return (
    <div className="fc-hour">
      <div className={`fc-nav${shifted ? ' fc-shifted' : ''}`}>
        {hourNav && (
          <button
            type="button"
            className="fc-step"
            onClick={(e) => step(e, -1)}
            disabled={!hourNav.canBack}
            aria-label={named('Show the forecast one hour earlier')}
          >
            −1 h
          </button>
        )}
        <p className="wind-readout fc-readout">
          <strong>
            Valid <span className="nowrap">{fmtValidLocal(validMs, now)} local</span>
          </strong>
          <strong className="wind-unit">·</strong>
          <strong>{fmtZulu(validMs)}</strong>
        </p>
        {hourNav && (
          <button
            type="button"
            className="fc-step"
            onClick={(e) => step(e, 1)}
            disabled={!hourNav.canForward}
            aria-label={named('Show the forecast one hour later')}
          >
            +1 h
          </button>
        )}
      </div>
      <ForecastOffset validMs={validMs} now={now} live={live} />
      {shifted && hourNav && (
        <p className="fc-follow-row">
          <button
            type="button"
            className="fc-follow"
            aria-label={forLabel ? named('Back to the nearest hour') : undefined}
            onClick={(e) => {
              const host = e.currentTarget.closest('.fc-hour');
              hourNav.onFollow();
              keepFocusIn(host, () => !host?.contains(document.activeElement));
            }}
          >
            Back to the nearest hour
          </button>
        </p>
      )}
    </div>
  );
}
