# Cloud cover at AWOS and ASOS stations

Two questions from 2026-10-10, after the KPMV comparison
([cloud-cover-sources.md](cloud-cover-sources.md)) found that KPMV, an AWOS,
never reports FEW:

1. When did the Nebraska AWOS that never report FEW stop, or did they ever
   report it? ("When the AWOS stopped reporting FEW", below.)
2. Set beside the ASOS at a larger airport nearby, how often does such an
   AWOS report what the ASOS does, and which forecast, the NWS gridpoint or
   Open-Meteo, is nearer each station's own reports? ("Each AWOS beside its
   ASOS" and "The forecasts at each station", below.)

This page changes nothing on the dashboard. Counts and spreads, never a
grade. A useful page for any one station, by hand:
<https://airfield.directory/airfield/KPMV> (the maintainer's find; not
reachable from the sandbox, so nothing here was read from it). Another is
the FAA WeatherCams AWOS/ASOS stations list,
<https://weathercams.faa.gov/stations>, which gives each station's type and
status; its data API answers a script with 401.

## When the AWOS stopped reporting FEW

The share of each Nebraska station's July reports with a FEW layer, from
the Iowa Environmental Mesonet's archive (routine and special reports, its
decoded sky-cover columns); "·" where the station is not in the archive
that July. Types are the FAA's NASR AWOS file (2026-10-01 cycle), which for
KPMV disagrees with the WeatherCams list (cloud-cover-sources.md).
`python3 scripts/fewHistory.py AWOS.csv` prints it.

| Station | Type | 96 | 97 | 98 | 99 | 00 | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| KAIA | ASOS | 9 | 7 | 12 | 7 | 8 | 10 | 6 | 7 | 12 | 7 | 9 | 11 | 8 | 16 | 10 | 12 | 8 | 10 | 11 | 11 | 11 | 14 | 13 | 14 | 15 | 9 | 14 | 11 | 15 | 10 |
| KBBW | ASOS | 18 | 21 | 15 | 26 | 13 | 10 | 9 | 7 | 14 | 7 | 8 | 12 | 11 | 13 | 12 | 10 | 7 | 13 | 12 | 13 | 13 | 13 | 16 | 16 | 16 | 13 | 12 | 17 | 13 | 13 |
| KBFF | ASOS | 20 | 18 | 22 | 6 | 8 | 8 | 3 | 3 | 11 | 6 | 5 | 10 | 6 | 11 | 8 | 8 | 10 | 13 | 10 | 11 | 12 | 9 | 13 | 12 | 7 | 11 | 12 | 13 | 12 | 9 |
| KCDR | ASOS | 33 | 40 | 29 | 40 | 36 | 8 | 6 | 3 | 11 | 6 | 7 | 7 | 7 | 13 | 10 | 7 | 11 | 14 | 7 | 11 | 14 | 10 | 11 | 14 | 10 | 10 | 11 | 11 | 12 | 9 |
| KFNB | ASOS | 1 | 17 | 22 | 10 | 13 | 17 | 10 | 9 | 9 | 5 | 7 | 15 | 14 | 15 | 20 | 14 | 8 | 13 | 16 | 19 | 12 | 10 | 16 | 13 | 19 | 17 | 14 | 17 | 15 | 20 |
| KGRI | ASOS | 13 | 11 | 10 | 10 | 14 | 10 | 9 | 8 | 12 | 6 | 6 | 13 | 14 | 15 | 15 | 11 | 4 | 14 | 11 | 12 | 13 | 11 | 16 | 15 | 16 | 15 | 14 | 16 | 13 | 17 |
| KHSI | ASOS | 11 | 17 | 19 | 17 | 24 | 10 | 10 | 6 | 40 | 7 | 7 | 14 | 11 | 14 | 15 | 10 | 5 | 12 | 12 | 16 | 11 | 15 | 15 | 12 | 16 | 16 | 17 | 17 | 13 | 16 |
| KIML | ASOS | 12 | 5 | 7 | 6 | 10 | 10 | 6 | 6 | 10 | 6 | 9 | 13 | 8 | 15 | 13 | 7 | 7 | 13 | 8 | 11 | 13 | 13 | 16 | 8 | 12 | 10 | 12 | 8 | 10 | 12 |
| KLBF | ASOS | 14 | 6 | 8 | 6 | 11 | 12 | 7 | 6 | 10 | 4 | 7 | 10 | 11 | 14 | 14 | 10 | 7 | 11 | 12 | 12 | 13 | 13 | 13 | 13 | 14 | 12 | 12 | 16 | 13 | 11 |
| KLNK | ASOS | 13 | 29 | 32 | 25 | 29 | 26 | 26 | 25 | 8 | 5 | 5 | 13 | 13 | 13 | 16 | 12 | 7 | 12 | 11 | 13 | 13 | 13 | 17 | 15 | 16 | 15 | 12 | 18 | 16 | 18 |
| KMCK | ASOS | 22 | 8 | 9 | 4 | 10 | 11 | 7 | 6 | 14 | 5 | 10 | 11 | 8 | 13 | 11 | 9 | 8 | 12 | 12 | 14 | 10 | 13 | 15 | 12 | 14 | 12 | 15 | 10 | 12 | 11 |
| KODX | ASOS | 17 | 21 | 12 | 27 | 7 | 12 | 7 | 5 | 15 | 9 | 10 | 13 | 12 | 15 | 17 | 12 | 5 | 11 | 16 | 13 | 13 | 13 | 17 | 19 | 16 | 14 | 11 | 15 | 14 | 15 |
| KOFK | ASOS | 18 | 19 | 22 | 33 | 28 | 13 | 8 | 10 | 7 | 5 | 4 | 13 | 13 | 15 | 18 | 13 | 3 | 12 | 17 | 15 | 12 | 13 | 17 | 15 | 14 | 15 | 13 | 17 | 12 | 20 |
| KOMA | ASOS | 8 | 27 | 31 | 26 | 29 | 29 | 30 | 33 | 27 | 23 | 13 | 27 | 26 | 41 | 42 | 42 | 50 | 47 | 44 | 40 | 50 | 46 | 42 | 46 | 43 | 43 | 40 | 51 | 46 | 43 |
| KSNY | ASOS | 10 | 9 | 11 | 6 | 7 | 10 | 3 | 6 | 10 | 8 | 9 | 13 | 5 | 10 | 10 | 11 | 12 | 13 | 12 | 14 | 13 | 12 | 13 | 11 | 10 | 10 | 14 | 12 | 11 | 10 |
| KTQE | ASOS | 12 | 12 | 13 | 12 | 12 | 13 | 12 | 11 | 11 | 5 | 5 | 15 | 12 | 11 | 19 | 13 | 5 | 11 | 13 | 16 | 16 | 13 | 13 | 15 | 14 | 16 | 12 | 15 | 13 | 19 |
| KVTN | ASOS | 14 | 11 | 13 | 6 | 10 | 11 | 6 | 7 | 11 | 6 | 6 | 11 | 9 | 12 | 13 | 13 | 6 | 13 | 14 | 14 | 11 | 11 | 14 | 19 | 13 | 10 | 12 | 15 | 15 | 14 |
| K4V9 | AWOS-3PT | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 15 |
| KAFK | AWOS-3PT | · | · | · | · | · | · | · | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| KAHQ | AWOS-3P | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| KANW | AWOS-3 | · | 0 | 0 | 16 | 18 | 18 | 15 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| KAUH | AWOS-3 | · | 0 | 0 | 1 | 11 | 4 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| KBIE | AWOS-3 | · | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| KBTA | AWOS-3 | · | · | · | · | · | · | · | · | · | · | · | · | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| KBVN | AWOS-3 | · | · | · | · | · | · | · | · | · | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| KCSB | AWOS-3PT | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 10 | 9 |
| KEAR | AWOS-3PT | 0 | 0 | 15 | 10 | 14 | 11 | 7 | 8 | 16 | 10 | 13 | 12 | 9 | 11 | 13 | 11 | 3 | 12 | 10 | 10 | 9 | 9 | 17 | 15 | 15 | 15 | 13 | 15 | 13 | 11 |
| KFET | AWOS-3 | · | 0 | 0 | 11 | 15 | 8 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| KGGF | AWOS-3PT | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 9 | 9 | 8 |
| KGRN | AWOS-3PT | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| KHDE | AWOS-3 | · | 0 | 0 | 9 | 14 | 13 | 9 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| KHJH | AWOS-3 | · | · | · | · | · | · | · | · | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| KIBM | AWOS-3 | · | · | · | · | · | · | · | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| KJYR | AWOS-3 | · | · | · | · | · | · | 12 | 12 | 22 | 13 | 9 | 15 | 13 | 13 | 16 | 13 | 5 | 11 | 11 | 13 | 9 | 10 | 14 | 11 | 12 | 15 | 11 | 12 | 11 | 14 |
| KLCG | AWOS-3 | · | · | · | · | · | · | · | · | · | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| KLXN | AWOS-3 | · | 0 | 0 | 6 | 12 | 14 | 9 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| KMLE | AWOS-3 | · | · | · | · | · | · | · | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| KOGA | AWOS-3 | · | 0 | 0 | 8 | 9 | 9 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| KOLU | AWOS-3PT | 0 | 0 | 15 | 12 | 14 | 7 | 6 | 5 | 7 | 6 | 4 | 13 | 12 | 12 | 16 | 12 | 3 | 11 | 12 | 10 | 13 | 12 | 15 | 13 | 14 | 15 | 10 | 17 | 14 | 17 |
| KONL | AWOS-3 | · | 0 | 0 | 7 | 11 | 12 | 7 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| KPMV | AWOS-3 | · | · | · | · | · | · | · | · | · | · | · | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| KTIF | AWOS-3 | · | · | · | · | · | · | · | · | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Three groups:

- **Every ASOS reported FEW in every July**, 1 to 51% of reports (KOMA,
  staffed, the most).
- **Seven AWOS of the 1990s network reported FEW from 1999 to 2002, then
  never again**: KANW, KAUH, KFET, KHDE, KLXN, KOGA and KONL. (Their 1997
  and 1998 Julys show none either; whether that is the stations or the
  archive's early years was not looked into.)
- **Every AWOS that entered the archive from 2003 to 2017 has never
  reported FEW**, KPMV (2007) among them. The three newest, KGGF (2023),
  KCSB (2024) and K4V9 (2025), do. So do KJYR (in the archive from 2002),
  and KEAR and KOLU, which have been there since 1996 and report hourly
  with a sea-level pressure, as the ASOS do.

Each of the seven stopped within days of a change in its reports' remarks
from AO1 to AO2. AC 00-45H (Change 2, read 2026-10-10) defines them:
"automated stations without a precipitation discriminator are identified
as AO1; automated stations with a precipitation discriminator are
identified as AO2". So the change is new equipment. The dates, from the
METAR text (`python3 scripts/fewHistory.py AWOS.csv switch`):

| Station | Last report with FEW | First report marked AO2 |
|---|---|---|
| KHDE | 2002-08-22 15:10Z | 2002-08-27 20:10Z |
| KANW | 2002-09-14 16:10Z | 2002-09-18 20:11Z |
| KONL | 2002-09-19 03:30Z | 2002-09-25 22:10Z |
| KFET | 2002-10-16 13:30Z | 2002-10-18 15:50Z |
| KOGA | 2002-11-18 15:10Z | 2002-11-26 15:31Z |
| KLXN | 2002-11-20 14:50Z | 2002-11-21 20:31Z |
| KAUH | 2003-03-03 16:28Z | 2003-03-04 20:10Z |

A rollout across the state over seven months, and the equipment it brought
has not written FEW since, at those seven or at any AWOS installed after
them that reports the same way. That is the cause the KPMV doc inferred,
now dated; which make and software it was is not in anything read here.
Nebraska DOT's aeronautics division, which runs these stations, would
know.

It is not the code. FEW was in the US code before the switch and after it:
AC 00-45E (December 1999, read 2026-10-10 on faa.gov) lists "FEW Few >0
but < 2/8" and says CLR "shall be used at automated stations when no
clouds below 12,000 feet are detected"; FAA Order JO 7900.5E Change 1
(2021) says automated stations report each layer as "the amount (FEW, SCT,
BKN, OVC)". The US took up the METAR code, FEW with it, on 1996-07-01;
before that its hourly reports (SA) gave cover in tenths in four
categories with no FEW. That date and the SA categories are from search
summaries of NOAA's METAR program overview and a NOAA paper (Free and Sun,
on biases in US cloud-cover records), which the sandbox could not open.


## Each AWOS beside its ASOS

Six AWOS that never report FEW, and two that do (KCSB, KGGF), each set
beside the ASOS nearest it, April 1 to October 9 2026. Distances are from
the FAA's coordinates (NASR AWOS file). At each top of the hour each
station's report nearest it, within 10 minutes, is taken. Both are read
below 12,000 ft (`AUTOMATED_TOP_FT`): an AWOS's ceilometer reports nothing
higher, and KOMA, staffed, reports cirrus at 25,000 ft, which would
otherwise count as a disagreement it is not. A report whose layers all lie
above reads as CLR, as an automated station would report it.
`npx tsx scripts/cloudCoverStations.ts
data/parity/cloud-cover-stations-2026-04-01-to-2026-10-09.jsonl.gz` prints
this table and the next; the arithmetic is `src/domain/stationPairs.ts`.

| AWOS | ASOS | Miles | Hours | Same category | Ceiling: both / AWOS only / ASOS only / neither | ASOS FEW: AWOS CLR / FEW / SCT / BKN+ | AWOS SCT: ASOS CLR / FEW / SCT / BKN+ |
|---|---|---|---|---|---|---|---|
| KBTA | KOMA | 12.9 | 4456 | 62% | 26% / 5% / 5% / 63% | 586 / 0 / 124 / 49 (n 759) | 48 / 124 / 161 / 154 (n 487) |
| KMLE | KOMA | 13.6 | 4467 | 62% | 27% / 6% / 5% / 62% | 574 / 0 / 119 / 61 (n 754) | 55 / 119 / 175 / 167 (n 516) |
| KAUH | KGRI | 17.2 | 4498 | 76% | 26% / 6% / 3% / 65% | 96 / 0 / 82 / 91 (n 269) | 211 / 82 / 47 / 98 (n 438) |
| KPMV | KOMA | 25.1 | 4464 | 58% | 23% / 6% / 9% / 63% | 572 / 0 / 132 / 60 (n 764) | 69 / 132 / 137 / 208 (n 546) |
| KAHQ | KLNK | 28.3 | 4336 | 71% | 22% / 6% / 8% / 64% | 106 / 0 / 70 / 76 (n 252) | 200 / 70 / 56 / 177 (n 503) |
| KLCG | KOFK | 29.4 | 4418 | 71% | 26% / 8% / 5% / 61% | 104 / 0 / 74 / 93 (n 271) | 201 / 74 / 40 / 118 (n 433) |
| KCSB | KMCK | 23.8 | 4391 | 74% | 21% / 7% / 4% / 68% | 95 / 42 / 42 / 69 (n 248) | 87 / 42 / 20 / 74 (n 223) |
| KGGF | KIML | 25.6 | 3715 | 71% | 21% / 8% / 5% / 66% | 92 / 30 / 26 / 64 (n 212) | 77 / 26 / 23 / 64 (n 190) |

The last two columns are counts of hours, out of n: when the ASOS reported
FEW, what the AWOS reported; and when the AWOS reported SCT, what the ASOS
reported.

What it shows:

- **Away from KOMA, the no-FEW AWOS agree with their ASOS as often as the
  FEW-reporting ones do**: the same category on 71 to 76% of hours (KAUH,
  KAHQ, KLCG), against 71 and 74% (KGGF, KCSB). They agree about a ceiling,
  or its absence, on 86 to 91% of hours, against 87 and 89%.
- **Where the ASOS reports FEW, a no-FEW AWOS reports SCT about as often
  as a FEW-reporting AWOS reports FEW or SCT together.** At KAUH, KAHQ and
  KLCG: CLR 36 to 42%, SCT 27 to 30%, BKN or more 30 to 34%. At KCSB and
  KGGF: CLR 38 and 43%, FEW 17 and 14%, SCT 17 and 12%, BKN or more 28 and
  30%. The FEW the controls report shows up, at the no-FEW AWOS, as SCT.
  That is what the KPMV doc inferred: a small amount, reported as SCT.
- **KOMA is the exception.** Its three AWOS (KBTA, KMLE and KPMV, 13 to 25
  miles off) agree on the category on 58 to 62% of hours. On the hours
  KOMA reported FEW below 12,000 ft, they reported CLR on 75 to 77%. KOMA
  is staffed (its reports carry no AUTO), and an observer sees the whole
  sky, while one ceilometer sees only the cloud that drifts over it (AIM
  7-1-10, quoted in cloud-cover-sources.md). Ceiling agreement there is 86
  to 89%, near the others.

Some of every disagreement is the sky: the stations are 13 to 29 miles
apart.

## The forecasts at each station

The NWS forecast (NDFD, the gridpoint API's figures, cloud-cover-sources.md)
read at each station's own grid point, its latest issuance before the
hour, against that station's reports, both below 12,000 ft. Figures are
the share of hours the forecast was at or above 5/8, the least a broken
layer covers (AC 00-45H), on hours the station reported a ceiling and on
hours it reported none, and the share of hours its call (5/8 or more, or
not) matched the report.

| Station | Hours | FEW reports | Ceiling hours reached: NWS | No-ceiling hours reached: NWS | Ceiling call agreed: NWS |
|---|---|---|---|---|---|
| KBTA | 4469 | 0% | 78% | 21% | 79% |
| KOMA | 4589 | 15% | 75% | 18% | 80% |
| KMLE | 4480 | 0% | 76% | 20% | 79% |
| KAUH | 4502 | 0% | 77% | 18% | 80% |
| KGRI | 4597 | 6% | 80% | 18% | 82% |
| KPMV | 4477 | 0% | 74% | 20% | 78% |
| KAHQ | 4338 | 0% | 77% | 23% | 77% |
| KLNK | 4606 | 6% | 74% | 18% | 79% |
| KLCG | 4487 | 0% | 72% | 22% | 76% |
| KOFK | 4532 | 6% | 77% | 19% | 80% |
| KCSB | 4439 | 5% | 73% | 16% | 81% |
| KMCK | 4553 | 5% | 73% | 16% | 81% |
| KGGF | 4467 | 6% | 63% | 16% | 78% |
| KIML | 3808 | 5% | 49% | 31% | 64% |

- The NWS forecast's call matched **76 to 80% of hours at the no-FEW AWOS,
  79 to 82% at the ASOS, and 78 and 81% at the two FEW-reporting AWOS.**
  Which kind of station reports makes little difference to how the
  forecast reads against it; KPMV's 78% is in the middle.
- KIML (64%) stands apart, and has a gap in its reports in July and August
  (592 and 258 reports, against 829 to 935 in the other full months). Why
  its figures differ was not looked into.

**Open-Meteo is not in these tables yet.** Its archive refused the
fetch on 2026-10-10 after a run of 429 answers: "Daily API request limit
exceeded. Please try again tomorrow." The sandbox shares its address, so
the limit is not this comparison's alone. The fetch script takes
`PARTS=om` to fetch that part alone; give it the same points, which
`npx tsx scripts/cloudCoverStations.ts --sites` prints in its SITES form,
and append its gzipped lines to the archive above (the two are
concatenated JSON lines; `zcat a b | gzip`). The summary script adds
Open-Meteo's columns when the file has its records.
