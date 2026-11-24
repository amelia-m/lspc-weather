# Plan: comparing the RRFS on an ongoing basis

> Open-Meteo figures in this document are weather data by [Open-Meteo.com](https://open-meteo.com/), under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), compared as the document describes. See [open-meteo-terms.md](open-meteo-terms.md).

Draft, 2026-11-24, at the maintainer's word ("plan ongoing comparison. roll into other ongoing data comparison workflows"). Steps 1 and 3 to 5 are built (she said to go ahead with 3 to 5 the same day); 2, 6 and 7 are not.

## Why

NOAA replaced the NAM with the Rapid Refresh Forecast System on 2026-11-03, and Open-Meteo says the HRRR "will be discontinued in the future with the release of RRFSv2" (docs/open-questions.md, "The RRFS"). The dashboard's winds aloft, drift, the Winds aloft card's Surface row and the second cloud figure on Ceiling & sky all come from one Open-Meteo request that names no model and has been served from the HRRR here. When Open-Meteo changes that default, those figures change with no change to this repository. The comparison is there to know, before that day, how large the change is, and to notice the day.

## What it should answer

1. **How far does the winds-aloft table move,** altitude by altitude, and is the difference steady or does it follow the weather or the hour of day?
2. **Which 10 m wind is nearer KPMV's reports,** the default's or the RRFS's? The Surface row is the one row that can be held to a measurement.
3. **How old is the forecast a reader gets?** The first record had the RRFS run served at 04Z as the 18Z run, available nine hours after its start; the HRRR's is hourly (docs/run-split.md).
4. **What does the missing 180 m wind cost?** The RRFS served 10, 80 and 120 m but not 180 m on 2026-11-24, so its 500 ft row rests on fewer samples.
5. **Does its cloud cover differ,** since the card shows that figure as served?
6. **When does the default switch?**

## Steps, in order

Each rolls into a workflow that already runs, on GitHub's runners, never the sandbox. Costs are Open-Meteo calls a day at the weights in docs/open-meteo-terms.md.

1. **Winds aloft, in the comparison (done 2026-11-24, PR #317).** `scripts/schulzeCompare.live.ts` logs the RRFS table minus the default at the same hour, with the RRFS run's metadata (`rrfs` on the record), nine runs a day. The first record from a runner, 2026-11-24 04:06Z (run 45323976716): 22 samples, all 15 rows, the 18Z RRFS run. About 90 calls a day. Answers 1 and 3 once summarised.
2. **The summary and `#parity`.** `paritySummary.ts` reads the `rrfs` rows: counts and spreads by altitude, as the page shows the Schulze rows, plus the run's age. Counts only, never a grade. Wait for two weeks of records (about 120) before drawing it. No new requests.
3. **The 10 m wind, in the surface-wind sampler (built 2026-11-24).** `scripts/surfaceWindCompare.live.ts` already asks once more with `models=ncep_hrrr_conus` and logs whether the default equals it (`sameAsHrrr`). It now makes the same request of the RRFS: its 10 m series as a fourth forecast source beside `nws`, `omHourly` and `om15`, paired against KPMV by `pairsVsMetar`, and the RRFS domain's run metadata beside the HRRR's. The request is three surface variables, weight 1; the archive's recent days hold about 140 runs, so about 140 calls a day. Answers 2 and 3, and feeds the sample section of `#wind-errors` through the weekly refresh as a fifth row, "Open-Meteo RRFS hourly, from 2026-11-24". Records are version 3 (`rrfs`, `om.sameAsRrfs`). First record, from the sandbox at 05:33Z: RRFS 40° 2.7 kt against the default's 46° 2.2 kt and KPMV's 080° 3 kt; same as the HRRR, not the RRFS.
4. **The switch detector (built 2026-11-24).** `defaultModelByDay` counts, per UTC day, the runs whose default differed from the HRRR by name, matched the RRFS by name, or could not get the HRRR by name at all; `defaultModelSwitched` calls a day when any of the three holds for more than half of at least twenty runs. `scripts/defaultModelCheck.ts` runs daily in parity-summary.yml and opens one issue, labelled `model-switch`, on the first such day. Run over the archive's 47 days to 2026-11-23, no day reads as a switch: the most that differed was 15 of 180, the most HRRR failures 13 of 137. No new requests. Answers 6.
5. **Cloud cover (built 2026-11-24).** The comparison's RRFS answer already carries `cloud_cover` and its three bands, since it is the app's own request; the record now holds those four figures for the hour beside the default's (`rrfs.cloud`), as served. First record: both 100%, low cloud 0% against 5%. No new requests. Answers 5.
6. **The 500 ft row.** From the records of step 1, set the 500 ft difference beside the 1,000 ft one: if the 500 ft row moves more than its neighbours, the missing 180 m sample is the likely reason. A reading of the log, written up once in this doc. Answers 4.
7. **The archive by lead, on `#wind-errors`.** The page's Open-Meteo section draws the archived 10 m wind by run against KPMV. Add the RRFS as a second model there, fetched by the weekly ceiling data refresh. Depends on Open-Meteo's previous-runs API serving `ncep_rrfs_conus`, which is not checked; check with one request from a runner before building.

## Related, already on file

The NWS side changed on the same day: SCN 26-89 moved the National Blend of Models from the NAM and HiresW to the RRFS and REFS from the 12Z run of 2026-11-03 (docs/nbm-lowest-cloud-base.md). The NBM cloud base on the card, and the NDFD forecasts the ceiling and wind error pages archive, straddle that date. The error pages should be able to split their counts at 2026-11-03 12Z; that is its own piece of work, listed here so the two are read together.

## For the maintainer

1. Given 2026-11-24: steps 3 to 5.
2. Whether step 2 waits two weeks or shows the rows as they come.
3. Step 4 opens an issue, as planned; say if a line on Data health is wanted too.
4. Whether to split the error pages at 2026-11-03.
5. When the default does switch: keep naming no model, as Mark Schulze's tool does, so the two stay comparable; or name one.
