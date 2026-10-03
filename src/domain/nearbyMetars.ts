/**
 * The Nearby METARs card's rows: each station's latest report from IEM's
 * network request, decoded the same way as KPMV's (normalizeIemCurrent: the
 * METAR text first), with its distance and bearing from the drop zone worked
 * out from the position IEM gives, nearest first.
 *
 * The flight category is the FAA's classification of the reported ceiling
 * and visibility (AIM 7-1-7), the same derivation the Ceiling & sky card
 * uses, so it is withheld from a report with no sky group rather than shown
 * as VFR. Nothing here judges a report.
 *
 * Pure: records and the station list in, rows out.
 */
import { haversineMiles, initialBearingDeg } from './geo';
import { normalizeIemCurrent, type RawIemCurrent } from './iem';
import { observedFlightCategory, type FlightCategory } from './flightCategory';
import type { CurrentConditions } from './types';

export interface NearbyStation {
  id: string; // "KOFF"
  iemId: string; // "OFF"
  name: string;
}

export interface NearbyRow {
  id: string;
  name: string;
  /** From the drop zone, from IEM's station position; null when IEM gave
   *  none (or no record at all). */
  distanceMi: number | null;
  bearingDeg: number | null;
  /** null when IEM had no report for the station. */
  current: CurrentConditions | null;
  category: FlightCategory | null;
}

export function nearbyRows(
  records: readonly RawIemCurrent[],
  stations: readonly NearbyStation[],
  dz: { lat: number; lon: number },
): NearbyRow[] {
  const rows = stations.map((s): NearbyRow => {
    const rec = records.find((r) => r.station === s.iemId);
    const current = rec ? normalizeIemCurrent(rec, s.id) : null;
    const hasPos = rec?.lat != null && rec?.lon != null;
    return {
      id: s.id,
      name: s.name,
      distanceMi: hasPos ? haversineMiles(dz.lat, dz.lon, rec!.lat!, rec!.lon!) : null,
      bearingDeg: hasPos ? initialBearingDeg(dz.lat, dz.lon, rec!.lat!, rec!.lon!) : null,
      current,
      category: current ? observedFlightCategory(current) : null,
    };
  });
  // Nearest first; a station with no position (no record) goes last, in the
  // list's own order.
  return rows.sort((a, b) => {
    if (a.distanceMi == null || b.distanceMi == null) return a.distanceMi == null ? (b.distanceMi == null ? 0 : 1) : -1;
    return a.distanceMi - b.distanceMi;
  });
}
