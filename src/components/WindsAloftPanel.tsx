import { useState } from 'react';
import type { WindsAloftLevel, WindsAloftSource, WindsAloftValidity } from '../domain/types';
import { compass, cToF, fmtSpeed, round, type SpeedUnit } from '../domain/units';
import { SITE } from '../config/site';
import { DATA_SOURCES } from '../config/sources';
import { CITATIONS } from '../config/thresholds';
import { useNow } from '../hooks/useNow';
import { Panel } from './common/Panel';
import { SourceLink } from './common/SourceLink';
import { fmtClock, fmtTime } from './format';

/** Altitudes (ft AGL) shown when the card is collapsed. LSPC jumps top out
 *  around 10,000 ft, so the default view stops there and keeps the low levels
 *  that matter for the landing pattern and opening (surface, 1k, 3k) plus a
 *  couple in between for the exit/freefall drift. Expanding reveals every
 *  1,000-ft level up to 13k. */
const COLLAPSED_ALTITUDES_FT = new Set([0, 1000, 3000, 5000, 7000, 10000]);

/** How far the forecast hour must sit from the clock before the card spells the
 *  gap out in words.
 *
 *  Deliberately a quarter of the model step, not a half: Open-Meteo is hourly
 *  and snapped to the NEAREST step in either direction, which bounds the offset
 *  at ±30 min, so a 30-minute gate would fire only at the exact half hour and
 *  would stay silent in the case that actually confuses people — 12:31, where
 *  the card is already showing the 13:00 forecast. Past a quarter hour the
 *  displayed hour is closer to a different part of the day than to the moment
 *  you are standing in, and during a frontal passage that is enough for the
 *  winds to have turned. Below it the valid time alone says enough. */
const OFFSET_NOTE_MIN = 15;

/** UTC "1800Z". Mark Schulze's Winds Aloft — the tool jumpers cross-check this
 *  card against — labels its forecast in exactly this form, so printing it
 *  verbatim turns the comparison into a character match instead of arithmetic. */
function fmtZulu(ms: number): string {
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

/** Winds aloft at jump altitudes — the skydiver-specific centerpiece. An arrow
 *  points the direction the wind is blowing TOWARD (drift direction).
 *
 *  The card leads with the forecast valid time in both local and Zulu. These
 *  levels are a forecast FOR one hour, never a reading of the current moment,
 *  and without the hour stated a jumper comparing them against another winds
 *  tool cannot tell an ordinary hour offset from a real data disagreement. */
export function WindsAloftPanel({
  levels,
  source,
  validity,
  unit,
  onUnitChange,
}: {
  levels: WindsAloftLevel[];
  source: WindsAloftSource | null | undefined;
  /** When these levels are valid. Undefined until winds aloft have loaded. */
  validity?: WindsAloftValidity | null;
  unit: SpeedUnit;
  /** Page-wide unit setter, handed to the header toggle. Required rather than
   *  optional: the level speeds here are what a jumper cross-checks against
   *  another winds tool, and those tools differ in which unit they print, so
   *  the switch belongs with every rendering of this table. */
  onUnitChange: (u: SpeedUnit) => void;
}): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  // Ticks each minute so the "ahead of now" offset stays true between the
  // 10-minute data polls rather than freezing at fetch time.
  const now = useNow(60_000);
  const fallback = source === 'nws-fd';
  const validMs = validity?.validMs ?? null;
  const offsetMin = validMs != null ? Math.round((validMs - now) / 60_000) : 0;
  const showOffset = validMs != null && Math.abs(offsetMin) >= OFFSET_NOTE_MIN;
  const collapsedLevels = levels.filter((l) => COLLAPSED_ALTITUDES_FT.has(l.altitudeFtAgl));
  // The key set assumes the whole-thousand grid. If the level altitudes ever
  // stop intersecting it, don't hide every row behind a collapse — show all and
  // drop the toggle. Only collapse when it actually thins a non-empty subset.
  const canCollapse = collapsedLevels.length > 0 && collapsedLevels.length < levels.length;
  const shown = expanded || !canCollapse ? levels : collapsedLevels;
  const toggleable = canCollapse;
  return (
    <Panel
      title="Winds aloft"
      subtitle={fallback ? 'NOAA FD fallback' : 'freefall drift / spot'}
      sources={
        fallback
          ? [DATA_SOURCES.fdWinds]
          : [DATA_SOURCES.openMeteo, DATA_SOURCES.markschulze]
      }
      unit={unit}
      onUnitChange={onUnitChange}
    >
      {levels.length > 0 && (
        <>
          {validMs != null ? (
            <p className="wind-readout">
              <strong>Valid {fmtValidLocal(validMs, now)} local</strong>
              <strong className="wind-unit">·</strong>
              <strong>{fmtZulu(validMs)}</strong>
            </p>
          ) : (
            <p className="muted small">
              This source stated no forecast valid time, so the hour these winds
              are for cannot be shown.
            </p>
          )}
          {showOffset && (
            <p className="muted small">
              {offsetMin > 0
                ? `That is ${offsetMin} min ahead of the current time (${fmtTime(now)}) — `
                : `That is ${Math.abs(offsetMin)} min behind the current time (${fmtTime(now)}) — `}
              {fallback
                ? 'the FD bulletin is issued every 6 hours, so the nearest one is used.'
                : 'the model steps hourly, so the nearest hour is used.'}
            </p>
          )}
          {fallback && (validity?.forUseRaw != null || validity?.basedOnMs != null) && (
            <p className="muted small">
              Bulletin
              {validity.forUseRaw != null ? ` is for use ${validity.forUseRaw}Z` : ''}
              {validity.forUseRaw != null && validity.basedOnMs != null ? ',' : ''}
              {validity.basedOnMs != null
                ? ` based on the ${fmtZulu(validity.basedOnMs)} model run`
                : ''}
              .
            </p>
          )}
        </>
      )}
      {levels.length === 0 ? (
        <p className="muted">No winds-aloft data.</p>
      ) : (
        <table className="aloft-table">
          <thead>
            <tr>
              <th>Alt (AGL)</th>
              <th>Wind</th>
              <th>Speed</th>
              <th>Temp</th>
              <th aria-label="drift" />
            </tr>
          </thead>
          <tbody>
            {[...shown].reverse().map((l) => (
              <tr key={l.altitudeFtAgl}>
                <td>{l.altitudeFtAgl === 0 ? 'Surface' : `${l.altitudeFtAgl.toLocaleString()} ft`}</td>
                <td>
                  {compass(l.directionDeg)} ({l.directionDeg}°)
                </td>
                <td>{fmtSpeed(l.speedKt, unit)}</td>
                <td>{l.tempC != null ? `${l.tempC}°C / ${round(cToF(l.tempC))}°F` : '—'}</td>
                <td>
                  <span
                    className="aloft-arrow"
                    style={{ transform: `rotate(${(l.directionDeg + 180) % 360}deg)` }}
                    aria-hidden
                  >
                    ↑
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {toggleable && (
        <button
          type="button"
          className="aloft-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show fewer altitudes' : 'Show more altitudes (more increments, up to 13k ft)'}
        </button>
      )}
      <p className="muted small">Arrow shows drift direction (where wind pushes you).</p>
      {/* This used to reach the reader as a flag that fired at 20/30 kt — numbers
          nobody published. The guidance is real practice, so it stands here for
          any wind rather than appearing only once an invented threshold is
          crossed. Read the speeds above and judge them. */}
      <p className="muted small">
        Strong upper winds increase freefall drift and lengthen the spot — plan jump run and exit
        separation accordingly. Source: <SourceLink citation={CITATIONS.uspaSpotting} />
      </p>
      {!expanded && toggleable && (
        <p className="muted small">
          Showing key altitudes to 10,000 ft (LSPC&rsquo;s usual max). Expand for every 1,000-ft
          level up to 13k.
        </p>
      )}
      {fallback ? (
        <p className="muted small">
          <strong>Fallback source:</strong> Open-Meteo was unreachable, so these levels are
          interpolated from the NOAA winds-aloft (FD) forecast for {SITE.fdWindsStation} (Omaha,
          ~30 mi from the DZ) — 3/6/9/12k-ft MSL levels, the same bulletin jump pilots brief from.
          Levels below the bulletin&rsquo;s lowest (3,000 ft MSL, roughly{' '}
          {(Math.round((3000 - SITE.dz.elevationFt) / 100) * 100).toLocaleString()} ft above the DZ) are not listed at
          all, the surface row among them — the bulletin says nothing about them; see the Surface
          wind card for ground wind.
        </p>
      ) : (
        <>
          <p className="muted small">
            Same Open-Meteo data source as{' '}
            <a href={DATA_SOURCES.markschulze.url} target="_blank" rel="noopener noreferrer">
              Mark Schulze’s Winds Aloft
            </a>
            , the popular skydiving winds tool — so if its numbers differ from these, check its
            stated valid time (it labels forecasts in Z, e.g. “1600Z”) against the one above
            before assuming the data disagrees. Its altitudes are{' '}
            <strong>AGL, like these</strong>, so the two tables are directly comparable; the “MSL”
            on its page is the ground elevation it looked up, not the scale of its wind table.
          </p>
          <p className="muted small">
            Each 1,000-ft level is <strong>linearly interpolated</strong> from the model’s
            pressure-level winds (Open-Meteo gives wind at fixed pressure surfaces — e.g.
            925/850/700 hPa — with their geopotential heights, which we convert to ft MSL and
            interpolate to these AGL altitudes). Direction is interpolated along the shortest
            compass arc. These are a model <strong>forecast</strong> for the DZ, not a measured
            sounding, so treat them as guidance.
          </p>
        </>
      )}
    </Panel>
  );
}
