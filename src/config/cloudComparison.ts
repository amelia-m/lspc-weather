/**
 * The figures the Ceiling & sky card quotes from the six-month cloud-cover
 * comparison (docs/cloud-cover-sources.md, run 2026-10-10), in one place.
 * Each is a percentage of the hours compared, rounded, and
 * tests/ceilingSkyClouds.test.ts works every one of them, and the period,
 * out again from the archived records
 * (data/parity/cloud-cover-2026-04-01-to-2026-10-09.jsonl.gz) through
 * src/domain/cloudCoverSources.ts, so none can drift from the data.
 *
 * One measure for both forecasts, and a published one: whether the forecast
 * was at or above 5/8, the least cover a broken layer can have (AC 00-45H,
 * Table 3-3), on hours KPMV reported a ceiling and on hours it reported
 * none. NWS figures are its latest issuance before the hour, as the card
 * shows it. Open-Meteo's are quoted twice, for the first hours of its runs
 * and for its forecast a day ahead: the card's hours ahead come from runs
 * made in between, a lead the comparison did not measure.
 */
export const CLOUD_COMPARISON = {
  period: 'April to October 2026',
  /** Hours with a ceiling reported: forecast at or above 5/8. */
  ceilingHours: { nws: 73, omStart: 77, omDayAhead: 77 },
  /** Hours with no ceiling reported: forecast at or above 5/8. */
  noCeilingHours: { nws: 20, omStart: 21, omDayAhead: 43, omLowStart: 4 },
  /** Hours the forecast was exactly 0% or 100%. */
  exactlyNoneOrAll: { nws: 1, omStart: 51 },
} as const;
