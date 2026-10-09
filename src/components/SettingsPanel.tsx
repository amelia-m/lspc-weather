import { EDITABLE_LIMITS, EDITABLE_LIMIT_KEYS, isEditable, type Thresholds } from '../config/thresholds';
import { NumberField } from './common/NumberField';
import { SimTerm } from './common/SimTerm';

/**
 * One row per threshold an advisory actually fires on.
 *
 * Kept deliberately short: a row for a number nothing reads is worse than no
 * row, because editing it looks like it changes what the dashboard flags. The
 * rows for the wind "watch" band, the density-altitude bands and the last-load
 * warning went when those flags did — each fired on a number no published
 * source sets, so there was nothing a reader could check them against.
 */
const FIELDS = EDITABLE_LIMIT_KEYS.map((key) => ({ key, ...EDITABLE_LIMITS[key] }));

/** Editable advisory thresholds for the active profile. Overrides are owned by
 *  App and persisted; this is a controlled form. */
export function SettingsPanel({
  thresholds,
  base,
  label,
  modified,
  onChange,
  onReset,
}: {
  thresholds: Thresholds;
  base: Thresholds;
  label: string;
  modified: boolean;
  onChange: (key: keyof Thresholds, value: number) => void;
  onReset: () => void;
}): JSX.Element {
  return (
    <details className="panel settings">
      <summary className="panel-head">
        <h2>
          Settings — thresholds <span className="settings-retire">(may be retired)</span>{' '}
          {modified && <span className="settings-dot">• edited</span>}
        </h2>
        <span className="panel-sub">{label} profile</span>
      </summary>
      <div className="panel-body">
        {/* Raised by the maintainer, 2026-10-08; docs/open-questions.md. */}
        <p className="muted small">
          This section may be retired. A student does not set their own wind limits: the{' '}
          <SimTerm term="bsr">BSR</SimTerm> sets them, or the LSPC waiver raises them to its posted tier, which the profile
          selector already picks. The visibility row, unedited, is 14 CFR 105.17&rsquo;s figure.
        </p>
        <p className="muted small">
          Tune the values that trigger each advisory for the <strong>{label}</strong> profile. Saved
          in this browser. Winds/gusts are in knots (1 kt ≈ 1.15 mph).
        </p>
        <div className="settings-grid">
          {FIELDS.filter((f) => isEditable(base, f.key)).map((f) => {
            const value = thresholds[f.key] as number;
            const isMod = value !== (base[f.key] as number);
            return (
              <NumberField
                key={f.key}
                className={`settings-field${isMod ? ' modified' : ''}`}
                label={
                  <span className="settings-label">
                    {f.label} <span className="settings-unit">({f.unit})</span>
                    {/* The figure the edit replaced: the advisory list sends a
                        reader here to find it. */}
                    {isMod && (
                      <span className="settings-unit">
                        {' '}
                        · published {Math.round((base[f.key] as number) * 10) / 10}
                      </span>
                    )}
                  </span>
                }
                value={value}
                step={'step' in f ? f.step : 1}
                min={0}
                onCommit={(v) => onChange(f.key, v)}
              />
            );
          })}
        </div>
        <button className="refresh-btn" onClick={onReset} disabled={!modified}>
          Reset to defaults ({label})
        </button>
      </div>
    </details>
  );
}
