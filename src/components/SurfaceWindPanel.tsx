import type { CurrentConditions } from '../domain/types';
import { fmtLimitSpeed, fmtSpeed, round, toSpeed, type SpeedUnit } from '../domain/units';
import { EDITABLE_LIMITS, hasWindLimit, isEdited, isOwnLimit, ownLimits, type Thresholds } from '../config/thresholds';
import { lowerLimitPublished, lowerLimitUnchecked, windBandUse, withNotHere } from '../domain/advisories';
import { DATA_SOURCES } from '../config/sources';
import { spreadLabels } from './format';
import { Panel } from './common/Panel';
import { SourceLink } from './common/SourceLink';
import { SimTermSegments } from './common/SimTerm';
import { linkableTerms, splitGlossaryTerms } from '../config/simGlossary';

/**
 * Surface wind, against whatever limit a source has actually published for the
 * active profile.
 *
 * This is the most-read card on the page, and the band is a marker, not a
 * verdict. Only a published limit, or one the reader set as their own, is
 * drawn or named: the USPA ground-wind
 * figure for students, the posted club policy for the waiver tiers, or the
 * reader's own edit of one in Settings, which is marked "(edited)" and never
 * shown under the source's name alone. On Licensed, where nobody publishes
 * one, a limit the reader sets in Settings is drawn and named as theirs.
 *
 * Where nobody published one and the reader set none, there is no band, and
 * no surface-wind flag fires anywhere in the app at any speed. That makes this
 * card the only place the profile's own account of that absence can reach a
 * reader, so it prints here as a standing note with its citation, in a 3 kt
 * breeze and in a 60 kt gale alike. It is the same treatment the winds-aloft
 * and density-altitude cards give guidance whose trigger was removed for being
 * a number nobody published: keep the sourced claim, drop the invented
 * threshold, put the claim where it is always readable. A profile whose band
 * leaves a published limit unchecked says so the same way (`windBandCaveat`).
 *
 * The card is the observation and its published limit. The model's winds,
 * 500 ft included, are on the Winds aloft card, which labels them as a
 * forecast for an hour.
 *
 * Limits print through `fmtLimitSpeed`, not `fmtSpeed`: the waiver's top two
 * tiers post ceilings one mph apart, which collide at whole knots.
 */
export function SurfaceWindPanel({
  current,
  thresholds: t,
  label,
  unit,
  onUnitChange,
}: {
  current: CurrentConditions | null;
  thresholds: Thresholds;
  label: string;
  unit: SpeedUnit;
  /** Page-wide unit setter, handed to the header toggle. Required rather than
   *  optional: this is the most-read card on the page and the one a jumper
   *  compares against a wind limit quoted in mph, so it must never render
   *  without the switch. */
  onUnitChange: (u: SpeedUnit) => void;
}): JSX.Element {
  const speed = current?.wind.speedKt ?? null;
  const gust = current?.wind.gustKt ?? null;
  // Room past the highest mark, so a gust or limit at the top of the scale
  // draws inside the bar rather than on its right edge, where a 22 kt gust's
  // tick could not be seen (2026-10-10).
  const max = Math.max(t.windCautionKt + 6, t.gustCautionKt ?? 0, gust ?? 0, speed ?? 0) + 2;
  const pct = (v: number): number => Math.min(100, (v / max) * 100);
  const other: SpeedUnit = unit === 'kt' ? 'mph' : 'kt';
  const caveat = t.windBandCaveat;
  const windEdited = isEdited(t, 'windCautionKt');
  const gustEdited = isEdited(t, 'gustCautionKt');
  // The reader's own limits, set in Settings on Licensed where no source
  // publishes one: drawn and named like a published limit, and always
  // called theirs.
  const windOwn = isOwnLimit(t, 'windCautionKt');
  const gustOwn = isOwnLimit(t, 'gustCautionKt');
  const hasWind = hasWindLimit(t);
  // The limits drawn on the bar and checked below it, in that order.
  const limits: CardLimit[] = [
    ...(hasWind
      ? [
          {
            label: `${windOwn ? 'Your limit' : 'Caution'} ≥ ${fmtLimitSpeed(t.windCautionKt, unit)}${windEdited ? ' (edited)' : ''}`,
            // The caution is held to the higher of the two, as its flag is.
            heldTo: 'wind or gust',
            markClass: 'band-caution' as const,
            limitKt: t.windCautionKt,
            readingKt: speed == null ? null : gust != null ? Math.max(speed, gust) : speed,
            readingName: 'no wind reported',
          },
        ]
      : []),
    ...(t.gustCautionKt != null
      ? [
          {
            label: `${gustOwn ? 'Your gust ceiling' : 'Gust ceiling'} ${fmtLimitSpeed(t.gustCautionKt, unit)}${gustEdited ? ' (edited)' : ''}`,
            heldTo: 'gust',
            markClass: 'band-gust' as const,
            limitKt: t.gustCautionKt,
            readingKt: gust,
            readingName: 'no gust reported',
          },
        ]
      : []),
  ];
  // The note naming the reader's own limits, by the labels Settings and the
  // advisory list use. The figures go in only with no wind reading, when the
  // bar and the limit lines that print them are not shown.
  const ownNamed = ownLimits(t).map((k, i) => {
    const label = EDITABLE_LIMITS[k].ownLabel;
    const figure = speed == null ? ` (${fmtLimitSpeed(t[k] as number, unit)})` : '';
    return `${i === 0 ? label : label.charAt(0).toLowerCase() + label.slice(1)}${figure}`;
  });
  const ownBoth = ownNamed.length > 1;
  // The two standing notes come from the thresholds as plain strings, and
  // at most one of them shows (the caveat needs a published limit, the
  // guidance note its absence). A glossary term in either is linked unless
  // the note's own citation is the document the term names.
  const showCaveat = caveat != null && lowerLimitUnchecked(t);
  const caveatText = showCaveat
    ? splitGlossaryTerms(
        withNotHere(`${lowerLimitPublished(t, unit)} ${windBandUse(t, unit)}, so neither checks the lower one.`, t),
        linkableTerms([caveat.citation]),
      )
    : [];
  const guidanceText = splitGlossaryTerms(t.windGuidance, linkableTerms([t.windCitation]));

  return (
    <Panel
      title="Surface wind"
      /* The profile alone where a source sets its limits; the source is
         named on the citation line. On Licensed the subtitle says whose
         limits, if any, the bar draws, since no source sets one. */
      subtitle={
        t.windLimitCitation
          ? label
          : windOwn || gustOwn
            ? `${label} — your own limits`
            : `${label} — no published limit`
      }
      sources={[DATA_SOURCES.iemObservation, DATA_SOURCES.nwsObservation]}
      unit={unit}
      onUnitChange={onUnitChange}
    >
      {speed == null ? (
        <p className="muted">No wind data.</p>
      ) : (
        <>
          <div className="wind-readout">
            <span className="wind-big">{round(toSpeed(speed, unit))}</span>
            <span className="wind-unit">{unit}</span>
            <span className="wind-mph">({fmtSpeed(speed, other)})</span>
            {gust != null && <span className="wind-gust">gust {fmtSpeed(gust, unit)}</span>}
          </div>
          {/* One bar, every mark on it labelled with its figure: the limits
              above it, the wind (at the fill's end) and the gust below. Then
              one line per limit saying what it is held to and how far the
              reading is from it. Two bars and a key (2026-10-10) said each
              thing twice; one bar with a legend before that left the marks
              unnamed (the maintainer, both times). Only a limit a published
              source sets, the reader's marked edit of it, or the reader's
              own limit where none is published (set in Settings on Licensed,
              and called theirs) is drawn or named. There is no earlier
              "watch" marker: the one that used to sit a few knots under this
              was the app's own arithmetic, and putting an unsourced number
              beside sourced ones lent it their authority. */}
          <WindScale limits={limits} speedKt={speed} gustKt={gust} pct={pct} unit={unit} />
          {limits.length > 0 && (
            <ul className="wind-checks">
              {limits.map((l) => (
                <LimitCheck key={l.markClass} limit={l} unit={unit} />
              ))}
            </ul>
          )}
          {t.windLimitCitation && (
            <>
              {/* An edited figure is the reader's, from Settings, and the
                  link below does not set it; so when either is edited the
                  line names the published figures the link does vouch for. */}
              <p className="muted small">
                {windEdited || gustEdited ? (
                  <>
                    Edited in Settings. Published caution{' '}
                    {fmtLimitSpeed(t.published?.windCautionKt ?? t.windCautionKt, unit)}
                    {t.published?.gustCautionKt != null &&
                      `, gust ceiling ${fmtLimitSpeed(t.published.gustCautionKt, unit)}`}
                    :{' '}
                  </>
                ) : (
                  <>Caution{t.gustCautionKt != null ? ' and gust ceiling' : ''}: </>
                )}
                <SourceLink citation={t.windLimitCitation} />
              </p>
            </>
          )}
        </>
      )}
      {/* Standing note: a lower published limit the band does not check.
          BSR 2-1 H gives solo students two ground-wind maxima and the band
          acts on one; without this a student on a round reserve reads a card
          with no flag at their own limit. Both figures print in the card's
          unit from the live thresholds, and the band's half is the same
          phrase and the same test the flag uses (windBandUse,
          lowerLimitUnchecked), so the two cannot disagree. Outside the
          reading: it is about the profile, with or without one. */}
      {showCaveat && (
        <p className="muted small">
          <SimTermSegments segments={caveatText} />{' '}
          <SourceLink citation={caveat.citation} />
        </p>
      )}
      {/* Standing note, outside the reading above on purpose: it explains why
          this profile has no limit to draw and no flag to raise, which is true
          whether or not the station reported a wind this minute. */}
      {!t.windLimitCitation && (
        <>
          {/* Split in two: what this dashboard does, then what a source says.
              Running them together would let the app's own silence borrow the
              citation's authority. With an own limit set the band and flag
              are the reader's, and the first half says that instead. */}
          <p className="muted small">
            {windOwn || gustOwn ? (
              <>
                <strong>No published limit for this profile.</strong>{' '}
                {`${ownNamed.join(' and ')} ${ownBoth ? 'come' : 'comes'} from Settings, not a published source, and only you can check ${
                  ownBoth ? 'them' : 'it'
                }; the ${ownBoth ? 'bands and flags here fire at your figures' : 'band and flag here fire at your figure'}.`}
                {/* A gust ceiling alone leaves the steady wind unchecked:
                    said here, or a 35 kt wind with no gust group reads as
                    covered. */}
                {!windOwn &&
                  ' No wind limit is set, so the sustained wind draws no band and raises no flag at any speed.'}
              </>
            ) : (
              <>
                <strong>No published limit for this profile</strong>, so there is no band to draw —
                and no surface-wind flag appears under &ldquo;Conditions to note&rdquo; at any speed.
                The reading is the observation; judging it is yours. You can set your own limit in
                Settings at the foot of the page.
              </>
            )}
          </p>
          <p className="muted small">
            <SimTermSegments segments={guidanceText} /> Source: <SourceLink citation={t.windCitation} />
          </p>
        </>
      )}
    </Panel>
  );
}

/** A limit as the card draws and checks it. */
interface CardLimit {
  /** "Caution ≥ 15.6 kt", "Your gust ceiling 20 kt (edited)". */
  label: string;
  /** What the limit is held to, as its flag holds it. */
  heldTo: string;
  markClass: 'band-caution' | 'band-gust';
  limitKt: number;
  /** The reading it is held to, or null with none reported. */
  readingKt: number | null;
  /** What to call a missing reading: "no gust reported". */
  readingName: string;
}

/** Bar label positions are kept this far from each other and from the
 *  ends, in percent of the bar: wide enough for "17.4" at 320 px. */
const LABEL_GAP = 14;
const LABEL_EDGE = 6;

function WindScale({
  limits,
  speedKt,
  gustKt,
  pct,
  unit,
}: {
  limits: readonly CardLimit[];
  speedKt: number;
  gustKt: number | null;
  pct: (v: number) => number;
  unit: SpeedUnit;
}): JSX.Element {
  const top = spreadLabels(limits.map((l) => pct(l.limitKt)), LABEL_GAP, LABEL_EDGE, 100 - LABEL_EDGE);
  const readings = [speedKt, ...(gustKt != null ? [gustKt] : [])];
  const bottom = spreadLabels(readings.map(pct), LABEL_GAP, LABEL_EDGE, 100 - LABEL_EDGE);
  // The figures alone: the unit is the readout's and the toggle's, and a
  // limit's name is on its line below, beside the same coloured mark.
  const figure = (kt: number, limit: boolean): string =>
    (limit ? fmtLimitSpeed(kt, unit) : fmtSpeed(kt, unit)).replace(` ${unit}`, '');
  const described = [
    `Wind ${fmtSpeed(speedKt, unit)}`,
    ...(gustKt != null ? [`gust ${fmtSpeed(gustKt, unit)}`] : []),
    ...limits.map((l) => l.label),
  ].join('; ');
  return (
    <div className="wind-scale" role="img" aria-label={described}>
      {limits.length > 0 && (
        <div className="wind-scale-labels" aria-hidden="true">
          {limits.map((l, i) => (
            <span key={l.markClass} className={`wind-scale-label ${l.markClass}-text`} style={{ left: `${top[i]}%` }}>
              {figure(l.limitKt, true)}
            </span>
          ))}
        </div>
      )}
      <div className="wind-bar">
        {limits.map((l) => (
          <div key={l.markClass} className={`wind-band ${l.markClass}`} style={{ left: `${pct(l.limitKt)}%` }} />
        ))}
        <div className="wind-fill" style={{ width: `${pct(speedKt)}%` }} />
        {gustKt != null && <div className="wind-gust-tick" style={{ left: `${pct(gustKt)}%` }} />}
      </div>
      <div className="wind-scale-labels" aria-hidden="true">
        <span className="wind-scale-label wind-label" style={{ left: `${bottom[0]}%` }}>
          {figure(speedKt, false)}
        </span>
        {gustKt != null && (
          <span className="wind-scale-label gust-label" style={{ left: `${bottom[1]}%` }}>
            {figure(gustKt, false)}
          </span>
        )}
      </div>
    </div>
  );
}

/** One limit's line under the bar: its mark, its name and what it is held
 *  to, and how far the reading is from it. The distance is worked from the
 *  two figures as printed, so they add up on screen: rounded apart, a 17.6
 *  mph reading (18) and a 20.4 mph limit (20) left "3 mph under". In mph a
 *  reading can round up to the limit it is still under; that one says so
 *  without a figure, and one that rounds to the figure of a limit it reached
 *  or passed says "at or above", the flag's own words. */
function LimitCheck({ limit: l, unit }: { limit: CardLimit; unit: SpeedUnit }): JSX.Element {
  const over = l.readingKt != null && l.readingKt >= l.limitKt;
  const places = unit === 'kt' ? 1 : 0;
  const diff =
    l.readingKt == null
      ? 0
      : round(Math.abs(round(toSpeed(l.limitKt, unit), places) - round(toSpeed(l.readingKt, unit))), places);
  const status =
    l.readingKt == null
      ? l.readingName
      : over
        ? diff > 0
          ? `${diff} ${unit} over`
          : 'at or above'
        : diff > 0
          ? `${diff} ${unit} under`
          : 'just under';
  return (
    <li className="wind-check">
      <span className={`key-mark ${l.markClass}`} aria-hidden="true" />
      <span className="wind-check-label">
        {l.label} <span className="muted">· {l.heldTo}</span>
      </span>
      <span className={`wind-check-status${over ? ' over' : ''}`}>{status}</span>
    </li>
  );
}
