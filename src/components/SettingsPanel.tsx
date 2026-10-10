import {
  EDITABLE_LIMITS,
  EDITABLE_LIMIT_KEYS,
  isEditable,
  isOwnLimit,
  isOwnLimitKey,
  type EditableLimit,
  type Thresholds,
} from '../config/thresholds';
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

/**
 * The reader's own thresholds, for the Licensed profile only (`takesOwnLimits`).
 * Overrides are owned by App and persisted; this is a controlled form.
 *
 * Closed to every student profile (BSR and waiver tiers alike), at the
 * maintainer's call on 2026-10-10: a student does not set their own wind
 * limits; the BSR sets them, or the LSPC waiver raises them to its posted
 * tier, which the profile selector already picks. On Licensed, where the BSR
 * sets no ground-wind limit, the wind limit and gust ceiling are the
 * reader's own and start empty (none); the visibility caution starts at
 * 14 CFR 105.17's figure and an edit of it is marked as one.
 */
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
  /** null clears an own limit (none set). */
  onChange: (key: EditableLimit, value: number | null) => void;
  onReset: () => void;
}): JSX.Element {
  const allowed = base.takesOwnLimits === true;
  return (
    <details className="panel settings">
      <summary className="panel-head">
        <h2>
          Set your own thresholds {modified && <span className="settings-dot">• set</span>}
        </h2>
        <span className="panel-sub">{label} profile</span>
      </summary>
      <div className="panel-body">
        {!allowed ? (
          <p className="muted small">
            Not on a student profile. A student&rsquo;s wind limits are the{' '}
            <SimTerm term="bsr">BSR</SimTerm>&rsquo;s, or the LSPC waiver&rsquo;s posted tier, which the
            selector at the top of the page already picks. Choose Licensed to set your own.
          </p>
        ) : (
          <>
            <p className="muted small">
              What you set here appears in the charts, the Surface wind card and the flags under
              &ldquo;Conditions to note&rdquo; above, each marked as yours. No published source sets a
              ground-wind limit or gust ceiling for licensed jumpers; leave either empty for none. The
              visibility row, unedited, is 14 CFR 105.17&rsquo;s figure. Saved in this browser; winds and
              gusts in knots (1 kt ≈ 1.15 mph).
            </p>
            <div className="settings-grid">
              {FIELDS.filter((f) => isEditable(base, f.key)).map((f) => {
                const ownKey = isOwnLimitKey(base, f.key);
                const value = ownKey
                  ? isOwnLimit(thresholds, f.key)
                    ? (thresholds[f.key] as number)
                    : null
                  : (thresholds[f.key] as number);
                const isMod = ownKey ? value != null : value !== (base[f.key] as number);
                return (
                  <NumberField
                    key={f.key}
                    className={`settings-field${isMod ? ' modified' : ''}`}
                    label={
                      <span className="settings-label">
                        {ownKey && 'ownLabel' in f ? f.ownLabel : f.label}{' '}
                        <span className="settings-unit">({f.unit})</span>
                        {/* The figure the edit replaced: the advisory list
                            sends a reader here to find it. An own limit
                            replaced nothing. */}
                        {isMod && !ownKey && (
                          <span className="settings-unit">
                            {' '}
                            · published {Math.round((base[f.key] as number) * 10) / 10}
                          </span>
                        )}
                      </span>
                    }
                    value={value}
                    optional={ownKey}
                    placeholder={ownKey ? 'none' : undefined}
                    step={'step' in f ? f.step : 1}
                    min={0}
                    onCommit={(v) => onChange(f.key, v)}
                  />
                );
              })}
            </div>
            <button className="refresh-btn" onClick={onReset} disabled={!modified}>
              Clear what I set ({label})
            </button>
          </>
        )}
      </div>
    </details>
  );
}
