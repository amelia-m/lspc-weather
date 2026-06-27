/** Helpers so sample data is always anchored to "now" — otherwise the hourly
 *  window filters would hide statically-dated fixtures. */

export const hourStartMs = (): number => Math.floor(Date.now() / 3600_000) * 3600_000;

/** ISO string for the current hour start + `offsetH` hours (no milliseconds). */
export const isoHour = (offsetH: number): string =>
  new Date(hourStartMs() + offsetH * 3600_000).toISOString().replace('.000', '');

/** NWS-style "<ISO start>/PT<n>H" interval beginning `offsetH` hours from now. */
export const interval = (offsetH: number, hours: number): string =>
  `${isoHour(offsetH)}/PT${hours}H`;
