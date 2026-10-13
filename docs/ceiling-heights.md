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
- **The lowest ceilings came out high, the highest low.** By the band KPMV
  reported, the median difference was +300 ft under 500 ft, +200 ft from
  500 to under 1,000, -200 ft from 1,000 to 3,000, and -1,100 ft above
  3,000. Of the 149 hours KPMV reported a ceiling under 500 ft, the
  forecast put 35 in that band, 67 at 500 to 1,000 ft, 29 at 1,000 to
  3,000, 5 above 3,000 and 13 at none: 114 (77%) higher. The overall median near zero is those two
  tendencies offsetting.
- **Six hours ahead reads much as the latest issuance does; a day ahead,
  less closely.** At 24 hours or more ahead the median size of the
  difference grew from 700 to 1,170 ft, and the forecast put 8 of 134
  sub-500 ft ceilings in that band.
- **KPMV's own grid point reads almost the same** as the drop zone's
  (`scripts/ceilingSummary.ts` prints both): the ceiling call moved by up
  to 17 of about 4,500 hours, the medians by up to 185 ft.
- **Open-Meteo's low band at or above 5/8** was there on 92 to 93% of the
  hours KPMV reported a ceiling of 3,000 ft or lower, and on 40% of those
  with one above 3,000 ft (its mid band on 38%). It marks a low
  ceiling as likely without saying whether it is at 400 or 2,500 ft.

## What this does not say

- **Season.** April to early October at one station, as before.
- **The card's lead.** The rows here are four issuances a day; the card
  reads an API that updates about hourly.
- **Distance.** KPMV is about 11.5 miles from the drop zone; the two grid
  points read almost alike, but the sky over each can differ.
