# Open-Meteo cloud cover, RRFS and default, against KPMV reports

Weather data by [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0): the model percentages below are its figures as logged by this repository's comparison runs. Station reports from the Iowa Environmental Mesonet's ASOS archive.

Counts and a table only. Nothing here says which model is nearer; that reading is the maintainer's.

## Sources

- Logged hours: 6 archive files, `data/parity/parity-logs-2026-11-20.jsonl.gz` to `parity-logs-2026-11-26.jsonl.gz`, read with `parseParityLines`.
- KPMV reports: one request, fetched 2026-11-27T06:43:16Z (UTC), 201 reports from 2026-11-24 00:15Z to 2026-11-26 23:55Z:
  `https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?station=PMV&data=metar&year1=2026&month1=11&day1=24&year2=2026&month2=11&day2=27&tz=Etc/UTC&format=onlycomma&latlon=no&report_type=3&report_type=4`

## How each figure was read

- Valid hour: `validHourOf(record)`. Paired report: `reportNear`, the report nearest the hour within 10 minutes either side (`REPORT_WINDOW_MIN`), a tie going to the earlier.
- Sky groups: the tokens of the METAR body (before `RMK`) that `parseSkyGroups` reads as a sky group, printed as the text has them.
- Ceiling or none: `isCeiling(observedCoverBelow(layers, Infinity).category)`, the report's highest-ranked layer. BKN, OVC and VV are a ceiling (`CEILING_COVERS`); CLR, FEW and SCT are not. A vertical visibility (VV) is therefore read as a ceiling, 8/8, as the repository's cloud-cover comparison reads it.
- The line: 62.5% (`CEILING_EIGHTHS` × 12.5, 5/8 of the sky, the least a broken layer covers), "at or above", the same line `cloudCoverSources.ts` holds a forecast percentage to against a reported ceiling.
- An hour is counted once per distinct (valid hour, RRFS run initialisation), the later record kept.

## Limits that bear on every row

- KPMV is an automated station and reports cloud only up to 12,000 ft AGL: `CLR` means no cloud below 12,000 ft, not a clear sky. A model total made of high cloud is not contradicted by `CLR`. Open-Meteo's low band is cloud below 3 km and its mid band 3 to 8 km, so the band comparable with the station is mostly low and part of mid; the mid and high columns are printed so a total can be read against that. 3 km is about 9,800 ft, so by that description a reported base of 100 (10,000 ft AGL) or higher sits in the mid band and a lower one in the low band; the low band's limit is as the repository's docs/cloud-cover-sources.md gives it ("up to 3 km") and the mid band's 3 to 8 km as the task stated it, neither read again at Open-Meteo for this report, and whether a model's bands are cut by height or by pressure was not checked.
- KPMV is about 11 miles from the drop zone's grid point; part of any difference is the distance.
- The two models were not the same age at an hour. The "run age" columns give hours from each run's initialisation to the valid hour, from the run metadata the comparison logged (`rrfs.run.init`, and `omRuns.ncep_hrrr_conus.init` for the default; that the default answer was served from that run is the comparison's assumption, not checked here).
- 13 hours over 2026-11-24 14:00Z to 2026-11-26 22:00Z: a small sample from one spell of weather.

## Accounting

- Non-empty lines in the files: 144. Records `parseParityLines` returned: 144 (lines not read as a record: 0). Records repeated across files and counted once: 0.
- Schulze-comparison records: 72. Of those, with `rrfs`: **19**; without (before the RRFS was logged, or the default request failed): 53.
- Of the 19 with `rrfs`: with a cloud pair **17**, no cloud pair logged **2**.
- Of the 17 with a cloud pair: dropped as a duplicate (valid hour, RRFS run) **2**, distinct hours **15**.
- Of the 15 distinct hours: paired with a report that has a sky group **13**, no report within the window **2**, report with no sky group **0**.
- Check: 17 + 2 = 19; 15 + 2 = 17; 13 + 2 + 0 = 15.
- Valid hours that appear under two different RRFS runs (each counted): 0.

## Hour by hour

Percent of sky. "Run age" is hours from the model run's initialisation to the valid hour.

| Valid hour (UTC) | KPMV report | Sky groups | Ceiling | RRFS total | RRFS low | Default total | Default low | RRFS mid | RRFS high | Default mid | Default high | RRFS run age (h) | Default run age (h) |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2026-11-24 14:00Z | 2026-11-24 13:55Z | CLR | none | 100 | 10 | 100 | 3 | 100 | 100 | 100 | 100 | 8 | 3 |
| 2026-11-24 18:00Z | 2026-11-24 17:55Z | CLR | none | 100 | 40 | 54 | 5 | 100 | 99 | 12 | 54 | 12 | 2 |
| 2026-11-24 20:00Z | 2026-11-24 19:55Z | SCT110 | none | 100 | 98 | 70 | 4 | 100 | 83 | 49 | 70 | 8 | 2 |
| 2026-11-24 23:00Z | 2026-11-24 22:55Z | BKN100 BKN120 | ceiling | 100 | 100 | 17 | 0 | 100 | 0 | 17 | 17 | 11 | 2 |
| 2026-11-25 00:00Z | 2026-11-24 23:55Z | BKN100 OVC110 | ceiling | 100 | 100 | 100 | 0 | 100 | 0 | 100 | 4 | 12 | 2 |
| 2026-11-25 03:00Z | 2026-11-25 02:55Z | SCT070 BKN095 OVC110 | ceiling | 100 | 100 | 100 | 3 | 100 | 0 | 100 | 0 | 9 | 2 |
| 2026-11-25 05:00Z | 2026-11-25 04:55Z | OVC060 | ceiling | 100 | 100 | 100 | 25 | 100 | 0 | 100 | 0 | 11 | 3 |
| 2026-11-25 10:00Z | 2026-11-25 09:55Z | SCT095 | none | 100 | 100 | 100 | 100 | 92 | 0 | 100 | 0 | 10 | 3 |
| 2026-11-25 13:00Z | 2026-11-25 12:55Z | BKN075 BKN120 | ceiling | 100 | 100 | 100 | 4 | 100 | 0 | 100 | 0 | 13 | 3 |
| 2026-11-25 19:00Z | 2026-11-25 18:55Z | SCT060 | none | 81 | 62 | 7 | 7 | 81 | 0 | 1 | 0 | 13 | 2 |
| 2026-11-25 22:00Z | 2026-11-25 21:55Z | CLR | none | 7 | 7 | 1 | 1 | 1 | 0 | 0 | 0 | 10 | 3 |
| 2026-11-26 00:00Z |  | no report in window | left out | 38 | 8 | 1 | 0 | 38 | 0 | 1 | 0 | 12 | 3 |
| 2026-11-26 04:00Z |  | no report in window | left out | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 10 | 3 |
| 2026-11-26 12:00Z | 2026-11-26 11:55Z | OVC080 | ceiling | 16 | 0 | 100 | 1 | 16 | 6 | 79 | 100 | 12 | 2 |
| 2026-11-26 22:00Z | 2026-11-26 21:55Z | CLR | none | 100 | 0 | 100 | 0 | 59 | 100 | 0 | 100 | 10 | 3 |

## Counts

Hours paired: **13**. KPMV reported a ceiling in **6** and none in **7**.

Hours with the model's figure at or above 62.5%, of the hours in the group that have that band:

| KPMV | Hours | RRFS total | RRFS low | Default total | Default low |
|---|---:|---:|---:|---:|---:|
| Ceiling reported (BKN, OVC or VV) | 6 | 5 of 6 | 5 of 6 | 5 of 6 | 0 of 6 |
| No ceiling reported (CLR, FEW or SCT) | 7 | 6 of 7 | 2 of 7 | 4 of 7 | 1 of 7 |

Hours each model's total was exactly 100% and exactly 0%:

| Model | Paired hours | Exactly 100% | Exactly 0% | All distinct logged hours | Exactly 100% | Exactly 0% |
|---|---:|---:|---:|---:|---:|---:|
| RRFS | 13 | 10 | 0 | 15 | 10 | 1 |
| Default | 13 | 8 | 0 | 15 | 8 | 1 |

## Left out, and listed

Records with `rrfs` and no cloud pair logged (2):

- run at 2026-11-24T04:06:39.944Z, hour 04Z, no `rrfs.cloud` on the record
- run at 2026-11-24T05:43:14.146Z, hour 06Z, no `rrfs.cloud` on the record

Records dropped as a second log of the same (valid hour, RRFS run) (2):

- valid 2026-11-24 23:00Z, RRFS run 2026-11-24T12:00:00.000Z: dropped the run at 2026-11-24T22:41:32.590Z, kept the run at 2026-11-24T22:49:46.842Z
- valid 2026-11-25 22:00Z, RRFS run 2026-11-25T12:00:00.000Z: dropped the run at 2026-11-25T21:55:16.482Z, kept the run at 2026-11-25T22:02:15.421Z

Hours with no KPMV report within 10 minutes (2):

- 2026-11-26 00:00Z: the nearest reports in the file are 2026-11-25 23:35Z CLR before and 2026-11-26 00:55Z CLR after, both outside the window and not counted
- 2026-11-26 04:00Z: the nearest reports in the file are 2026-11-26 03:15Z CLR before and 2026-11-26 04:35Z CLR after, both outside the window and not counted

Hours whose paired report has no sky group (0):

- none

Null bands, skipped for that band only (0):

- none

## The paired reports in full

- 2026-11-24 14:00Z: `KPMV 241355Z AUTO 12003KT 10SM CLR M04/M08 A3057 RMK AO2 T10371078`
- 2026-11-24 18:00Z: `KPMV 241755Z AUTO 18005KT 10SM CLR 00/M07 A3053 RMK AO2 T00031072 10005 21040`
- 2026-11-24 20:00Z: `KPMV 241955Z AUTO 13003KT 10SM SCT110 02/M09 A3048 RMK AO2 T00201090`
- 2026-11-24 23:00Z: `KPMV 242255Z AUTO 00000KT 10SM BKN100 BKN120 02/M08 A3045 RMK AO2 T00171083`
- 2026-11-25 00:00Z: `KPMV 242355Z AUTO 00000KT 10SM BKN100 OVC110 02/M09 A3045 RMK AO2 T00151086 10029 20004`
- 2026-11-25 03:00Z: `KPMV 250255Z AUTO 00000KT 10SM SCT070 BKN095 OVC110 01/M05 A3045 RMK AO2 T00051050`
- 2026-11-25 05:00Z: `KPMV 250455Z AUTO 13008KT 10SM OVC060 01/M05 A3043 RMK AO2 T00051051`
- 2026-11-25 10:00Z: `KPMV 250955Z AUTO 09004KT 10SM SCT095 00/M05 A3043 RMK AO2 T10051046`
- 2026-11-25 13:00Z: `KPMV 251255Z AUTO 00000KT 10SM BKN075 BKN120 M01/M04 A3045 RMK AO2 T10061037`
- 2026-11-25 19:00Z: `KPMV 251855Z AUTO 02006KT 10SM SCT060 03/M04 A3046 RMK AO2 T00311041`
- 2026-11-25 22:00Z: `KPMV 252155Z AUTO 05006KT 10SM CLR 04/M07 A3043 RMK AO2 T00401071`
- 2026-11-26 12:00Z: `KPMV 261155Z AUTO 36004KT 10SM OVC080 M02/M04 A3036 RMK AO2 T10201045 11019 21045`
- 2026-11-26 22:00Z: `KPMV 262155Z AUTO 32006KT 10SM CLR 04/M06 A3017 RMK AO2 T00421056`
