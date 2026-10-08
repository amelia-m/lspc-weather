import { useState } from 'react';
import {
  LSPC_STUDENT_NAVIGATOR_SIZES,
  NAVIGATOR_CHART,
  NAVIGATOR_SKILL_LABEL,
  NAVIGATOR_SKILLS,
  STUDENT_RIG_WEIGHT_LB,
} from '../config/canopies';
import { CITATIONS } from '../config/thresholds';
import { againstChart, exitWeightLb, LB_PER_KG, sizesWithin, wingLoading } from '../domain/wingLoading';
import { round } from '../domain/units';
import { Panel } from './common/Panel';
import { SourceLink } from './common/SourceLink';

/** Above these an entry is taken for a typo (an extra zero) rather than
 *  worked out into figures that look authoritative. Input bounds, not
 *  limits: nothing is flagged against them. */
const MAX_BODY_LB = 500;
const MAX_GEAR_LB = 100;

/** A number the reader typed, or null while the box is empty, not a number,
 *  not above zero, or above `max`. */
const parse = (s: string, max: number): number | null => {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 && n <= max ? n : null;
};

/**
 * Exit weight and wing loading on the club's student canopies, against
 * Performance Designs' published maximum exit weights for the Navigator.
 *
 * Body weight starts empty and is not stored: a default weight would print a
 * wing loading for nobody, and on a shared computer at the DZ a remembered
 * weight is someone else's. Gear starts at the one student rig weighed
 * (STUDENT_RIG_WEIGHT_LB) and can be changed.
 *
 * The comparison is with PD's Student figure and nothing else: how far above
 * or below it the exit weight is, in pounds, and which of the club's sizes
 * have a Student figure at or above it. The other columns are shown for
 * reference. The exit weight is rounded to whole pounds BEFORE it is
 * compared, so the figure printed, the margin and the size list always agree
 * with each other (PD's figures are whole pounds too). Which canopy a student jumps is the
 * instructor's call; the card makes none.
 */
export function WingLoadingPanel({
  initialBodyLb,
}: {
  /** For a test to render a worked example; the app passes nothing, so the
   *  box starts empty. */
  initialBodyLb?: number;
}): JSX.Element {
  const [body, setBody] = useState(initialBodyLb != null ? String(initialBodyLb) : '');
  const [gear, setGear] = useState(String(STUDENT_RIG_WEIGHT_LB));
  const [area, setArea] = useState(LSPC_STUDENT_NAVIGATOR_SIZES[LSPC_STUDENT_NAVIGATOR_SIZES.length - 1]);
  const bodyLb = parse(body, MAX_BODY_LB);
  const gearLb = parse(gear, MAX_GEAR_LB);
  const size = NAVIGATOR_CHART.find((s) => s.areaSqFt === area)!;
  const exitLb = bodyLb != null && gearLb != null ? round(exitWeightLb(bodyLb, gearLb)) : null;
  const student = exitLb != null ? againstChart(exitLb, size, 'student') : null;
  const fits = exitLb != null ? sizesWithin(exitLb, NAVIGATOR_CHART, LSPC_STUDENT_NAVIGATOR_SIZES, 'student') : [];
  const prompt =
    body.trim() === ''
      ? 'Enter a body weight to work out exit weight and wing loading.'
      : bodyLb == null
        ? `Check the body weight: a number of pounds above 0 and up to ${MAX_BODY_LB}.`
        : gearLb == null
          ? `Check the gear weight: a number of pounds above 0 and up to ${MAX_GEAR_LB}.`
          : null;

  return (
    <Panel title="Exit weight & wing loading" subtitle="student canopies (PD Navigator)">
      <div className="drift-inputs">
        <label>
          Body weight (lb)
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            value={body}
            placeholder="enter"
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <label>
          Gear (lb)
          <input type="number" inputMode="decimal" step="any" min={0} value={gear} onChange={(e) => setGear(e.target.value)} />
        </label>
        <label>
          Navigator (sq ft)
          <select value={area} onChange={(e) => setArea(Number(e.target.value))}>
            {LSPC_STUDENT_NAVIGATOR_SIZES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Announced as it changes: the figures update as the reader types. */}
      <div aria-live="polite">
        {prompt != null || exitLb == null || student == null ? (
          <p className="muted small">{prompt}</p>
        ) : (
          <dl className="kv wl-kv">
            <dt>Exit weight</dt>
            <dd>
              {exitLb} lb ({round(exitLb / LB_PER_KG)} kg)
            </dd>
            <dt>Wing loading</dt>
            <dd>{wingLoading(exitLb, area).toFixed(2)} lb/sq ft</dd>
            {/* PD's own kg figure, not a conversion of its pounds: the chart
                rounds each, and 270 lb converts to 122 kg where it prints 123. */}
            <dt>PD Student max, {area}</dt>
            <dd>
              {student.maxLb} lb ({size.maxExit.student[1]} kg)
            </dd>
            <dt>Against it</dt>
            <dd>
              {student.marginLb > 0
                ? `${student.marginLb} lb under`
                : student.marginLb < 0
                  ? `${-student.marginLb} lb over`
                  : 'at it'}
            </dd>
            {/* Named for the arithmetic it is, not as a list to pick from:
                "Sizes within it" read as a shortlist, and which canopy a
                student jumps is the instructor's call. */}
            <dt>Sizes whose PD Student max is at or above this weight</dt>
            <dd className="wl-list">{fits.length > 0 ? fits.join(', ') : 'none of the sizes offered'}</dd>
          </dl>
        )}
      </div>

      <div className="sky-scroll">
        <table className="aloft-table">
          <thead>
            <tr>
              <td />
              {NAVIGATOR_SKILLS.map((k) => (
                <th key={k} scope="col">
                  {NAVIGATOR_SKILL_LABEL[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Navigator {area}, max exit (lb)</th>
              {NAVIGATOR_SKILLS.map((k) => (
                <td key={k}>{size.maxExit[k][0]}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted small">
        PD&rsquo;s maximum exit weight for each category on this size; the comparison above uses
        the Student figure only. Gear is one student rig weighed (about {STUDENT_RIG_WEIGHT_LB} lb);
        change it for yours. Body weight is not saved. PD gives its Student figures &ldquo;mainly to
        help instructors&rdquo; choose a student&rsquo;s canopy: which canopy a student jumps is the
        instructor&rsquo;s call. Sources: <SourceLink citation={CITATIONS.pdNavigator} />;{' '}
        <SourceLink citation={CITATIONS.pdWingLoadingGuide} />
      </p>
    </Panel>
  );
}
