import type { ReactNode } from 'react';

/** Labeled numeric dropdown. Options are discrete numeric steps (e.g. altitude
 *  in 500-ft increments); the caller supplies the list and a formatter. Keeps
 *  the value constrained to real choices — no free-typed intermediate states to
 *  clamp, unlike NumberField. */
export function SelectField({
  label,
  value,
  options,
  format = String,
  onChange,
  className,
}: {
  label: ReactNode;
  value: number;
  options: readonly number[];
  format?: (n: number) => string;
  onChange: (n: number) => void;
  className?: string;
}): JSX.Element {
  return (
    <label className={className}>
      {label}
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {options.map((o) => (
          <option key={o} value={o}>
            {format(o)}
          </option>
        ))}
      </select>
    </label>
  );
}
