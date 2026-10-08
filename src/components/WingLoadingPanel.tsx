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

const lbKg = (lb: number): string => `${round(lb)} lb (${round(lb / LB_PER_KG)} kg)`;

/** A number the reader typed, or null while the box is empty or not a number. */
const parse = (s: string): number | null => {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Exit weight and wing loading on the club's student canopies, against
 * Performance Designs' published maximums for the Navigator.
 *
 * Body weight starts empty and is not stored: a default weight would print a
 * wing loading for nobody, and on a shared computer at the DZ a remembered
 * weight is someone else's. Gear starts at the one student rig weighed
 * (STUDENT_RIG_WEIGHT_LB) and can be changed.
 *
 * The comparison is with PD's figure and nothing else: the card says how far
 * above or below it the exit weight is, in pounds, and which sizes the club
 * offers that it falls within. Which canopy a student jumps is the
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
  const bodyLb = parse(body);
  const gearLb = parse(gear);
  const size = NAVIGATOR_CHART.find((s) => s.areaSqFt === area)!;
  const exitLb = bodyLb != null && gearLb != null ? exitWeightLb(bodyLb, gearLb) : null;
  const student = exitLb != null ? againstChart(exitLb, size, 'student') : null;
  const fits = exitLb != null ? sizesWithin(exitLb, NAVIGATOR_CHART, LSPC_STUDENT_NAVIGATOR_SIZES, 'student') : [];

  return (
    <Panel title="Exit weight & wing loading" subtitle="student canopies (PD Navigator)">
      <div className="drift-inputs">
        <label>
          Body weight (lb)
          <input type="number" inputMode="decimal" min={1} value={body} placeholder="enter" onChange={(e) => setBody(e.target.value)} />
        </label>
        <label>
          Gear (lb)
          <input type="number" inputMode="decimal" min={1} value={gear} onChange={(e) => setGear(e.target.value)} />
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

      {exitLb == null ? (
        <p className="muted small">Enter a body weight to work out exit weight and wing loading.</p>
      ) : (
        <dl className="kv">
          <dt>Exit weight</dt>
          <dd>{lbKg(exitLb)}</dd>
          <dt>Wing loading</dt>
          <dd>{round(wingLoading(exitLb, area), 2).toFixed(2)} lb/sq ft</dd>
          {/* PD's own kg figure, not a conversion of its pounds: the chart
              rounds each, and 270 lb converts to 122 kg where it prints 123. */}
          <dt>PD Student max, {area}</dt>
          <dd>
            {student!.maxLb} lb ({size.maxExit.student[1]} kg)
          </dd>
          <dt>Against it</dt>
          <dd>{student!.marginLb >= 0 ? `${round(student!.marginLb)} lb under` : `${round(-student!.marginLb)} lb over`}</dd>
          <dt>Sizes within it</dt>
          <dd>{fits.length > 0 ? fits.join(', ') : 'none of the sizes offered'}</dd>
        </dl>
      )}

      <div className="sky-scroll">
        <table className="aloft-table">
          <thead>
            <tr>
              <th>Navigator {area}</th>
              {NAVIGATOR_SKILLS.map((k) => (
                <th key={k}>{NAVIGATOR_SKILL_LABEL[k]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Max exit (lb)</td>
              {NAVIGATOR_SKILLS.map((k) => (
                <td key={k}>{size.maxExit[k][0]}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted small">
        PD&rsquo;s recommended maximum exit weight for each skill set on this size. Gear is one student
        rig weighed (about {STUDENT_RIG_WEIGHT_LB} lb); change it for yours. Body weight is not saved.
        Which canopy a student jumps is the instructor&rsquo;s call. Source:{' '}
        <SourceLink citation={CITATIONS.pdNavigator} />
      </p>
    </Panel>
  );
}
