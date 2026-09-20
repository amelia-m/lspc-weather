import { createContext, useContext, useId, type ReactNode } from 'react';
import type { SpeedUnit } from '../../domain/units';

/** Id of the heading that names the surface a UnitToggle is rendered into.
 *
 *  Passed through context rather than a prop so the toggle's public shape stays
 *  `{ unit, onChange }` at every call site while still picking up the name of
 *  the card it landed in. See the accessibility note on `UnitToggle`. */
const UnitToggleScopeContext = createContext<string | null>(null);

/** Name the enclosed toggles after `labelledBy` (the id of a visible heading).
 *  Panel wraps its header toggle in this; a toggle rendered outside a scope
 *  falls back to the standalone "Wind speed unit" label. */
export function UnitToggleScope({
  labelledBy,
  children,
}: {
  labelledBy: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <UnitToggleScopeContext.Provider value={labelledBy}>{children}</UnitToggleScopeContext.Provider>
  );
}

const UNITS: readonly SpeedUnit[] = ['kt', 'mph'];

/**
 * kt/mph switch for the page-wide wind speed unit.
 *
 * Both units are in everyday use on a drop zone — aviation sources (METAR, TAF,
 * winds aloft) are in knots while most jumpers' wind limits and the DZ windsock
 * chatter are in mph — so this control is repeated on every card that shows a
 * speed. It owns no state: `unit` and `onChange` are the single page-level unit
 * and its setter, so switching on any one card switches all of them.
 *
 * Accessibility: repeating an identical `role="group"` labelled "Wind speed
 * unit" five times gives a screen-reader user no way to tell which card they
 * have landed on. Inside a `UnitToggleScope` the group is instead named after
 * the card heading — "Winds aloft wind speed unit" — so the name locates the
 * reader in the page. `aria-pressed` carries the selected unit, which the
 * `.active` class alone conveys only visually.
 */
export function UnitToggle({
  unit,
  onChange,
}: {
  unit: SpeedUnit;
  onChange: (u: SpeedUnit) => void;
}): JSX.Element {
  const scopeId = useContext(UnitToggleScopeContext);
  const ownLabelId = useId();
  return (
    <div
      className="unit-toggle"
      role="group"
      aria-label={scopeId ? undefined : 'Wind speed unit'}
      aria-labelledby={scopeId ? `${scopeId} ${ownLabelId}` : undefined}
    >
      {/* Hidden, but referenced by aria-labelledby above, which reads hidden
          text: it supplies the "what" the card heading does not say. */}
      <span id={ownLabelId} hidden>
        wind speed unit
      </span>
      {UNITS.map((u) => (
        <button
          key={u}
          type="button"
          className={u === unit ? 'active' : ''}
          aria-pressed={u === unit}
          onClick={() => onChange(u)}
        >
          {u}
        </button>
      ))}
    </div>
  );
}
