import { useState } from 'react';
import type { WindsAloftLevel, WindsAloftSource, WindsAloftValidity } from '../domain/types';
import { compass, cToF, fmtSpeed, round, type SpeedUnit } from '../domain/units';
import { windsAloftTop } from '../domain/windsAloft';
import { SITE, WINDS_ALOFT_LEVELS_AGL } from '../config/site';
import { DATA_SOURCES } from '../config/sources';
import { CITATIONS } from '../config/thresholds';
import { useNow } from '../hooks/useNow';
import { Panel } from './common/Panel';
import { SourceLink } from './common/SourceLink';
import { ForecastHourNav, type WindsHourNav } from './common/ForecastHourNav';
import { fmtTime, fmtZulu } from './format';

/** Altitudes (ft AGL) shown when the card is collapsed. LSPC jumps top out
 *  around 10,000 ft, so the default view stops there and keeps the low levels
 *  that matter for the landing pattern and opening (surface, 500, 1k, 3k) plus a
 *  couple in between for the exit/freefall drift. Expanding reveals every
 *  level the source answered for, up to the top of `WINDS_ALOFT_LEVELS_AGL`
 *  when the profile is complete. */
const COLLAPSED_ALTITUDES_FT = new Set([0, 500, 1000, 3000, 5000, 7000, 10000]);

/** "9,000 ft" — the form every altitude on this card takes. */
const fmtFt = (ft: number): string => `${ft.toLocaleString()} ft`;

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
  hourNav,
  unit,
  onUnitChange,
}: {
  levels: WindsAloftLevel[];
  source: WindsAloftSource | null | undefined;
  /** When these levels are valid. Undefined until winds aloft have loaded. */
  validity?: WindsAloftValidity | null;
  /** Step buttons; absent on a source with one hour. */
  hourNav?: WindsHourNav | null;
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
  const shifted = hourNav != null && !hourNav.following;
  // Always keep the lowest level the source offers, whether or not it lands on
  // the key set. That set was picked for the primary path, whose lowest row is
  // the surface; on the NOAA FD fallback the profile starts at 2,000 ft AGL,
  // which the set does not contain — so the collapsed table used to open at
  // 3,000 ft and hide the closest thing to a landing-pattern wind that path
  // has. Worse, it is the level the drift card names as the one it assumes all
  // the way down, and the note under the table says levels below the
  // bulletin's floor are not listed, so a reader had every reason to read
  // 3,000 ft as the floor.
  const lowestFtAgl = levels.length > 0 ? Math.min(...levels.map((l) => l.altitudeFtAgl)) : null;
  const collapsedLevels = levels.filter(
    (l) => COLLAPSED_ALTITUDES_FT.has(l.altitudeFtAgl) || l.altitudeFtAgl === lowestFtAgl,
  );
  // The key set assumes the whole-thousand grid. If the level altitudes ever
  // stop intersecting it, don't hide every row behind a collapse — show all and
  // drop the toggle. Only collapse when it actually thins a non-empty subset.
  const canCollapse = collapsedLevels.length > 0 && collapsedLevels.length < levels.length;
  const shown = expanded || !canCollapse ? levels : collapsedLevels;
  const toggleable = canCollapse;
  // Where the profile actually ends, against the altitudes the hook asked for
  // (the same list, so the two cannot disagree). Every "up to" on this card is
  // derived from it: the toggle and the collapsed note used to hard-code the
  // configured top, so a profile that stopped short — Open-Meteo serving nulls
  // above 700 hPa ends the table at 9,000 ft — was offered as running to
  // 13k, with nothing to say the upper rows were missing rather than folded.
  const top = windsAloftTop(levels, WINDS_ALOFT_LEVELS_AGL);
  const collapsedTopFtAgl =
    collapsedLevels.length > 0 ? Math.max(...collapsedLevels.map((l) => l.altitudeFtAgl)) : null;
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
            <>
              <ForecastHourNav validMs={validMs} now={now} hourNav={hourNav} />
              <p className="muted small">
                Now {fmtTime(now)}.{' '}
                {shifted
                  ? 'You stepped to this hour, so the table no longer follows the clock. '
                  : fallback
                    ? 'The FD bulletin is issued every 6 hours, so the nearest one is used.'
                    : 'The model steps hourly, so the table follows the hour nearest the clock and moves on at half past.'}
              </p>
            </>
          ) : (
            <p className="muted small">
              This source stated no forecast valid time, so the hour these winds
              are for cannot be shown.
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
      {/* An observed fact about this report, in words: the rows are absent
          because no sample covered them (see `windsAloftTop`), not folded away
          by the collapse. Both figures are derived, never typed in. */}
      {top.stopsShort && top.highestFtAgl != null && top.requestedFtAgl != null && (
        <p className="muted small">
          This report has no wind above {fmtFt(top.highestFtAgl)} AGL, so the rows above it are
          not shown. The table normally runs to {fmtFt(top.requestedFtAgl)}.
        </p>
      )}
      {toggleable && top.highestFtAgl != null && (
        <button
          type="button"
          className="aloft-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded
            ? 'Show fewer altitudes'
            : `Show more altitudes (more increments, up to ${fmtFt(top.highestFtAgl)})`}
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
      {!expanded && toggleable && collapsedTopFtAgl != null && top.highestFtAgl != null && (
        <p className="muted small">
          Showing key altitudes to {fmtFt(collapsedTopFtAgl)}
          {collapsedTopFtAgl === 10000 ? ' (LSPC’s usual max)' : ''}. Expand for every
          level up to {fmtFt(top.highestFtAgl)}.
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
      ) : levels.length > 0 ? (
        /* What a reader needs to read the numbers right stays out, in one
           line: that they are a forecast, what the Surface row is, and the
           two things that make Mark Schulze's table look different (its
           AGL scale and its hour). The why of each, and how the levels are
           worked out, is folded below so the card leads with the table and
           the guidance. The fallback note above, and the missing-levels
           note under the table, are about this report and stay out too. */
        <>
          <p className="muted small">
            A model <strong>forecast</strong> for the DZ, not a measurement.
            {source === 'open-meteo' && (
              <>
                {' '}
                The Surface row is the model&rsquo;s 10&nbsp;m wind; the observed wind is on the
                Surface wind card.
              </>
            )}{' '}
            Against Mark Schulze&rsquo;s tool: same data, altitudes AGL on both, and after half past
            its table is the hour before this one.
          </p>
          <details className="aloft-about">
            <summary className="small">
              About these numbers: comparing with Mark Schulze&rsquo;s tool,
              {source === 'open-meteo' ? ' the Surface row,' : ''} how levels are worked out
            </summary>
            <p className="muted small">
              Same Open-Meteo data source as{' '}
              <a href={DATA_SOURCES.markschulze.url} target="_blank" rel="noopener noreferrer">
                Mark Schulze’s Winds Aloft
              </a>
              , the popular skydiving winds tool — so if its numbers differ from these, check its
              stated valid time (it labels forecasts in Z, e.g. “1600Z”) against the one above
              before assuming the data disagrees: this card follows the hour nearest the clock, that
              tool the hour in progress, so after half past the two are an hour apart until one of
              them is stepped with its hour buttons. Even on the same hour the two have shown
              different forecast runs, for up to about half an hour and most often between half past
              and ten to the hour; if they disagree then, look again later. Its
              altitudes are{' '}
              <strong>AGL, like these</strong>, so the two tables are directly comparable; the “MSL”
              on its page is the ground elevation it looked up, not the scale of its wind table.
            </p>
            {/* Their Surface rows measure different things, and the gap is the
                one readers notice first: worked out from 72 hours of that tool's
                output at four sites on 2026-10-03, see
                docs/markschulze-altitude-reference.md. No figure is quoted for
                how far apart they run; it changes with the hour and the weather.
                Gated on Open-Meteo, not on "not the fallback": with no source
                loaded this branch still renders, beside "No winds-aloft data",
                and the note would describe a Surface row and an hour that are
                not there. */}
            {source === 'open-meteo' && (
              <p className="muted small">
                The <strong>Surface</strong> row here is the model&rsquo;s wind at 10&nbsp;m (33&nbsp;ft),
                the height an airport wind sensor measures, forecast for the hour above; the observed
                wind is on the Surface wind card. Mark Schulze&rsquo;s Surface row is not a 10&nbsp;m
                wind: it draws a straight line through the model&rsquo;s pressure levels and reads it at
                the ground, here between a level the model places below the ground and the next one up.
                So it reads more like the wind a couple of hundred feet up, and
                often shows more wind than this row, most of all at night, when the air near the ground
                goes calm while the air above keeps moving.
              </p>
            )}
            <p className="muted small">
              Each level is <strong>linearly interpolated</strong> from the model’s
              pressure-level winds (Open-Meteo gives wind at fixed pressure surfaces — e.g.
              925/850/700 hPa — with their geopotential heights, which we convert to ft MSL and
              interpolate to these AGL altitudes). Direction is interpolated along the shortest
              compass arc. These are a model <strong>forecast</strong> for the DZ, not a measured
              sounding, so treat them as guidance.
            </p>
          </details>
        </>
      ) : null}
    </Panel>
  );
}
