import type { FlightCategory } from '../../domain/flightCategory';
import { CATEGORY_LABEL } from '../../domain/flightCategory';

/** Colored flight-category badge (green VFR / blue MVFR / red IFR / magenta
 *  LIFR), matching standard aviation-weather color conventions. */
export function FlightCategoryPill({ category }: { category: FlightCategory }): JSX.Element {
  return (
    <span
      className={`fc-pill fc-${category.toLowerCase()}`}
      title={CATEGORY_LABEL[category]}
    >
      {category}
    </span>
  );
}
