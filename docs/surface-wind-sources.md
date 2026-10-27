# Surface wind: four forecasts against the METAR

> Open-Meteo figures in this document are weather data by
> [Open-Meteo.com](https://open-meteo.com/), under
> [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), reworked as
> the document describes (set against other sources, counted,
> differenced or interpolated). See [open-meteo-terms.md](open-meteo-terms.md).

Asked 2026-10-09: Open-Meteo serves a 15-minute (`minutely_15`) and a
`current` 10 m wind beside the hourly one this app already requests. Is either
updated more often than what the app reads now, nearer what KPMV measures, or
better or worse for some other reason? This page says what was measured, what
was read, and what is only inferred, with dates. It changes nothing on the
dashboard: the Surface wind card and the student wind-limit flag still read
the METAR, and this work added no threshold, colour or verdict.

## What was compared

One run fetches all five at once (`scripts/surfaceWindCompare.live.ts`) and
prints one `@@parity` line of kind `surfacewind`; the arithmetic over many
runs is `src/domain/surfaceWindSources.ts`, pure and tested, and
`npx tsx scripts/surfaceWindSummary.ts <log>` prints it.

The script is opt-in and in no workflow. `vitest.live.config.ts` takes every
`scripts/*.live.ts`, and the daily sky-parity job runs that config with no
path, so the script is skipped unless `SURFACE_WIND_SAMPLE=1` is set (shown
on 2026-10-09: the whole live config without it ran 5 files and skipped this
one). One sample, from the sandbox:

```
SURFACE_WIND_SAMPLE=1 NODE_USE_ENV_PROXY=1 \
  NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
  npx vitest run --config vitest.live.config.ts scripts/surfaceWindCompare.live.ts
```

Every fetch in a run, retries and body included, ends within a 40-second
budget, so a source that hangs is logged as that source's error and the run
still prints its line inside vitest's 60-second limit (shown with a local
server that never answered in place of Open-Meteo: the run ended in 39 s
with `omError` set; the version before the budget timed out at 60 s and
printed nothing).

| name | what | read at | how a moment is read |
|---|---|---|---|
| `metar` | KPMV's latest report, IEM and api.weather.gov, the newer one (`chooseObservation`, as the dashboard picks it) | KPMV, about 11.5 mi ENE of the DZ | the report as fetched |
| `nws` | the NWS gridpoint forecast, the app's `fetchHourly` path | the DZ's grid cell (OAX 77,42) | the clock hour containing the moment |
| `omHourly` | Open-Meteo hourly `wind_speed_10m`, `wind_direction_10m`, `wind_gusts_10m` (the app's winds request asks for the first two) | the DZ (Open-Meteo answers from 40.8628, -96.1168, model ground 355 m) | the nearest hour, as `normalizeOpenMeteo` picks it |
| `om15` | Open-Meteo `minutely_15`, the same three variables | the DZ | the nearest 15-minute step |
| `omCurrent` | Open-Meteo `current`, the same three variables | the DZ | as served |

Every record also keeps the times each source gives about itself: the METAR's
observation time (and each feed's); the gridpoint's `updateTime`, its
`Last-Modified`, `Expires` and `max-age`, and the `/forecast/hourly` product's
`updateTime` and `generatedAt`; Open-Meteo's `generationtime_ms` and any
`Last-Modified` or `Cache-Control` header; and, from Open-Meteo's model
metadata API, the last run's initialisation and availability time for HRRR's
hourly (`ncep_hrrr_conus`) and 15-minute (`ncep_hrrr_conus_15min`) output.
Each run also asks Open-Meteo the same question with `models=ncep_hrrr_conus`
and records whether the numbers were identical (`sameAsHrrr`), and if not,
the largest gap and whether the two carried different valid times
(`shapeDiffers`, logged from after this sample).

The comparison with the METAR takes each distinct report once and, for each
source separately, reads the first run that had the report as its newest and
returned that source's forecast; the forecast is read at the report's
observation time by the rule in the table. So a run whose Open-Meteo request
failed does not drop the report for Open-Meteo when a later run in the same
20 minutes succeeded, and does not change which run NWS is read from. In this
sample every source had all seven reports. `current` has one valid time per
run, so a report is paired with the first run whose `current` interval
contains its observation time, when any does. Directions are compared only when the METAR gave one (not
calm, not VRB); gusts only when both sides had one. The forecasts are for the
DZ and the METAR is 11.5 mi away, so every difference below includes that
distance.

## The sample

**Measured:** 41 runs from the sandbox, one every three minutes, from
2026-10-09 00:43:45Z to 02:44:33Z (two hours; the evening of 2026-10-08
local). A container restart stopped the loop after the 01:55:47Z run and it
was started again for the 01:59:36Z run, so the longest gap between runs is
3 min 49 s rather than 3 min; no run is missing. The log is
`data/parity/surfacewind-2026-10-09.log`.

Seven KPMV reports fell in the window (00:35Z to 02:35Z, every 20 minutes).
The wind was light and steady from the southeast: 5 to 6 kt observed, no
gust reported, no calm or variable report. Open-Meteo's forecast request
failed at 4 runs and a metadata request at 5, every one a connect timeout
through the sandbox's proxy after three tries; NWS, IEM and the METAR never
failed.

Two hours of one quiet evening is enough to see how each source is built and
how often it changes. It is not enough to say which forecast is nearer the
measured wind: seven reports, all at 5 to 6 kt, cannot separate four sources
that differ by about a knot, and say nothing about a gusty afternoon or a
front, which is when the figure matters.

## What changes, and how often

| source | its value changed | what moves it | age when fetched (median, range) |
|---|---|---|---|
| METAR | at each new report, 20 min apart; the wind group changed at 3 of the 6 new reports | a new report (the 01:55Z one never reached IEM; NWS served it at 02:17Z) | 17.8 min (5.8 to 39.6) after the observation |
| NWS gridpoint | once in two hours at the origin, not at all on the path the app reads | a forecaster or blend update: `updateTime` 00:35:28Z until the hourly product showed 02:36:41Z | 68.3 min (8.3 to 129.1) since `updateTime` |
| Open-Meteo hourly | at each new HRRR run, about hourly | the 15-minute domain's run (see below) | inferred: 25.9 min (2.6 to 62.8) since that run was available |
| Open-Meteo `minutely_15` | the same runs as the hourly, plus a new step each quarter hour | same | inferred, same |
| Open-Meteo `current` | each quarter hour, and at each run | same | 7.8 min (1.8 to 14.6) since the start of its quarter hour |

The Open-Meteo hourly and 15-minute ages are inferred, not measured: each
takes the run time minus the availability time the metadata API gave for the
15-minute domain's latest run, and so assumes the forecast came from that
run. The sample itself shows it need not have (servers serving the old run
after the new one was available, below), and the metadata differed between
servers too. Counted only at the 34 runs that returned both a forecast and
that metadata.

How often each value changed between consecutive runs, and the same count
net of one-degree direction flaps on the same valid time (see "Open-Meteo's
servers do not all answer alike" below), which say nothing about the
forecast:

| | "now" value changed (of run pairs) | net of flaps | minutes between net changes, median (range) | a fixed valid time revised, at how many runs | net of flaps |
|---|---|---|---|---|---|
| METAR | 3 of 40 | 3 | 39.4 (15 to 63.8) | | |
| NWS hour | 1 of 40 (the clock hour turning) | 1 | | 0 | 0 |
| Open-Meteo hourly | 20 of 36 | 7 | 3 (3 to 57.8) | 18 | 5 |
| Open-Meteo `minutely_15` | 18 of 36 | 12 | 9 (3 to 15.8) | 18 | 5 |
| Open-Meteo `current` | 19 of 36 | 12 | 12 (3 to 15.8) | 11 | 4 |

Net of flaps, the forecasts for a fixed valid time changed at five runs:
four within twelve minutes as the 00Z run arrived (01:16Z, 01:22Z, 01:25Z,
01:28Z: new, new, old, new) and one at 02:29Z for the 01Z run. The "now"
value otherwise changed as the clock moved it to another step: every quarter
hour for `minutely_15` and `current`, every hour (at half past) for the
hourly value. The changes in the 15-minute series, every valid time over
every run pair, split into three kinds that sum to the total: of 172, 124
one-degree flaps, 19 returns to a value an earlier run had served, and 29
values not served before.

**Measured, Open-Meteo:**

- The default ("best match") model at the DZ is HRRR. The same request with
  `models=ncep_hrrr_conus` returned identical numbers at 18 of 37 runs. Of
  the other 19, 16 differed by at most 1° of direction with every speed and
  gust the same, 2 (01:16Z and 01:25Z, while a new run was arriving) by up
  to 10°, 1 kt and 2.4 kt of gust, and 1 (00:58Z) was logged before the size
  of the gap was recorded. Whether the two carried the same valid times was
  not logged in this sample; none of the 18 recorded gaps was 0/0/0, the
  mark a difference of shape alone would have left. A probe at about 00:40Z with `gfs_seamless` gave
  the same numbers as the default; `ncep_nbm_conus` and `gfs_global` did
  not.
- **The hourly 10 m wind is the 15-minute series read on the hour.** At 37 of
  37 runs every hourly value equalled the `minutely_15` step at the same time,
  direction, speed and gust. And the hourly values changed when a new run of
  the 15-minute domain (`ncep_hrrr_conus_15min`) arrived, not when the hourly
  domain's did: the hourly domain ran an hour behind (its 00Z run was
  available at 01:52:24Z, the 15-minute domain's at 01:17:49Z), yet the
  hourly values took the 00Z run at 01:16 to 01:22Z, and the 01Z run at
  02:29Z with the hourly domain still on 00Z.
- **The hourly gust was not always the hour's maximum here.** Open-Meteo's
  hourly table gives `wind_gusts_10m` as "Gusts at 10 meters above ground as
  a maximum of the preceding hour" (read 2026-10-09). Four distinct valid
  hours (00Z to 03Z) had all four of their 15-minute steps in some response;
  read from the latest such run, the hourly gust equalled the largest of the
  four at three and was below it at one: 00Z, 10.3 kt against 12.8 kt at
  23:15Z, in the 01:28Z run. In every response (37 of 37) it equalled the
  15-minute step at the hour, whose gust the 15-minute table gives as the
  "Preceding 15 min max". So at this DZ the hourly gust behaved as the last
  quarter hour's maximum, not the hour's; one hour of four shows the
  difference, and a longer sample would say how often it matters. The app
  does not request the hourly gust; the 10-day outlook's daily gust maximum
  is built by Open-Meteo from its hourly values and was not checked.
- **`current` is the `minutely_15` step at the start of the quarter hour in
  progress**, at 37 of 37 runs: at 00:43Z it was the 00:30Z step. So it is
  between 0 and 15 minutes old by construction, and read at a moment it is
  never the nearer step when that is the next one.
- New 15-minute runs became available 78 to 90 minutes after their
  initialisation time (23Z at 00:30:04Z, 00Z at 01:17:49Z, 01Z at 02:26:47Z),
  and the hourly domain's 0Z run 112 minutes after. So whatever the app
  fetches is a forecast from a run initialised one and a half to two and a
  half hours earlier.
- **Open-Meteo's servers do not all answer alike.** Now and then a response
  came back with every direction one degree from the last response's and
  every speed and gust the same, and the next one would go back: at 15 of 36
  pairs of successive runs that returned a forecast (three span a run whose
  request failed) the 15-minute series moved that way, with no new
  run in the metadata. The two requests of one run (the default model and
  `models=ncep_hrrr_conus`, a moment apart) differed by exactly that at 16 of
  37 runs. For about twelve minutes after the 00Z run arrived, requests got
  the new run or the old one in turn: at 01:16Z the new speeds and directions
  with the old gusts, at 01:22Z the new run, at 01:25Z the old run again, at
  01:28Z the new one. The 01Z run arrived at 02:29Z with no such return seen.
  The metadata API differs between servers too: two reads five minutes apart
  gave the hourly domain's 22Z run as available at 23:45:31Z and at
  23:51:42Z. Open-Meteo's model-updates page says this happens: it runs
  "multiple redundant API servers", "there may be slight differences between
  them while the data is being copied", and "To ensure all API calls use the
  most recent data, please wait 10 minutes after the availability time"
  (read 2026-10-09).
- The response carries no run time. `generationtime_ms` is how long the
  server took (0.1 to 61 ms here), and the response had no `Last-Modified` or
  `Cache-Control` header. The run is known only from the metadata API.

**Measured, NWS:**

- The gridpoint's `updateTime` was 00:35:28Z at every one of the 41 runs, and
  its wind values never changed. The `/forecast/hourly` product for the same
  grid showed a newer `updateTime`, 02:36:41Z, at the last run (02:44:33Z),
  while the gridpoint at the same moment still served 00:35:28Z. A single run
  at 03:03Z, after the sample and not in the log, got 00:35:28Z from both
  again.
- The gridpoint is served through caches. Its `Cache-Control` `max-age` ran
  down between runs (3600, 3420, 3240, 3060 s) and the `Expires` header
  jumped between several values at once (01:43:46Z, 01:55:47Z), so successive
  requests reached copies made at different times, each kept up to an hour.
  The copy that answered at 02:44:33Z was to expire at 03:32:33Z. The
  hourly product's `generatedAt` alternated between values in the same way.
- `Last-Modified` was the same instant as `updateTime`.

**Inferred here, measured since:** a browser following that `max-age`
could keep a gridpoint after a newer one reaches the edges. Measured on
2026-10-23 (docs/nws-gridpoint-age.md): Chromium answered the app's
refresh from its disk cache, and a replay of this sampler's 13-day log put
the dashboard behind the newest known forecast at 10.9% of refreshes. The
gridpoint is now fetched with `cache: 'no-cache'`, keeping the newer copy,
which the replay puts at 6.0%.

## Against the METAR

Each report once, per source from the first run that had it as the newest
report and returned that source's forecast (all seven, for every source);
forecast minus observed.
Seven reports, so the 90th percentile is the largest gap but one.

| | NWS hour | OM hourly | OM 15-min | OM current |
|---|---|---|---|---|
| speed, median abs gap | 1 kt | 1.1 kt | 0.9 kt | 0.9 kt |
| speed, largest | 1 kt | 1.9 kt | 1.6 kt | 1.6 kt |
| speed, signed mean | +0.9 kt | +1.2 kt | +0.9 kt | +0.8 kt |
| direction, median abs gap | 10° | 6° | 7° | 7° |
| direction, largest | 40° | 31° | 32° | 32° |
| direction, signed mean | +16° | -1° | +2° | +3° |
| gust | METAR reported none; every forecast served one (10 to 15 kt) | same | same | same |

| report | METAR | NWS hour | OM hourly (step used) | OM 15-min | OM current |
|---|---|---|---|---|---|
| 00:35Z | 12005KT | 140°/6 G10 | 114°/5.7 G10.3 (01Z) | 130°/5.1 G11.9 | 130°/5.1 G11.9 |
| 00:55Z | 12005KT | 140°/6 G10 | 115°/5.7 G10.3 (01Z) | 115°/5.7 G10.3 | 122°/5.2 G10.7 |
| 01:15Z | 13005KT | 140°/6 G12 | 117°/6.1 G10.7 (01Z) | 121°/6.3 G12.1 | 122°/5.9 G10.7 |
| 01:35Z | 13005KT | 140°/6 G12 | 129°/6.6 G14.8 (02Z) | 125°/6.6 G13.4 | 125°/6.6 G13.4 |
| 01:55Z | 13005KT | 140°/6 G12 | 128°/6.6 G14.8 (02Z) | 128°/6.6 G14.8 | 127°/6.5 G14 |
| 02:15Z | 14006KT | 140°/6 G12 | 129°/6.6 G14.8 (02Z) | 133°/6.3 G14.8 | 133°/6.3 G14.8 |
| 02:35Z | 10005KT | 140°/6 G12 | 131°/6.9 G15.2 (03Z) | 132°/5.9 G14.6 | 132°/5.9 G14.6 |

What it shows, and no more: on a light, steady evening all four sat within
about 2 kt of the measured wind and, but for the last report, within about
20° of its direction. The NWS hour stayed at 140° and 6 kt for two hours
while the measured direction moved from 120° to 140° and back to 100°; the
Open-Meteo series moved more, and their direction gap was smaller than the
NWS hour's at six of seven reports for the 15-minute series and five of
seven for the hourly. Seven reports at 5 kt cannot show that one is nearer
in general. The three Open-Meteo columns are one dataset, so where
they differ it is only in which step is read: the hourly reads up to 30
minutes away, the 15-minute series at most 7.5 minutes, `current` up to 15
minutes behind.

Every forecast served a gust of 10 to 15 kt for every report and the METAR
reported none. That is not a disagreement in itself (a METAR carries a gust
group only under its coding rules), but a reader setting a forecast gust
beside the observed wind would see a figure the station did not report.

## Other considerations

- **Browser access (CORS).** Open-Meteo answered with
  `access-control-allow-origin: *` (checked 2026-10-09), and so did the NWS
  gridpoint; IEM's is in `src/domain/iem.ts`. All three are readable from the
  page.
- **Rate limits.** Open-Meteo's terms for the free, non-commercial API:
  "Less than 10'000 API calls per day, 5'000 per hour and 600 per minute"
  (open-meteo.com/en/terms, read 2026-10-09). Its model-updates page: "API
  calls to the metadata API are not counted toward daily or monthly request
  limits". Asking for `minutely_15` or `current` in the request the app
  already makes would add variables, not requests; Open-Meteo's terms are
  per call, but whether a heavier call counts as more than one was not read.
- **Provenance.** Open-Meteo's docs (open-meteo.com/en/docs, read
  2026-10-09): `minutely_15` "is based on NOAA HRRR model for North America
  and DWD ICON-D2 and Météo-France AROME model for Central Europe. If
  15-minutely data is requested for other regions data is interpolated from
  1-hourly to 15-minutely"; its table marks `wind_speed_10m` and
  `wind_direction_10m` (both "Instant") in its HRRR column (and AROME's),
  and `wind_gusts_10m` ("Preceding 15 min max") in HRRR's only. On `current`: "Current
  conditions are based on 15-minutely weather model data." So at this DZ the
  15-minute wind is native HRRR sub-hourly output, not an interpolation, and
  the metadata says so (`temporal_resolution_seconds: 900` for
  `ncep_hrrr_conus_15min`). The docs also say the default timeseries "always
  reflects the latest available initialisation" and is stitched from several
  models; at the DZ, for the hours sampled, that was HRRR. Beyond HRRR's
  horizon (not sampled) the default would come from another model.
- **Gusts.** Open-Meteo serves a 10 m gust in all three forms (in
  `minutely_15`, "Preceding 15 min max"); the app's winds request does not
  ask for it today. The NWS gridpoint serves `windGust` hourly. The METAR
  reports one only when its rules call for it.
- **Grid and place.** Open-Meteo answers from 40.8628, -96.1168 (model ground
  355 m), about 1.1 km from the landing area; NWS from its grid cell OAX
  77,42. KPMV is 11.5 mi ENE. A forecast for the DZ set against KPMV's
  report differs by that distance as well as by forecast error.
- **NWS update cadence.** One update in two hours, and at 02:44:33Z, eight
  minutes after the hourly product's newer `updateTime`, the gridpoint still
  answered with the older grid. The app shows NWS hours in the hourly chart, not in the
  surface wind card or the flag.

## What a longer sample needs

Some structural findings above were seen at every run or every arrival (one
HRRR dataset behind all three Open-Meteo forms, 37 of 37; new runs 78 to 90
minutes after initialisation, three of three; the one-degree flaps; the NWS
caches) and would likely hold. Others rest on one case: old and new runs
served in turn after an arrival (the 00Z run; the 01Z run showed none), and
the hourly gust below the hour's 15-minute maximum (one hour of four). All
are from one evening at one point. Which forecast is nearer KPMV's wind would need:

- many more reports: the comparison gains one pair per KPMV report, three an
  hour at best, so a week of continuous sampling gives about 500;
- the conditions that matter: afternoons with mixing, gusty days with a G
  group in the METAR, frontal passages, calm nights;
- runs spread through the hour, so the run-arrival window (about 15 to 30
  minutes past) is sampled as often as the rest.

A loop every five minutes is enough for the reports (one in four runs sees a
new one) and keeps Open-Meteo at two forecast calls a run, about 576 a day.
Open-Meteo also keeps past forecasts (its docs point to a Historical Forecast
API and a Single Runs API for "the full archive of past forecast runs as
issued"), and IEM keeps KPMV's past reports; pairing those could cover months
without a live sampler. Neither was tried here.

## The longer sample, running

`.github/workflows/surface-wind-sample.yml` runs the script every five
minutes through `scripts/surfaceWindLoop.sh`, in five-hour batches started
every five hours and queued end to end, so the samples cover the whole day
and drift through every hour of it, from the workflow's merge to
2026-10-30T02:00Z (three weeks, about 1,000 METAR pairs). Its records are
uploaded as `surfacewind-<run id>-<attempt>-<hour>` artifacts and kept 30
days, apart from the `#parity` summary's `parity-*` ones. Once the window
ends, archive them under `data/parity/`, summarise them with
`scripts/surfaceWindSummary.ts`, write the result up here, and delete the
workflow.

**It has not covered the whole day.** Read from the Actions API on
2026-10-16: 27 runs, all successful, each 4.6 to 5.8 hours long. But its
own five-hourly starts were throttled too: from its first run (2026-10-09
03:43Z) to 2026-10-14 05:20Z the runs covered 57% of the time, with gaps
of up to 9 hours between one run's end and the next start; from then to
2026-10-16 14:40Z, 96%, gaps of 28 minutes or less. The workflow did not
change in between, so the cause is GitHub's scheduling. The summary should
count samples by hour of day before ranking sources, so the uncovered
hours of the first five days do not weigh as if they were sampled.

## A preview, 2026-10-21

Taken partway through, to see what the sample holds; the full reading is
still due when the window ends on 2026-10-30. All 258 `surfacewind-*`
artifacts to 2026-10-21 22:55Z (3,096 runs from 2026-10-09 03:43Z),
downloaded from the Actions API and run through
`scripts/surfaceWindSummary.ts`. They are kept, one line per run in time
order, in `data/parity/surfacewind-2026-10-09-to-2026-10-21.jsonl.gz`
(242 KB), which gives the same summary:

    npx tsx scripts/surfaceWindSummary.ts <(zcat data/parity/surfacewind-2026-10-09-to-2026-10-21.jsonl.gz)

The name keeps it out of the parity summary's `*logs-*` archives. The
wrap-up can add the runs after 2026-10-21 22:55Z beside it.

- **The sample.** 742 distinct KPMV reports over 13 days, 25 to 38 in each
  local hour, so the early gaps in coverage (above) left no hour thin, and
  weighting by hour would move little. Speeds: 11 calm, 184 at 1 to 5 kt,
  358 at 6 to 10, 150 at 11 to 15, 39 at 16 or more; 229 reports with a
  gust.
- **Speed, forecast minus measured.** Every source's median miss is 2 kt.
  The NWS gridpoint runs low (signed mean −0.75 kt, p90 4) and Open-Meteo
  high (+0.8 hourly, +0.76 at 15 minutes and current; p90 4.3 to 4.5).
- **Direction.** Median miss 10° (NWS) to 12° (Open-Meteo), p90 about 30°.
- **Gusts, where KPMV reported one** (229). Both sources' median miss is
  about 4 kt, but Open-Meteo's run higher: signed mean +4.4 kt and p90 10.4,
  against NWS's +2.1 and 7. Both also give a gust in the 513 reports with
  none, which says nothing either way: the METAR reports a gust only when
  there is one to report.
- **What the cadence rows confirm.** Open-Meteo's `current` is the
  15-minute step at its time, and its hourly value the 15-minute step on
  the hour, in all 3,073 runs. Its hourly gust is never above the preceding
  hour's largest 15-minute gust and was below it at 171 of 284 hours (by up
  to 6.8 kt). That is the earlier finding, now on 284 hours. The default
  model was HRRR in all 3,068 comparable runs.
- **Freshness.** The KPMV report was a median 14.7 minutes old when
  fetched, the NWS gridpoint's update time 66 minutes.

So far, then, none of the four is clearly the nearer forecast of the
measured speed. NWS runs a little low, Open-Meteo a little high, and
Open-Meteo overshoots gusts more. Counts and spreads only, never a grade.
Nothing on the dashboard changed.

## The spread, drawn (2026-10-23)

![Histograms of forecast minus reported wind speed, gust and direction for Open-Meteo's three forms and the NWS hour](img/surface-wind-errors-2026-10-21.svg)

The preview's pairs as histograms: each KPMV report once, against each
forecast as it stood while the report was the newest (`pairsVsMetar`,
which the summary above counts by). The same histograms are on the
dashboard's `#wind-errors` page, "How far the wind forecasts were from
KPMV", beside the kept NWS forecasts (docs/kept-forecasts-vs-kpmv.md).

- **Speed.** Open-Meteo's three forms have a broad, flat top from −1 to
  +2 kt (about 90 to 105 reports in each of those bins), so the median and
  mean of +0.8 kt are the whole hump leaning right, not a peak there. The
  NWS hour on the same reports leans the other way: its tallest bins are
  −2 and 0 kt, median −1 kt. Both are spread about as wide (median miss
  2 kt each, p90 4 to 4.5 kt); neither is tighter.
- **Gust, where KPMV reported one** (229 reports, 224 for `current`).
  Open-Meteo sits right of zero in 186 to 191 of them, and its tail runs
  out to +17 kt; the NWS hour sits right in 164, closer in (median +3 kt
  to Open-Meteo's +3.7 to +4) but with a tail of 47 below, down to −13 kt.
- **Direction.** All four peak at a small clockwise offset (median +6° to
  +7° for Open-Meteo, +10° for NWS, which serves whole tens), with a tail
  clockwise to +50° and 1 to 4 reports past 100°.
- **The three Open-Meteo forms look alike**, as the cadence rows say they
  should: `current` is the 15-minute step at its time, and the hourly value
  the 15-minute step on the hour.

The figure and the counts above are the preview's, to 2026-10-21, kept as
they were; the `#wind-errors` page is the current view. The command that
rebuilds the page's file and draws new dated figures is under
"Open-Meteo's archive" below.

The sample runs to 2026-10-30. Once its whole window is archived under
`data/parity/surfacewind-*`, the weekly ceiling data refresh rebuilds the
page from it; the wrap-up can rebuild it by hand at once, and draw the
whole window's figure for its reading here.

## Open-Meteo's archive (2026-10-23)

![Histograms of Open-Meteo's archived 10 m wind minus KPMV's reports, start of run and a day earlier](img/om-archive-wind-errors-2026-10-22.svg)

The sample above ends on 2026-10-30, and covers twelve days. Open-Meteo
keeps its own past forecasts, so the `#wind-errors` page also sets those
against KPMV, back to 2026-04-01, and the weekly ceiling data refresh
fetches each week's (`.github/workflows/ceiling-data-refresh.yml`).

- **What was fetched.** `scripts/cloudCoverFetch.py` with `PARTS=omwind`:
  `wind_speed_10m`, `wind_gusts_10m` and `wind_direction_10m` in knots
  (`wind_speed_unit=kn`, as the dashboard asks), default model, at the
  drop zone, from the same two archives the cloud-cover comparison read
  (docs/cloud-cover-sources.md): the Historical Forecast API, the first
  hours of each model run stitched together ("start of run"), and the
  Previous Runs API's `_previous_day1`, the value predicted 24 hours
  before ("a day earlier"). Both resolved to the same cell the dashboard's
  live request does (40.8628, −96.1168), and served every hour from
  2026-04-01 00Z to 2026-10-22 23Z, 4,920 each, with no nulls. Kept in
  `data/parity/om-wind-2026-04-01-to-2026-10-22.jsonl.gz`. The page and
  the figure give dates in the drop zone's time, so the section starts on
  Mar 31 there: its first paired hour, 01Z on April 1, is the evening
  before in Central time. From the sandbox, one of the day's requests to
  the archive came back with a body that was not JSON and the script
  stopped; asked again a minute later it answered. The weekly run fails
  its wind side on such an answer and starts from the same day the next
  week.
- **The weekly run.** A branch trial of the refresh on 2026-10-23 (run
  39982915380) rebuilt the page's file with this section (4,791 hours a
  row, one more than above: the week's reports reached 23Z on 10-22) and
  passed its tests. Its fetch step was skipped, the archive being current
  to the last whole day, so the step's first run on a runner is the
  refresh of 2026-10-26. That run (40340551073, started by GitHub at
  14:32Z, seven hours past the cron) fetched 96 hours for 10-22 to 10-25
  (192 records, both runs), committed them as
  `data/parity/om-wind-2026-10-22-to-2026-10-25.jsonl.gz`, and rebuilt
  this section to 2026-10-25: the start-of-run row went from
  4790 to 4862 hours. docs/open-questions.md, "Done: the #wind-errors
  page refreshes weekly", has the whole run.
- **How it was paired.** As the kept NWS forecasts are
  (docs/kept-forecasts-vs-kpmv.md): KPMV's report within 10 minutes of
  each hour, the nearest one, from every archive of KPMV's reports under
  `data/parity/` (14,363 from 2026-04-01; the drop-zone cloud-cover
  archive holds the first six months); the forecast rounded to whole
  knots as a METAR reports (`windDiffs`), the gust only where KPMV
  reported one, direction only where the report gave one. 4,790 hours
  paired; 128 had no report near the hour. `omArchiveSection`,
  `src/domain/windErrors.ts`.

What it showed, 2026-04-01 to 2026-10-22 (forecast minus reported):

| | start of run | a day earlier |
|---|---|---|
| speed, median / mean | +1 / +0.6 kt | +1 / +1.1 kt |
| speed, above / below | 2,421 / 1,583 of 4,790 | 2,685 / 1,507 |
| speed, median miss / p90 | 2 / 4 kt | 2 / 6 kt |
| gust, median / mean (965 h) | +2 / +2.5 kt | +2 / +1.5 kt |
| gust, above / below | 614 / 273 | 562 / 343 |
| direction, median / mean (4,124 h) | +6° / +4.6° | +10° / +8.4° |

- **Speed** leans a knot high at both leads, and the day-earlier forecast
  is spread wider (p90 miss 6 kt against 4). By month, the start-of-run
  mean ran +0.2 to +0.6 kt from May to October and +1.7 in April; the
  day-earlier +0.8 to +1.6. By time of day, start of run was centred at
  night (01Z to 12Z, mean +0.1 kt) and a knot high by day (+1.0).
- **Gust**, where KPMV reported one, is high in 64% of those hours at
  the start of run and 58% a day earlier. By month the start-of-run mean ran from +0.7 kt
  (July, 59 hours) to +3.7 (April, 280). At night, when KPMV reported a
  gust in only 301 of 2,392 hours, it was +4.5; by day +1.6.
- **Direction** sits clockwise of the report, more so a day ahead.
- **Tails.** The six months hold the summer's storms. A few hours fall
  past the shared axes: 20 and 88 speeds, 9 and 16 gusts (a reported gust
  36 kt over the start-of-run forecast at the widest), 82 and 236
  directions past 100°. The page counts them as beyond the axis.

**Not the same as the sample, on the same days.** From 2026-10-09 03Z to
10-21 23Z, the archive's start of run paired 307 hours with a speed mean
of 0.0 kt (unrounded, also 0.0), where the sample's Open-Meteo hourly
read +0.8 kt over 742 reports. The pairs differ: the sample sets each
report, not only the one at the hour, against the forecast Open-Meteo's
live API returned while it was the newest, from whichever run was newest
then; the archive sets the report at the hour against the first hours of
a run made for that hour. Which of those makes the difference was not worked out. The
day-earlier row read +0.7 kt over the same days, and the gust +4 kt on
both rows, as in the sample.

Counts and spreads only. Nothing on the dashboard reads them. Rebuilt by
the weekly refresh; by hand:

```
PARTS=omwind python3 scripts/cloudCoverFetch.py <start> <end> data/parity/om-wind-<start>-to-<end>.jsonl.gz
npx tsx scripts/windErrorsData.ts --kept <dir>/data \
  --reports data/parity/kept-forecasts-kpmv-reports-*.jsonl.gz data/parity/metar-*.jsonl.gz \
            data/parity/cloud-cover-2*.jsonl.gz \
  --om data/parity/om-wind-*.jsonl.gz \
  --ndfd data/parity/ndfd-wgust-*.jsonl.gz data/parity/ndfd-wind-*.jsonl.gz \
  --sample data/parity/surfacewind-*.jsonl.gz \
  --out public/wind-errors/summary.json --check-against public/wind-errors/summary.json \
  --figures docs/img
```

## Status

Measurement only: nothing the dashboard's cards show changed. Since
2026-10-23 the archived records also feed the `#wind-errors` page, which
draws the histograms above. Since 2026-10-27 the bars are filled by
side (the maintainer's request): right of zero, the forecast above the
report, in the accent; left of it in a second neutral hue; the zero bar,
counted on neither side, in grey (`barSide`, `src/domain/windErrors.ts`,
shared by the page and the figures). Neither hue is a warning colour,
since neither side is the worse one. The dated figures drawn before that
day are one colour and are not redrawn. The open question is
in `docs/open-questions.md`, "Surface wind: which forecast source".
