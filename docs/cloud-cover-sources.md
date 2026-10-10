# Cloud cover: the two forecasts against the METAR

Asked 2026-10-08, when the Ceiling & sky card gained Open-Meteo's cloud cover
beside the NWS sky cover: do the two forecasts agree with each other, and
with what KPMV reports, often enough to be worth showing both
(`docs/open-questions.md`)? This page answers with six months of past
records, gathered and compared on 2026-10-10. It says what was measured, how
it was read and what is only inferred. It changes nothing on the dashboard
and adds no threshold, colour or verdict; whether both forecasts stay on the
card is the maintainer's call.

## What was compared

Every top of the hour from 2026-04-01 01Z to 2026-10-10 00Z that KPMV
reported near, 4,482 hours:

| name | what | source |
|---|---|---|
| METAR | KPMV's report nearest the hour, within 10 minutes (the :55 report, or a special nearer the hour); sky groups parsed by the app's own `parseSkyGroups` | the Iowa Environmental Mesonet's ASOS archive, routine and special reports, 13,431 of them |
| NWS | the NWS forecast sky cover at the drop zone's grid point, the figure the card's NWS bars show | NOAA's NDFD sky-cover grids (CONUS 2.5 km, WMO header YAUZ98) in the public archive at `noaa-ndfd-pds.s3.amazonaws.com`, four issuances a day (the last file in each of 00, 06, 12 and 18Z), every step; 767 of 768 files (2026-09-05 18Z is missing) |
| Open-Meteo | the total cloud cover and its low band (up to 3 km) at the point the dashboard asks for, default model | the Historical Forecast API (open-meteo.com, read 2026-10-10: "Each update from the weather models' initial hours is compiled into a seamless time series") and the Previous Runs API's `_previous_day1` ("the value that was predicted 24 hours before valid time") |

The NDFD archive stands in for api.weather.gov, which keeps no past
forecasts. On 2026-10-10 the gridpoint API's `skyCover` for the drop zone
(OAX 77,42) and the NDFD value at the nearest grid point, 0.87 km away,
were the same in 46 of 46 hours, and the same at Seattle, Miami and
Minneapolis. At Denver they differed, and the API's grid there was a day
old (its `updateTime` was 2026-10-09T18:46Z). So these are the figures the
API serves when its grid is current. Open-Meteo resolves both the live
forecast and the two archive APIs for the drop zone's point to the same
cell (40.8628, −96.1168), so the archives are for the same place the card
shows.

What each forecast is, by lead time:

- **NWS, latest issuance** is the newest of the four daily files issued
  before the hour, 0.7 to 7.2 hours ahead (12.2 for the 40 hours that the
  missing file left without one). The card reads the API, which updates
  more often, so on the card the lead is shorter than here, not longer.
  "The issuance before" is six hours older, and "a day earlier" 24 hours
  older.
- **Open-Meteo, start of run** is its best case: each hour comes from the
  first hours of a model run. The card's hours ahead come from runs made
  earlier, so the card's figures lie somewhere between this row and the
  "a day earlier" row.

How a forecast is set against a report. A METAR gives each layer's amount as
a range of eighths, the "summation amount" up to and including that layer
(AC 00-45H Chg 2, Table 3-3, read 2026-10-10 in the PDF at faa.gov): FEW 1/8
to 2/8 (any amount under 1/8 is also reported as FEW), SCT 3/8 to 4/8, BKN
5/8 to 7/8, OVC and VV 8/8. CLR at an automated station means "no layers are
detected at or below 12,000 ft". The report's cover is its highest-ranked
layer's range, in percent (an eighth is 12.5%). A forecast percentage falls
inside that range or misses it by so many points. A ceiling is "the lowest
layer aloft reported as broken or overcast", or the vertical visibility
(the same page), so a forecast "at or above 5/8" (62.5%) is one whose amount
could make a ceiling layer.

Two things the arithmetic cannot allow for, so read the figures with them:

- **CLR says nothing above 12,000 ft.** A forecast total includes high
  cloud, so a "no ceiling" or CLR hour with a high forecast may be cirrus
  the ceilometer cannot see. The NWS figure gives no layers to separate it.
  Open-Meteo's low band leaves out mid and high cloud, so it is the fairer
  of the Open-Meteo rows for those hours. On CLR hours its high band read
  a median 0% and a 90th percentile of 85%.
- **KPMV does not report FEW.** None of its 13,431 reports in this window
  had a FEW layer, nor did any of its 71,889 reports from 2024-01-01 to
  2026-10-10 (IEM archive, read 2026-10-10). Over the same span KLNK
  reported FEW 2,896 times and KOFF 7,214. Every KPMV report in that span
  was AUTO. Why it never reports FEW is not established. In practice a KPMV
  SCT can be less than 3/8, so the SCT row's "inside" is narrower than the
  station's real range; below, each SCT figure is also given against 0 to
  50%.

The summary code is `src/domain/cloudCoverSources.ts` (pure, tested); the
records are in `data/parity/cloud-cover-2026-04-01-to-2026-10-09.jsonl.gz`.
To run it again:

```
pip install eccodes eccodeslib
python3 scripts/cloudCoverFetch.py 2026-04-01 2026-10-09 out.jsonl.gz   # about 15 min
npx tsx scripts/cloudCoverSummary.ts out.jsonl.gz
```

The two scripts are by hand and in no workflow.

## What KPMV reported

Of the 4,482 hours, 6 had no sky group (the sensor was out: "RMK
TEMPORAIRILY INOPERATIVE"). Of the rest: CLR 2,632, SCT 547, BKN 373, OVC
917, VV 7. That makes 1,297 hours with a ceiling and 3,179 without.

## Against the report

| Forecast | Hours | Lead (h) | Inside the reported range | Below | Above | Median gap (points) | 90th pct gap |
|---|---|---|---|---|---|---|---|
| NWS, latest issuance | 4,476 | 0.7–12.2 | 288 (6%) | 1,260 (28%) | 2,928 (65%) | 19.5 | 62 |
| NWS, the issuance before | 4,469 | 6.2–18.2 | 286 (6%) | 1,287 (29%) | 2,896 (65%) | 20.5 | 62 |
| NWS, a day earlier | 4,451 | 24.2–36.2 | 265 (6%) | 1,305 (29%) | 2,881 (65%) | 22 | 62 |
| Open-Meteo, start of run (total) | 4,475 | — | 1,904 (43%) | 725 (16%) | 1,846 (41%) | 2 | 86 |
| Open-Meteo, a day earlier (total) | 4,475 | 24 | 1,563 (35%) | 606 (14%) | 2,306 (52%) | 12.5 | 100 |
| Open-Meteo, start of run (low band) | 4,475 | — | 2,336 (52%) | 991 (22%) | 1,148 (26%) | 0 | 50 |

"Inside" is a hard measure for the NWS figure, and it says more about the
shape of the two forecasts than about either one. CLR's range is
exactly 0% and OVC's exactly 100%, and the NWS grid almost never says
either: 471 of its 34,518 values were 0 and 51 were 100. Open-Meteo says
both often: of its 4,608 start-of-run hours, 1,352 were exactly 0 and
1,009 exactly 100. The NWS sky cover reads as a graded amount, Open-Meteo's
as a near yes-or-no. The middle of each distribution, by what was
reported, shows this better than "inside":

| Reported | Hours | NWS latest: median (10th–90th) | Open-Meteo start, total | Open-Meteo start, low band | Open-Meteo a day earlier, total |
|---|---|---|---|---|---|
| CLR | 2,632 | 23 (2–71) | 1 (0–99) | 0 (0–16) | 10 (0–100) |
| SCT | 547 | 54 (10–85) | 29 (0–100) | 7 (0–67) | 92 (0–100) |
| BKN | 373 | 65 (28–88) | 98 (2–100) | 27 (0–100) | 100 (0–100) |
| OVC | 917 | 83 (52–94) | 100 (31–100) | 100 (10–100) | 100 (20–100) |
| VV | 7 | 34 (24–68) | 14 (3–50) | 14 (3–50) | 3 (0–100) |

Read down a column. The NWS median rises steadily with the reported cover
(23, 54, 65, 83) and its 10th to 90th percentile band is wide in every row.
Open-Meteo's start-of-run total sits at 0 or 100 most of the time:

- On CLR hours, 1,789 of 2,631 (68%) were under 10% and 371 (14%) were 90%
  or more. The low band put 2,280 (87%) under 10%, so most of those 371 are
  above the low band, where the ceilometer cannot see.
- On OVC hours, 753 of 917 (82%) were 90% or more; the NWS figure was 90%
  or more on 259 (28%) and 80% or more on 509 (56%).
- On SCT hours both scatter. Against 0 to 50% (KPMV reports no FEW), the
  NWS figure was under 50 on 245 of 547 hours (45%) and Open-Meteo's on
  327 (60%).

The 7 VV hours (fog) are too few to read.

## Ceilings

| Forecast | Ceiling reported: forecast ≥ 5/8 | Ceiling reported: forecast below | No ceiling: forecast ≥ 5/8 | No ceiling: forecast below |
|---|---|---|---|---|
| NWS, latest issuance | 943 (73%) | 354 | 625 (20%) | 2,554 |
| NWS, the issuance before | 905 (70%) | 391 | 584 (18%) | 2,589 |
| NWS, a day earlier | 836 (65%) | 445 | 547 (17%) | 2,623 |
| Open-Meteo, start of run (total) | 1,001 (77%) | 296 | 662 (21%) | 2,516 |
| Open-Meteo, a day earlier (total) | 998 (77%) | 299 | 1,373 (43%) | 1,805 |
| Open-Meteo, start of run (low band) | 856 (66%) | 441 | 120 (4%) | 3,058 |

The percentages are of the hours with a ceiling (first column) and without
one (third). "No ceiling" includes hours with cloud above 12,000 ft, so the
third column counts some hours where the forecast cloud was really there.
The low band's 4% is the figure least affected by that.

Lead time shows in each source differently. The NWS figure changes little
from a day ahead to the latest issuance: it is at or above 5/8 on 65%, then
73%, of the ceiling hours. Open-Meteo's day-ahead total is at or above 5/8
on as many ceiling hours as its start of run is, but is at or above 5/8 on more than twice as many
hours without a ceiling (43% against 21%).

## The two forecasts against each other

For the same hour, the NWS latest issuance minus Open-Meteo's start of run
differed by a median of 19 points, a 90th percentile of 52, and a signed
mean of +3.8 (n 4,475). Against the reported range, both were inside on 48
hours (1%), the NWS figure alone on 239 (5%), Open-Meteo's alone on 1,856
(41%) and neither on 2,332 (52%). That split mostly follows from the shapes
above: the NWS figure is rarely at 0 or 100, which are the whole of CLR's
and OVC's ranges.

## What this does not say

- **Height.** Neither forecast here has a base. The card's NWS ceiling
  figure comes from the gridpoint's separate `ceilingHeight`, which this
  comparison did not read.
- **Season.** April to early October, the jumping season, at one station.
  Winter stratus may behave differently.
- **The card's actual lead.** The NWS rows bracket it from above (the
  API is fresher than four files a day). The Open-Meteo rows bracket it
  from both sides, and the card's next twelve hours sit between them.
- **Where KPMV is not the drop zone.** KPMV is about 11.5 miles ENE of the
  drop zone, while both forecasts are for the drop zone's grid point.
  Some of every gap is that distance.
