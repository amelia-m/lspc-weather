import type { CurrentConditions } from '../domain/types';
import { fmtLimitSpeed, fmtSpeed, round, toSpeed, type SpeedUnit } from '../domain/units';
import { hasWindLimit, isEdited, isOwnLimit, type Thresholds } from '../config/thresholds';
import { lowerLimitPublished, lowerLimitUnchecked, windBandUse } from '../domain/advisories';
import { DATA_SOURCES } from '../config/sources';
import { Panel } from './common/Panel';
import { SourceLink } from './common/SourceLink';
import { SimTermSegments } from './common/SimTerm';
import { linkableTerms, splitGlossaryTerms } from '../config/simGlossary';

/**
 * Surface wind, against whatever limit a source has actually published for the
 * active profile.
 *
 * This is the most-read card on the page, and the band is a marker, not a
 * verdict. Only a published limit is drawn or named: the USPA ground-wind
 * figure for students, the posted club policy for the waiver tiers, or the
 * reader's own edit of one in Settings, which is marked "(edited)" and never
 * shown under the source's name alone.
 *
 * Where nobody published one — licensed jumpers — there is no band, and no
 * surface-wind flag fires anywhere in the app at any speed. That makes this
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
  const max = Math.max(t.windCautionKt + 6, t.gustCautionKt ?? 0, gust ?? 0, speed ?? 0);
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
  const anyLimit = hasWind || t.gustCautionKt != null;
  // The two standing notes come from the thresholds as plain strings, and
  // at most one of them shows (the caveat needs a published limit, the
  // guidance note its absence). A glossary term in either is linked unless
  // the note's own citation is the document the term names.
  const showCaveat = caveat != null && lowerLimitUnchecked(t);
  const caveatText = showCaveat
    ? splitGlossaryTerms(
        `${lowerLimitPublished(t, unit)} ${windBandUse(t, unit)}, so neither checks the lower one.`,
        linkableTerms([caveat.citation]),
      )
    : [];
  const guidanceText = splitGlossaryTerms(t.windGuidance, linkableTerms([t.windCitation]));

  return (
    <Panel
      title="Surface wind"
      /* "flag bands" is only true where a source set one. On the licensed
         profile it named bands over a bar that draws none, for a profile that
         raises no wind flag — a label describing a different card. */
      subtitle={
        t.windLimitCitation
          ? `${label} flag bands`
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
          <div className="wind-bar" role="img" aria-label={`Wind ${round(speed)} knots`}>
            {hasWind && <div className="wind-band band-caution" style={{ left: `${pct(t.windCautionKt)}%` }} />}
            {t.gustCautionKt != null && (
              <div className="wind-band band-gust" style={{ left: `${pct(t.gustCautionKt)}%` }} />
            )}
            <div className="wind-fill" style={{ width: `${pct(speed)}%` }} />
            {gust != null && <div className="wind-gust-tick" style={{ left: `${pct(gust)}%` }} />}
          </div>
          {/* Only a limit a published source sets, the reader's marked edit
              of it, or the reader's own limit where none is published (set
              in Settings on Licensed, and called theirs) is drawn or
              named. There is
              no earlier "watch" marker: the one that used to sit a few knots
              under this was the app's own arithmetic, and putting an unsourced
              number on the card beside sourced ones lent it their authority.
              It raises no flag now either — it does not exist. */}
          {anyLimit && (
            <p className="wind-legend">
              {hasWind && (
                <>
                  {windOwn ? 'Your limit' : 'Caution'} ≥ {fmtLimitSpeed(t.windCautionKt, unit)}
                  {windEdited && ' (edited)'}
                </>
              )}
              {hasWind && t.gustCautionKt != null && ' · '}
              {t.gustCautionKt != null &&
                `${gustOwn ? 'Your gust ceiling' : 'Gust ceiling'} ${fmtLimitSpeed(t.gustCautionKt, unit)}${gustEdited ? ' (edited)' : ''}`}
            </p>
          )}
          {/* An own limit has no source to link: the reader set it. */}
          {(windOwn || gustOwn) && (
            <p className="muted small">
              Your own, set in Settings. No published source sets a {windOwn ? 'wind limit' : 'gust ceiling'}
              {windOwn && gustOwn ? ' or gust ceiling' : ''} for this profile, so only you can check{' '}
              {windOwn && gustOwn ? 'them' : 'it'}.
            </p>
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
            {windOwn ? (
              <>
                <strong>No published limit for this profile.</strong> The band and the surface-wind
                flag here are your own limit from Settings.
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
