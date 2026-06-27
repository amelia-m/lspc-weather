import type { Thresholds } from '../config/thresholds';

interface FieldDef {
  key: keyof Thresholds;
  label: string;
  unit: string;
  step?: number;
}

const FIELDS: FieldDef[] = [
  { key: 'windWatchKt', label: 'Wind — watch', unit: 'kt' },
  { key: 'windCautionKt', label: 'Wind — caution', unit: 'kt' },
  { key: 'gustSpreadWatchKt', label: 'Gust spread — watch', unit: 'kt' },
  { key: 'gustCautionKt', label: 'Gust ceiling', unit: 'kt' },
  { key: 'ceilingWatchFt', label: 'Ceiling — watch', unit: 'ft', step: 100 },
  { key: 'ceilingCautionFt', label: 'Ceiling — caution', unit: 'ft', step: 100 },
  { key: 'visibilityCautionSm', label: 'Visibility — caution', unit: 'SM', step: 0.5 },
  { key: 'precipWatchPct', label: 'Precip — watch', unit: '%' },
  { key: 'precipCautionPct', label: 'Precip — caution', unit: '%' },
  { key: 'densityAltExcessWatchFt', label: 'DA above field — watch', unit: 'ft', step: 100 },
  { key: 'densityAltExcessCautionFt', label: 'DA above field — caution', unit: 'ft', step: 100 },
  { key: 'lastLoadWatchMin', label: 'Last-load — watch', unit: 'min', step: 5 },
];

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
          {FIELDS.filter((f) => typeof base[f.key] === 'number').map((f) => {
            const value = thresholds[f.key] as number;
            const isMod = value !== (base[f.key] as number);
            return (
              <label key={f.key} className={`settings-field${isMod ? ' modified' : ''}`}>
                <span className="settings-label">
                  {f.label} <span className="settings-unit">({f.unit})</span>
                </span>
                <input
                  type="number"
                  step={f.step ?? 1}
                  value={Number.isFinite(value) ? value : ''}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v)) onChange(f.key, v);
                  }}
                />
              </label>
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
