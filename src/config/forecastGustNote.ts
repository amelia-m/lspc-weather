/**
 * What the NWS forecast gust has done against KPMV's reports, for the
 * standing note on the Surface wind card (the maintainer's call,
 * 2026-10-28: a note, with the typical size of the difference). The
 * Forecast wind flag reads that gust against the published limits and the
 * reader's own, so a reader deciding whether to trust a forecast flag
 * wants to know how the gust has compared with the station, and how far.
 *
 * The figures are one dated reading of docs/nws-gust-archive.md ("Read
 * again 2026-10-27"): NOAA's NDFD archive of the forecast at the drop
 * zone's grid point from `from` to `to`, at the newest issuance before each
 * hour, against KPMV's report within 10 minutes of the hour. A test holds
 * each figure to that doc's table, cell for cell, so a later reading moves
 * the note or fails. Counts, not a correction: the flag reads the forecast
 * as issued, and nothing here changes what fires. KPMV is 11.5 mi from the
 * drop zone and decides a gust by its own rule (the doc, "How a gust gets
 * into KPMV's report"), so part of every difference is the distance and
 * part is the two answering different questions.
 */
import { repoDoc } from './site';

/** "+1.5", "−0.6": the sign always printed, a true minus sign. */
const signed = (kt: number, decimals: number): string =>
  `${kt < 0 ? '−' : '+'}${Math.abs(kt).toFixed(decimals)}`;

export const FORECAST_GUST_NOTE = {
  /** The doc the figures were read from, on GitHub, and the reading. */
  doc: 'docs/nws-gust-archive.md',
  get url(): string {
    return repoDoc(this.doc);
  },
  readOn: '2026-10-27',
  from: '2026-04-01',
  to: '2026-10-25',
  /** Hours KPMV reported a gust, at the newest issuance before the hour. */
  gustingHours: 978,
  above: 615,
  same: 93,
  below: 270,
  /** Forecast minus reported gust, where both exist, as the doc prints them. */
  meanKt: 1.51,
  medianMissKt: 3,
  p90MissKt: 8,
  /** The mean on reported gusts this strong or stronger. */
  strongGustKt: 23,
  strongMeanKt: -0.59,
  /** Hours with no gust in KPMV's report: the forecast gust over the
   *  reported steady wind. */
  noGustHours: 3884,
  noGustMeanKt: 5.88,
  /** A share of the gusting hours to one decimal, as the doc prints them,
   *  so the three add up as printed (rounded to whole percent they made
   *  101). */
  share(n: number): string {
    return `${((100 * n) / this.gustingHours).toFixed(1)}%`;
  },
  get sentence(): string {
    const strongSide = this.strongMeanKt < 0 ? 'low' : 'high';
    return (
      `The Forecast flag reads the NWS forecast gust for the drop zone. From ${this.from} to ${this.to}, set against KPMV's reports, ` +
      `that gust ran above the reported gust in ${this.share(this.above)} of the ${this.gustingHours.toLocaleString('en-US')} gusting hours, the same in ${this.share(this.same)} and below in ${this.share(this.below)}; ` +
      `half the differences were ${this.medianMissKt} kt or less and nine in ten ${this.p90MissKt} kt or less (mean ${signed(this.meanKt, 1)} kt). ` +
      `On reported gusts of ${this.strongGustKt} kt or more it ran a little ${strongSide} (${signed(this.strongMeanKt, 1)} kt on average), ` +
      `and in the ${this.noGustHours.toLocaleString('en-US')} hours KPMV reported no gust it sat about ${Math.round(this.noGustMeanKt)} kt over the steady wind. ` +
      `Counts from one reading (${this.readOn}), not a correction: the flag reads the forecast as issued.`
    );
  },
} as const;
