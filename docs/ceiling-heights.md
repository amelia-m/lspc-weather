# Ceiling heights: the NWS forecast against the METAR

The question from 2026-10-13, after the cloud-cover comparison
([cloud-cover-sources.md](cloud-cover-sources.md)) left height out: how
near is the forecast ceiling to the one KPMV reports? The Ceiling & sky
card shows the NWS gridpoint's `ceilingHeight` for each coming hour. This
page changes nothing on the dashboard. Counts and spreads, never a grade.

## What was compared

- **The NWS ceiling** is NDFD's ceiling grid (WMO header YMUZ98, the public
  archive at noaa-ndfd-pds.s3.amazonaws.com, `wmo/cig/`). On 2026-10-13
  api.weather.gov's `ceilingHeight` at the drop zone served the same
  values, in metres, as the latest file at the drop zone's grid point, for
  every hour of its next day. The grid's -29 is "no ceiling" (the API's
  null). Read as the cloud-cover comparison reads sky cover: the last file
  in each of 00, 06, 12 and 18 Z, at the drop zone's grid point and at
  KPMV's, April 1 to October 9 2026. For each hour, the newest issuance at
  least 0, 6 or 24 hours before it. The card reads the API, which updates
  about hourly, so its lead is shorter than the "latest issuance" row's.
- **Open-Meteo** has no ceiling or cloud-base figure here: its `cloud_base`
  came back null, unit "undefined", at the drop zone on 2026-10-13. Its low
  band (up to 3 km) is the nearest it has to a height, so it is read by
  the band of the ceiling KPMV reported.
- **KPMV's ceiling** is its lowest BKN, OVC or VV base. A ceiling layer
  with no height (`BKN///`) leaves the hour out. Each top of the hour takes
  the report nearest it within 10 minutes, as before.

Both sides are held at or below 12,000 ft: KPMV, an AWOS, reports nothing
higher, so a forecast ceiling above that counts as none. The grid stores
whole metres (500 ft is 152 m, 498.7 ft), so its heights are rounded to
the nearest 10 ft, which brings each whole hundred back to itself. Heights are ft
AGL. The bands are the FAA flight-category ceiling limits (AIM 7-1-7,
`flightCategory.ts`): LIFR under 500 ft, IFR 500 to under 1,000, MVFR
1,000 to 3,000, VFR above 3,000 (here, up to 12,000). The records are
`data/parity/ceiling-2026-04-01-to-2026-10-09.jsonl.gz` (fetched with
`PARTS=cig` and SITES for the two points); the reports and Open-Meteo's
bands are the cloud-cover archive's.
`npx tsx scripts/ceilingSummary.ts data/parity/ceiling-2026-04-01-to-2026-10-09.jsonl.gz
data/parity/cloud-cover-2026-04-01-to-2026-10-09.jsonl.gz` prints the
tables below; the arithmetic is `src/domain/ceilingHeights.ts`.

## The NWS ceiling at the drop zone (the card's point)

| Issuance | Hours | Lead (h) | Both a ceiling | Forecast only | Reported only | Neither | Same band | Forecast − reported (ft): median, 10th–90th | Median size |
|---|---|---|---|---|---|---|---|---|---|
| NWS, latest issuance | 4475 | 0.9–12.2 | 899 | 309 | 397 | 2870 | 77% | 100, -3100 to 2400 | 700 |
| NWS, 6 h or more ahead | 4470 | 6.2–17.2 | 884 | 320 | 412 | 2854 | 76% | 0, -3000 to 2400 | 700 |
| NWS, 24 h or more ahead | 4137 | 24.2–30.2 | 715 | 279 | 461 | 2682 | 75% | 200, -3200 to 3600 | 1170 |

Forecast − reported (ft), median, by the reported ceiling's band (hours both had a ceiling):

| Issuance | LIFR | IFR | MVFR | VFR |
|---|---|---|---|---|
| NWS, latest issuance | 300 (n 136) | 200 (n 146) | -200 (n 244) | -1100 (n 373) |
| NWS, 6 h or more ahead | 300 (n 138) | 200 (n 147) | -200 (n 238) | -1200 (n 361) |
| NWS, 24 h or more ahead | 785 (n 104) | 335 (n 126) | 115 (n 198) | -800 (n 287) |

Forecast − reported (ft), median, by the forecast ceiling's band (hours both had a ceiling):

| Issuance | LIFR | IFR | MVFR | VFR |
|---|---|---|---|---|
| NWS, latest issuance | 100 (n 40) | 100 (n 210) | -100 (n 289) | 100 (n 360) |
| NWS, 6 h or more ahead | 100 (n 41) | 100 (n 212) | -140 (n 281) | 200 (n 350) |
| NWS, 24 h or more ahead | 0 (n 13) | 0 (n 139) | 200 (n 247) | 1315 (n 316) |

**NWS, latest issuance**, hours by band (rows: KPMV reported; columns: forecast)

| Reported \ Forecast | LIFR | IFR | MVFR | VFR | none | Same band |
|---|---|---|---|---|---|---|
| LIFR | 35 | 67 | 29 | 5 | 13 | 23% of 149 |
| IFR | 2 | 83 | 49 | 12 | 23 | 49% of 169 |
| MVFR | 3 | 49 | 145 | 47 | 78 | 45% of 322 |
| VFR | 0 | 11 | 66 | 296 | 283 | 45% of 656 |
| none | 1 | 5 | 42 | 261 | 2870 | 90% of 3179 |

**NWS, 6 h or more ahead**, hours by band (rows: KPMV reported; columns: forecast)

| Reported \ Forecast | LIFR | IFR | MVFR | VFR | none | Same band |
|---|---|---|---|---|---|---|
| LIFR | 35 | 71 | 26 | 6 | 11 | 23% of 149 |
| IFR | 2 | 84 | 47 | 14 | 22 | 50% of 169 |
| MVFR | 3 | 46 | 141 | 48 | 84 | 44% of 322 |
| VFR | 1 | 11 | 67 | 282 | 295 | 43% of 656 |
| none | 2 | 8 | 53 | 257 | 2854 | 90% of 3174 |

**NWS, 24 h or more ahead**, hours by band (rows: KPMV reported; columns: forecast)

| Reported \ Forecast | LIFR | IFR | MVFR | VFR | none | Same band |
|---|---|---|---|---|---|---|
| LIFR | 8 | 41 | 36 | 19 | 30 | 6% of 134 |
| IFR | 4 | 57 | 49 | 16 | 24 | 38% of 150 |
| MVFR | 1 | 35 | 111 | 51 | 91 | 38% of 289 |
| VFR | 0 | 6 | 51 | 230 | 316 | 38% of 603 |
| none | 0 | 3 | 44 | 232 | 2682 | 91% of 2961 |

## The distributions behind the medians

Asked 2026-10-13, after the medians by the forecast's band came out one
100 ft step from zero: what do the differences look like whole? Drop
zone's grid point, latest issuance; `scripts/ceilingSummary.ts` prints
the same for every issuance and for KPMV's point
(`diffDistribution`, `src/domain/ceilingHeights.ts`). The ratio column
is forecast ÷ reported; percentiles are nearest-rank.

**NWS, latest issuance**, what KPMV reported, by the forecast's band (share of each column above)

| Forecast | Hours | Reported LIFR | Reported IFR | Reported MVFR | Reported VFR | Reported none |
|---|---|---|---|---|---|---|
| LIFR | 41 | 85% | 5% | 7% | 0% | 2% |
| IFR | 215 | 31% | 39% | 23% | 5% | 2% |
| MVFR | 331 | 9% | 15% | 44% | 20% | 13% |
| VFR | 621 | 1% | 2% | 8% | 48% | 42% |
| none | 3267 | 0% | 1% | 2% | 9% | 88% |

**NWS, latest issuance**, forecast − reported (ft), by the forecast's band (hours both had a ceiling)

| Band | Hours | 10th | 25th | Median | 75th | 90th | Forecast ÷ reported, 25th–median–75th |
|---|---|---|---|---|---|---|---|
| LIFR | 40 | -400 | 0 | 100 | 200 | 200 | 1–1.5–2 |
| IFR | 210 | -1100 | -300 | 100 | 300 | 400 | 0.69–1.14–1.6 |
| MVFR | 289 | -4300 | -1000 | -100 | 600 | 1100 | 0.65–0.94–1.67 |
| VFR | 360 | -4100 | -2000 | 100 | 2400 | 4900 | 0.79–1.02–1.59 |

Share of those hours by size of the difference ("low": forecast below the report):

| Band | more than 3,000 low | 1,000 to 3,000 low | 500 to 1,000 low | 100 to 500 low | within 100 | 100 to 500 high | 500 to 1,000 high | 1,000 to 3,000 high | more than 3,000 high |
|---|---|---|---|---|---|---|---|---|---|
| LIFR | 0% | 0% | 8% | 5% | 60% | 28% | 0% | 0% | 0% |
| IFR | 2% | 8% | 7% | 18% | 24% | 40% | 2% | 0% | 0% |
| MVFR | 12% | 12% | 7% | 18% | 9% | 15% | 16% | 10% | 0% |
| VFR | 14% | 19% | 7% | 6% | 4% | 4% | 6% | 20% | 19% |

**NWS, latest issuance**, forecast − reported (ft), by KPMV's reported band (hours both had a ceiling)

| Band | Hours | 10th | 25th | Median | 75th | 90th | Forecast ÷ reported, 25th–median–75th |
|---|---|---|---|---|---|---|---|
| LIFR | 136 | 100 | 200 | 300 | 600 | 1190 | 1.5–2–3.25 |
| IFR | 146 | -100 | 0 | 200 | 600 | 1800 | 1–1.4–1.83 |
| MVFR | 244 | -900 | -500 | -200 | 700 | 2400 | 0.68–0.9–1.39 |
| VFR | 373 | -5500 | -3000 | -1100 | 700 | 2900 | 0.57–0.84–1.12 |

Share of those hours by size of the difference ("low": forecast below the report):

| Band | more than 3,000 low | 1,000 to 3,000 low | 500 to 1,000 low | 100 to 500 low | within 100 | 100 to 500 high | 500 to 1,000 high | 1,000 to 3,000 high | more than 3,000 high |
|---|---|---|---|---|---|---|---|---|---|
| LIFR | 0% | 0% | 0% | 1% | 21% | 51% | 16% | 8% | 4% |
| IFR | 0% | 0% | 0% | 10% | 32% | 32% | 10% | 12% | 5% |
| MVFR | 0% | 9% | 14% | 29% | 11% | 9% | 7% | 12% | 9% |
| VFR | 24% | 26% | 8% | 7% | 4% | 4% | 5% | 12% | 9% |

- **The medians sit near zero; the spread does not.** By the forecast's
  band, the middle half of the differences ran 0 to +200 ft under 500 ft,
  -300 to +300 from 500 to under 1,000, -1,000 to +600 from 1,000 to
  3,000, and -2,000 to +2,400 above 3,000. A forecast ceiling above
  3,000 ft missed by more than 1,000 ft, one way or the other, on 72% of
  the hours both had one, and was within 100 ft on 4%.
- **The miss grows with the height, roughly in proportion.** As a ratio
  the middle half reads alike from 500 ft up: the forecast was about 0.65
  to 1.6 times the reported height in the IFR, MVFR and VFR bands. Under
  500 ft (40 hours) its middle half ran 1 to 2 times, the forecast at or
  above the report.
- **When the forecast said IFR, the report was lower 31% of the time.**
  Of 215 hours with a forecast ceiling from 500 to under 1,000 ft, KPMV
  reported one under 500 ft on 67. A forecast under 500 ft was itself
  borne out on 35 of 41 hours (85%), but there were few of them.
- **A forecast ceiling above 3,000 ft came with no reported ceiling on
  42% of its hours**, and a forecast of none with a reported ceiling on
  12% (9% above 3,000 ft).
- **Grouped by what was reported, the shape leans** as the medians did:
  under 500 ft, 79% of the forecasts were above the report and 1% below
  (a 300 ft report cannot be missed downward by more than 300 ft); above
  3,000 ft, 50% were more than 1,000 ft below it.
- **A day ahead** the medians by the forecast's band were 0, 0, +200 and
  +1,300 ft, and the middle half above 3,000 ft ran -1,300 to +3,300.
- **At KPMV's own grid point** the medians and quartiles by the
  forecast's band moved by 200 ft at most, the 10th percentile by up to
  800 ft (-4,300 to -3,500 in the MVFR band).

## The NWS ceiling at KPMV's own grid point

The same reports, with the forecast read at the grid point nearest KPMV's
coordinates (40.9484, -95.9174, the FAA's), 1.08 km from them, instead of
at the drop zone's, about 11.5 miles away. This takes the distance between
forecast and station out of the comparison.

| Issuance | Hours | Lead (h) | Both a ceiling | Forecast only | Reported only | Neither | Same band | Forecast − reported (ft): median, 10th–90th | Median size |
|---|---|---|---|---|---|---|---|---|---|
| NWS, latest issuance | 4475 | 0.9–12.2 | 909 | 297 | 387 | 2882 | 77% | 100, -3200 to 2600 | 800 |
| NWS, 6 h or more ahead | 4470 | 6.2–17.2 | 901 | 316 | 395 | 2858 | 76% | 100, -3100 to 2600 | 700 |
| NWS, 24 h or more ahead | 4137 | 24.2–30.2 | 717 | 282 | 459 | 2679 | 74% | 300, -3200 to 3400 | 1170 |

Forecast − reported (ft), median, by the reported ceiling's band (hours both had a ceiling):

| Issuance | LIFR | IFR | MVFR | VFR |
|---|---|---|---|---|
| NWS, latest issuance | 300 (n 138) | 200 (n 151) | -100 (n 246) | -1200 (n 374) |
| NWS, 6 h or more ahead | 300 (n 140) | 200 (n 148) | -200 (n 245) | -1100 (n 368) |
| NWS, 24 h or more ahead | 700 (n 109) | 300 (n 123) | 300 (n 205) | -700 (n 280) |

Forecast − reported (ft), median, by the forecast ceiling's band (hours both had a ceiling):

| Issuance | LIFR | IFR | MVFR | VFR |
|---|---|---|---|---|
| NWS, latest issuance | 100 (n 41) | 100 (n 214) | 0 (n 281) | 300 (n 373) |
| NWS, 6 h or more ahead | 100 (n 37) | 100 (n 225) | -100 (n 278) | 200 (n 361) |
| NWS, 24 h or more ahead | 0 (n 16) | 70 (n 135) | 300 (n 242) | 1385 (n 324) |

**NWS, latest issuance**, hours by band (rows: KPMV reported; columns: forecast)

| Reported \ Forecast | LIFR | IFR | MVFR | VFR | none | Same band |
|---|---|---|---|---|---|---|
| LIFR | 38 | 71 | 24 | 5 | 11 | 26% of 149 |
| IFR | 2 | 85 | 52 | 12 | 18 | 50% of 169 |
| MVFR | 1 | 46 | 147 | 52 | 76 | 46% of 322 |
| VFR | 0 | 12 | 58 | 304 | 282 | 46% of 656 |
| none | 0 | 6 | 44 | 247 | 2882 | 91% of 3179 |

- **Ceiling or not:** a ceiling on 909 of the 1,296 hours KPMV reported
  one (70%), and on 297 of the 3,179 it reported none (9%). At the drop
  zone's point, 69% and 10%.
- **How high, both a ceiling:** median +100 ft, half within 800 ft (700
  at the drop zone's), 10th to 90th percentiles -3,200 to +2,600 ft.
- **By the forecast's band:** +100, +100, 0 and +300 ft (at the drop
  zone's point +100, +100, -100 and +100). Near the mark in every band
  again.
- **Very low ceilings:** the forecast put one under 500 ft on 41 hours,
  against 149 reported, the same count as at the drop zone's point.
- **A day ahead:** where it gave a ceiling above 3,000 ft, the reported
  one was a median 1,385 ft lower (1,315 at the drop zone's).

So the 11.5 miles between the drop zone and KPMV account for little of
the difference between the forecast and the report: at KPMV's own point
the counts move by up to 17 of about 4,500 hours and the medians by up to
200 ft, not consistently in one direction.

## Open-Meteo's bands, by the ceiling KPMV reported

| Reported ceiling | Hours | Low band ≥ 5/8 | Mid band ≥ 5/8 | Total ≥ 5/8 |
|---|---|---|---|---|
| LIFR | 149 | 93% | 28% | 93% |
| IFR | 169 | 93% | 29% | 93% |
| MVFR | 322 | 92% | 22% | 94% |
| VFR | 657 | 40% | 38% | 61% |

## What it shows

- **Whether there is a ceiling.** With the latest issuance, the forecast
  had one on 899 of the 1,296 hours KPMV reported one (69%), and on 309 of
  the 3,179 hours it reported none (10%). The cloud-cover test (sky cover at
  or above 5/8, cloud-cover-sources.md) caught a few more ceilings (73%) at
  twice the hours without one (20%).
- **How high, when both had one.** The median difference was +100 ft, and
  half the hours were within 700 ft; the 10th to 90th percentiles ran from
  3,100 ft too low to 2,400 ft too high.
- **Read by the forecast's own figure, the median was near the mark in
  every band, and the spread around it was not.** Grouped by the band
  the forecast gave, the median difference was +100 ft under 500 ft,
  +100 from 500 to under 1,000, -100 from 1,000 to 3,000 and +100 above
  3,000: one 100 ft step. That is the grouping a reader of the card's
  figure is in. The middle half of the differences widened from 200 ft
  under 500 ft to 4,400 ft above 3,000, about in proportion to the
  height (see "The distributions behind the medians").
- **Grouped by what KPMV reported, it looks biased, and that is mostly
  the grouping.** By the reported band the medians are +300, +200, -200
  and -1,100 ft. Sorting hours by the observed value does this to any
  forecast with errors: a reported 300 ft ceiling can be missed upward by
  thousands of feet but downward by 200 at most, and above 3,000 ft the
  12,000 ft cap removes forecasts that ran higher. The medians are stable
  (a by-hand resampling on 2026-10-13, 2,000 draws, put the under-500 ft
  one's 90% interval at 300 to 300) and round because both sides come in 100 ft steps: every reported
  base is a whole hundred, and 93% of the forecast heights were within
  2 ft of one before the 10 ft rounding.
- **What the grouping does show: the forecast seldom goes very low.**
  KPMV reported a ceiling under 500 ft on 149 hours; the forecast put one
  there on 41, 35 of them on those hours. Of the 149, it put 67 at 500 to
  1,000 ft, 29 at 1,000 to 3,000, 5 above and 13 at none.
- **Six hours ahead reads much as the latest issuance does; a day ahead,
  less closely.** At 24 hours or more ahead the median size of the
  difference grew from 700 to 1,170 ft, the forecast put 8 of 134
  sub-500 ft ceilings in that band, and where it gave a ceiling above
  3,000 ft the reported one was a median 1,315 ft lower.
- **KPMV's own grid point reads almost the same** as the drop zone's;
  see the section above.
- **Open-Meteo's low band at or above 5/8** was there on 92 to 93% of the
  hours KPMV reported a ceiling of 3,000 ft or lower, and on 40% of those
  with one above 3,000 ft (its mid band on 38%). It marks a low
  ceiling as likely without saying whether it is at 400 or 2,500 ft.

## What this does not say

- **Season.** April to early October at one station, as before.
- **The card's lead.** The rows here are four issuances a day; the card
  reads an API that updates about hourly.
- **Distance.** KPMV is about 11.5 miles from the drop zone. The forecast
  at the two grid points reads almost alike against KPMV's reports, but
  nothing here measures the sky over the drop zone itself.
