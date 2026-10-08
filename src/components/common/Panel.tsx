import { useId, type ReactNode } from 'react';
import type { DataSource } from '../../config/sources';
import type { SpeedUnit, TempUnit } from '../../domain/units';
import { TempToggle, UnitToggle, UnitToggleScope } from './UnitToggle';
import { SourceLinks } from './SourceLinks';

export function Panel({
  title,
  subtitle,
  sources,
  unit,
  onUnitChange,
  tempUnit,
  onTempUnitChange,
  className,
  action,
  footer,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Data source(s) for this card; rendered as a linked "Data:" footer. */
  sources?: DataSource[];
  /** Current page-wide wind speed unit. Supply together with `onUnitChange` on
   *  any card that shows a speed, so a jumper can switch units at the number
   *  they are reading instead of scrolling back to the top of the page. Both
   *  omitted on cards with no speed in them, which leaves the header as-is. */
  unit?: SpeedUnit;
  onUnitChange?: (u: SpeedUnit) => void;
  /** Current page-wide temperature unit and its setter, the same way: on
   *  every card that shows a temperature, omitted on the rest. */
  tempUnit?: TempUnit;
  onTempUnitChange?: (u: TempUnit) => void;
  /** Extra class on the card, for the few the stylesheet styles by name: the
   *  accent border on `advisory-panel`, the `freshness` card. */
  className?: string;
  /** A control that lives in the header, right-aligned — the Data health
   *  card's Refresh button. It is rendered as a direct child of the header, so
   *  the flex layout is the one every card has; wrapped in the subtitle span it
   *  would inherit the subtitle's muted small type, and a control overlaying
   *  the Refresh button is a phone-width defect this app has already had. */
  action?: ReactNode;
  /** A footer in place of the plain "Data:" list: the advisory card's "Flag
   *  values from …" line, and the Data line of a card with a fallback source
   *  (FallbackSources). Takes the same `panel-sources` slot; a card supplies
   *  this or `sources`, not both, and `sources` is ignored when this is set. */
  footer?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  const headingId = useId();
  const speedToggle = unit !== undefined && onUnitChange !== undefined;
  const tempToggle = tempUnit !== undefined && onTempUnitChange !== undefined;
  const unitToggle =
    speedToggle || tempToggle ? (
      <UnitToggleScope labelledBy={headingId}>
        <div className="unit-toggles">
          {speedToggle && <UnitToggle unit={unit} onChange={onUnitChange} />}
          {tempToggle && <TempToggle unit={tempUnit} onChange={onTempUnitChange} />}
        </div>
      </UnitToggleScope>
    ) : null;
  return (
    <section className={className ? `panel ${className}` : 'panel'}>
      {/* `has-aside` lets the stylesheet allow the header to wrap only on the
          cards that carry a toggle. Cards without one keep the unwrapped
          header they have always had, with the subtitle beside the title. */}
      <header className={unitToggle ? 'panel-head has-aside' : 'panel-head'}>
        <h2 id={headingId}>{title}</h2>
        {/* Subtitle and toggle share one right-hand cluster so the toggle keeps
            its place against the card edge when a long subtitle ("freefall
            drift / spot", a station plus observation time) wraps under it. With
            no toggle the subtitle stays a bare child of the header, exactly as
            on every card that shows no wind speed. */}
        {unitToggle ? (
          <div className="panel-head-aside">
            {subtitle && <span className="panel-sub">{subtitle}</span>}
            {unitToggle}
          </div>
        ) : (
          subtitle && <span className="panel-sub">{subtitle}</span>
        )}
        {action}
      </header>
      <div className="panel-body">{children}</div>
      {footer !== undefined ? (
        <footer className="panel-sources">{footer}</footer>
      ) : (
        sources &&
        sources.length > 0 && (
          <footer className="panel-sources">
            Data: <SourceLinks sources={sources} />
          </footer>
        )
      )}
    </section>
  );
}
