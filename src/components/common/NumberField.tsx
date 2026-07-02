import { useEffect, useState, type ReactNode } from 'react';

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
}: {
  label: ReactNode;
  value: number;
  step: number;
  min: number;
  max?: number;
  onCommit: (n: number) => void;
  className?: string;
}): JSX.Element {
  const [draft, setDraft] = useState(String(value));

  // Reflect external changes (e.g. a reset or profile switch) back into the field.
  useEffect(() => setDraft(String(value)), [value]);

  const commit = (): void => {
    const n = clamp(parseFloat(draft), min, max);
    onCommit(n);
    setDraft(String(n));
  };

  return (
    <label className={className}>
      {label}
      <input
        type="number"
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}
