import { useState } from 'react';
import type { CurrentConditions, WindsAloftLevel, WindsAloftSource, WindsAloftValidity, WindsMethod } from '../domain/types';
import { compass, fmtSpeed, fmtTemp, type SpeedUnit, type TempUnit } from '../domain/units';
import { windsAloftTop } from '../domain/windsAloft';
import { METAR_STATION_OFFSET, SITE, WINDS_ALOFT_LEVELS_AGL } from '../config/site';
import { DATA_SOURCES, windsAloftSourceInUse } from '../config/sources';
import { FallbackSources } from './common/FallbackSources';
import { CITATIONS } from '../config/thresholds';
import { useNow } from '../hooks/useNow';
import { Panel } from './common/Panel';
import { SourceLink } from './common/SourceLink';
import { SimTerm } from './common/SimTerm';
import { ForecastHourNav, type WindsHourNav } from './common/ForecastHourNav';
import { describeWind, fmtClock } from './format';

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
  tempUnit = 'F',
  onTempUnitChange,
  method = 'all',
  onMethodChange,
  schulzeAvailable = false,
  schulzeGroundFtMsl = null,
  observed = null,
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
  /** Page-wide temperature unit and its setter, for the card's °F/°C switch.
   *  Optional so a test can render the card without them; App passes both. */
  tempUnit?: TempUnit;
  onTempUnitChange?: (u: TempUnit) => void;
  /** Which table to show: every sample this app takes, or the table as Mark
   *  Schulze's tool builds it. Page-wide, shared with the drift card. */
  method?: WindsMethod;
  onMethodChange?: (m: WindsMethod) => void;
  /** Whether this hour has the Schulze-method table (Open-Meteo only). */
  schulzeAvailable?: boolean;
  /** The ground Mark Schulze's altitudes count from, ft MSL (useWindsHour);
   *  null where it is not known. */
  schulzeGroundFtMsl?: number | null;
  /** KPMV's latest report, shown under the table as the one measured
   *  figure beside the forecast (the maintainer, 2026-10-30); null until
   *  it has loaded, or in a test that has none. */
  observed?: CurrentConditions | null;
}): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  // The table on screen is his way only when asked for AND this hour has it;
  // otherwise useWindsHour passed the default through, and the text must say
  // so whatever the stored setting.
  const schulzeView = method === 'schulze' && schulzeAvailable;
  // Ticks each minute so the "ahead of now" offset stays true between the
  // 10-minute data polls rather than freezing at fetch time.
  const now = useNow(60_000);
  const validMs = validity?.validMs ?? null;
  const shifted = hourNav != null && !hourNav.following;
  // Always keep the lowest level the source offers, whether or not it lands on
  // the key set. That set assumes the lowest row is the surface; a profile
  // that starts higher (an hour whose low samples came back null) would
  // otherwise open the collapsed table above its own floor and hide the
  // level the drift card names as the one it assumes all the way down.
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
      subtitle="freefall drift / spot"
      footer={
        <FallbackSources
          inUse={windsAloftSourceInUse(source)}
          usual={[DATA_SOURCES.openMeteo]}
          withUsual={[DATA_SOURCES.markschulze]}
        />
      }
      unit={unit}
      onUnitChange={onUnitChange}
      tempUnit={tempUnit}
      onTempUnitChange={onTempUnitChange}
    >
      {levels.length > 0 && (
        <>
          {validMs != null ? (
            <>
              <ForecastHourNav validMs={validMs} now={now} hourNav={hourNav} />
              <p className="muted small">
                {shifted
                  ? 'You stepped to this hour, so the table no longer follows the clock.'
                  : 'Follows the hour nearest the clock; moves on at half past.'}
              </p>
            </>
          ) : (
            <p className="muted small">
              This source stated no forecast valid time, so the hour these winds
              are for cannot be shown.
            </p>
          )}
          {schulzeAvailable && onMethodChange && (
            <>
              <div className="range-toggle" role="group" aria-label="How the table is built">
                {(['all', 'schulze'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={m === method ? 'active' : ''}
                    aria-pressed={m === method}
                    onClick={() => onMethodChange(m)}
                  >
                    {m === 'all' ? 'All levels' : 'As Schulze'}
                  </button>
                ))}
              </div>
              <p className="muted small">
                {method === 'schulze'
                  ? 'As Schulze: his pressure levels only, his ground, his Surface row, to check this table against his.'
                  : 'All levels: every sample this app takes. As Schulze: his pressure levels only, and his Surface row.'}
              </p>
            </>
          )}
        </>
      )}
      {levels.length === 0 ? (
        <p className="muted">
          No winds-aloft data.
          {/* With nothing loaded the Data line credits nobody, so the
              second place to look is offered here instead. */}
          {source == null && (
            <>
              {' '}
              <a href={DATA_SOURCES.markschulze.url} target="_blank" rel="noopener noreferrer">
                Mark Schulze&rsquo;s Winds Aloft
              </a>{' '}
              is another place to look.
            </>
          )}
        </p>
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
                <td>{l.tempC != null ? fmtTemp(l.tempC, tempUnit) : '—'}</td>
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
      {/* The measurement beside the forecast (the maintainer, 2026-10-30:
          put KPMV's observation where the forecast is read). It is the one
          measured figure on this card, from another place and time than
          the table's Surface row, so the line says the station, its
          distance from the DZ, the report's time, and that it is a report.
          The same report, with its limits, is the Surface wind card. */}
      {observed && levels.length > 0 && (
        <p className="wind-observed">
          <strong>Observed</strong> at {observed.station} ({Math.round(METAR_STATION_OFFSET.distanceMi)} mi{' '}
          {METAR_STATION_OFFSET.compass} of the DZ), {fmtClock(observed.observedAt)}: {describeWind(observed, unit)}.
          A report, not a row of the forecast above.
        </p>
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
        Strong upper winds increase freefall drift and lengthen the spot — plan <SimTerm term="jumpRun">jump run</SimTerm> and
        exit separation accordingly. Source: <SourceLink citation={CITATIONS.uspaSpotting} />
      </p>
      {!expanded && toggleable && collapsedTopFtAgl != null && top.highestFtAgl != null && (
        <p className="muted small">
          Showing key altitudes to {fmtFt(collapsedTopFtAgl)}
          {collapsedTopFtAgl === 10000 ? ' (LSPC’s usual max)' : ''}. Expand for every
          level up to {fmtFt(top.highestFtAgl)}.
        </p>
      )}
      {levels.length > 0 ? (
        /* What a reader needs to read the numbers right stays out, in one
           line: that they are a forecast, what the Surface row is, and the
           two things that make Mark Schulze's table look different (its
           AGL scale and its hour). The why of each, and how the levels are
           worked out, is the #winds-method page, linked below, so the card
           leads with the table and the guidance. The missing-levels note
           under the table is about this report and stays out too. */
        <>
          <p className="muted small">
            A model <strong>forecast</strong> for the DZ, not a measurement.
            {source === 'open-meteo' && (
              <>
                {' '}
                {schulzeView
                  ? 'In this view the Surface row is built his way, not the model’s 10\u00a0m wind; the observed wind is under the table and on the Surface wind card.'
                  : 'The Surface row is the model’s 10\u00a0m wind; the observed wind is under the table and on the Surface wind card.'}
              </>
            )}{' '}
            Mark Schulze&rsquo;s tool reads the same data;{' '}
            {schulzeView
              ? 'this view is built his way'
              : `this table takes samples his does not${schulzeAvailable ? ' (“As Schulze” rebuilds it his way)' : ''}`}
            , and after half past his is the hour before this one.
          </p>
          {/* The why of each line above, and how the levels are worked out,
              is a page of its own (#winds-method, since 2026-11-22: the card
              folded 464 words here). The one figure that changes with the
              hour stays on the card: which ground his table counts from,
              read off the his-way table (useWindsHour), not typed. */}
          <p className="muted small">
            {source === 'open-meteo' && schulzeGroundFtMsl != null && schulzeGroundFtMsl !== SITE.dz.elevationFt && (
              <>
                His altitudes count from Open-Meteo&rsquo;s ground at the pin, {schulzeGroundFtMsl.toLocaleString()}&nbsp;ft,
                against the field&rsquo;s {SITE.dz.elevationFt.toLocaleString()}&nbsp;ft, so his rows sit about{' '}
                {Math.abs(SITE.dz.elevationFt - schulzeGroundFtMsl)}&nbsp;ft{' '}
                {schulzeGroundFtMsl < SITE.dz.elevationFt ? 'lower' : 'higher'}
                {schulzeView ? ' than the All levels table’s' : ''}.{' '}
              </>
            )}
            <a href="#winds-method">How this table is built, and how it compares with Mark Schulze&rsquo;s tool</a>.
          </p>
        </>
      ) : null}
    </Panel>
  );
}
