import { useEffect, useState, type ReactNode } from 'react';
import { round } from '../../domain/units';

/** What the field shows for a stored value.
 *
 *  Limits posted in whole mph are stored in knots, so a waiver tier's 18 mph
 *  lives as 15.641568 — and an input rendering that raw shows six decimals
 *  where the club's sign shows two digits, with a step of 1 that nudges it to
 *  another number nobody posted. One decimal matches how the cards print a
 *  limit and is finer than a windsock resolves. */
const shown = (v: number | null): string => (v == null ? '' : String(round(v, 1)));

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Numeric input that lets you type freely (including clearing the field mid-edit)
 * and only clamps to [min,max] on blur or Enter. Clamping on every keystroke — as
 * this did before — snapped a half-typed value straight to the minimum, making the
 * field feel impossible to change.
 */
export function NumberField({
  label,
  value,
  step,
  min,
  max = Infinity,
  onCommit,
  className,
  optional = false,
  placeholder,
}: {
  label: ReactNode;
  /** null only on an `optional` field: no value set. */
  value: number | null;
  step: number;
  min: number;
  max?: number;
  /** null when an `optional` field is cleared. */
  onCommit: (n: number | null) => void;
  className?: string;
  /** Whether clearing the field means "none" (a reader's own limit left
   *  unset) rather than a typing slip, which clamps to the minimum. */
  optional?: boolean;
  placeholder?: string;
}): JSX.Element {
  const [draft, setDraft] = useState(() => shown(value));

  // Reflect external changes (e.g. a reset or profile switch) back into the field.
  useEffect(() => setDraft(shown(value)), [value]);

  const commit = (): void => {
    if (optional && draft.trim() === '') {
      if (value != null) onCommit(null);
      return;
    }
    const n = clamp(parseFloat(draft), min, max);
    // Tabbing through without editing must not write the rounded display back
    // as an override: the stored limit carries more precision than the field
    // shows, so committing it would silently move the threshold and mark the
    // profile modified for a value the user never touched.
    if (shown(n) === shown(value)) {
      setDraft(shown(value));
      return;
    }
    onCommit(n);
    setDraft(shown(n));
  };

  return (
    <label className={className}>
      {label}
      <input
        type="number"
        step={step}
        min={min}
        max={Number.isFinite(max) ? max : undefined}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}
