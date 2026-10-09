# Surface wind: four forecasts against the METAR

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
and records whether the numbers were identical (`sameAsHrrr`).

The comparison with the METAR takes each distinct report once, from the first
run that saw it, and reads each forecast at the report's observation time by
the rule in the table. `current` has one valid time per run, so a report is
paired with the first run whose `current` interval contains its observation
time, when any does. Directions are compared only when the METAR gave one (not
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
| Open-Meteo hourly | at each new HRRR run, about hourly | the 15-minute domain's run (see below) | 25 min (2 to 63) since that run was available |
| Open-Meteo `minutely_15` | the same runs as the hourly, plus a new step each quarter hour | same | same |
| Open-Meteo `current` | each quarter hour, and at each run | same | 7.8 min (1.8 to 14.6) since the start of its quarter hour |

**Measured, Open-Meteo:**

- The default ("best match") model at the DZ is HRRR. The same request with
  `models=ncep_hrrr_conus` returned identical numbers at 18 of 37 runs. Of
  the other 19, 16 differed by at most 1° of direction with every speed and
  gust the same, 2 (01:16Z and 01:25Z, while a new run was arriving) by up
  to 10°, 1 kt and 2.4 kt of gust, and 1 (00:58Z) was logged before the size
  of the gap was recorded. A probe at about 00:40Z with `gfs_seamless` gave
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
- **The hourly gust is not the hour's maximum here.** Open-Meteo's hourly
  table gives `wind_gusts_10m` as "Gusts at 10 meters above ground as a
  maximum of the preceding hour" (read 2026-10-09). Of 93 hour steps whose
  four 15-minute steps were all in the same response, the hourly gust
  equalled the largest of the four at 67 and was below it at 26 (by up to
  2.5 kt: 10.3 against 12.8 for 00Z in the 01:22Z run), never above. It
  always equalled the 15-minute step at the hour, whose gust the 15-minute
  table gives as the "Preceding 15 min max". So at this DZ the hourly gust
  covers the last quarter of the hour, not the hour. The app does not
  request the hourly gust; the 10-day outlook's daily gust maximum is built
  by Open-Meteo from its hourly values and was not checked.
- **`current` is the `minutely_15` step at the start of the quarter hour in
  progress**, at 37 of 37 runs: at 00:43Z it was the 00:30Z step. So it is
  between 0 and 15 minutes old by construction, and read at a moment it is
  never the nearer step when that is the next one.
- New 15-minute runs became available 78 to 90 minutes after their
  initialisation time (23Z at 00:30:04Z, 00Z at 01:17:49Z, 01Z at 02:26:47Z),
  and the hourly domain's 0Z run 112 minutes after. So whatever the app
  fetches is a forecast from a run initialised one and a half to two and a
  half hours earlier.
- **Open-Meteo's servers do not all answer alike.** Every direction in a
  response, in every series, alternated by exactly 1° from one request to the
  next with nothing else changing: 124 of the 172 changes counted in the
  `minutely_15` series were that, and 121 went back to a value already
  served. For about twelve minutes after the 00Z run arrived, requests got
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
  while the gridpoint at the same moment still served 00:35:28Z.
- The gridpoint is served through caches. Its `Cache-Control` `max-age` ran
  down between runs (3600, 3420, 3240, 3060 s) and the `Expires` header
  jumped between several values at once (01:43:46Z, 01:55:47Z), so successive
  requests reached copies made at different times, each kept up to an hour.
  The copy that answered at 02:44:33Z was to expire at 03:32:33Z. The
  hourly product's `generatedAt` alternated between values in the same way.
- `Last-Modified` was the same instant as `updateTime`.

**Inferred, not measured:** a browser following that `max-age` could keep a
gridpoint up to an hour after an update reaches NWS's origin, on top of the
edge caches' hour. The app's `fetchJson` does not ask the browser to bypass
its cache. Nothing here was run in a browser (see CLAUDE.md on what the
sandbox cannot check).

## Against the METAR

Each report once, from the first run that saw it; forecast minus observed.
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

The structural findings above (one HRRR dataset behind all three Open-Meteo
forms, hourly runs 78 to 90 minutes after initialisation, server
disagreement after a run arrives, the hourly gust being a 15-minute one, the
NWS caches) were each seen more than once and would likely hold, though each
is from one evening at one point. Which forecast is nearer KPMV's wind would need:

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

## Status

Measurement only. Nothing on the dashboard changed. The open question is
in `docs/open-questions.md`, "Surface wind: which forecast source".
