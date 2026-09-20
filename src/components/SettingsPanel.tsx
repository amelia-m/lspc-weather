import type { Thresholds } from '../config/thresholds';
import { NumberField } from './common/NumberField';

interface FieldDef {
  key: keyof Thresholds;
  label: string;
  unit: string;
  step?: number;
}

/**
 * One row per threshold an advisory actually fires on.
 *
 * Kept deliberately short: a row for a number nothing reads is worse than no
 * row, because editing it looks like it changes what the dashboard flags. The
 * rows for the wind "watch" band, the density-altitude bands and the last-load
 * warning went when those flags did — each fired on a number no published
 * source sets, so there was nothing a reader could check them against.
 */
const FIELDS: FieldDef[] = [
  { key: 'windCautionKt', label: 'Wind — caution', unit: 'kt' },
  { key: 'gustCautionKt', label: 'Gust ceiling', unit: 'kt' },
  { key: 'visibilityCautionSm', label: 'Visibility — caution', unit: 'SM', step: 0.5 },
];

/** A row is shown only where the profile's base value is a number AND that
 *  number drives something. `windCautionKt` fails the second test on a profile
 *  with no published limit (licensed): no source sets the band there, so the
 *  wind flag does not fire and the value survives only to scale the card's bar.
 *  Offering it as a tunable would imply a flag behind it. */
function fieldApplies(f: FieldDef, base: Thresholds): boolean {
  if (typeof base[f.key] !== 'number') return false;
  if (f.key === 'windCautionKt') return base.windLimitCitation !== null;
  return true;
}

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
        <h2>Settings — thresholds {modified && <span className="settings-dot">• edited</span>}</h2>
        <span className="panel-sub">{label} profile</span>
      </summary>
      <div className="panel-body">
        <p className="muted small">
          Tune the values that trigger each advisory for the <strong>{label}</strong> profile. Saved
          in this browser. Winds/gusts are in knots (1 kt ≈ 1.15 mph).
        </p>
        <div className="settings-grid">
          {FIELDS.filter((f) => fieldApplies(f, base)).map((f) => {
            const value = thresholds[f.key] as number;
            const isMod = value !== (base[f.key] as number);
            return (
              <NumberField
                key={f.key}
                className={`settings-field${isMod ? ' modified' : ''}`}
                label={
                  <span className="settings-label">
                    {f.label} <span className="settings-unit">({f.unit})</span>
                  </span>
                }
                value={value}
                step={f.step ?? 1}
                min={0}
                onCommit={(v) => onChange(f.key, v)}
              />
            );
          })}
        </div>
        <button className="refresh-btn" onClick={onReset} disabled={!modified}>
          Reset {label} to defaults
        </button>
      </div>
    </details>
  );
}
