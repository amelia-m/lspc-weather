# The NWS gust forecast over six months, from NOAA's archive

Asked 2026-10-23 by the maintainer, for the open question "A note on the
card about the forecast gust?" (docs/open-questions.md). The kept forecasts
had the NWS gust above KPMV's reported gust in 45 of 53 gusting hours, by
an amount that varied from day to day (docs/kept-forecasts-vs-kpmv.md,
"Gust, closer"), and the maintainer's answer was that a note "depends how
consistent the difference is". Fifty-three hours over a few windy October
days could not say. NOAA's NDFD archive holds the same forecast back to
April, so this sets six months of it against KPMV.

## What was read

- **The forecast:** NOAA's NDFD wind gust grids, CONUS 2.5 km, three-day
  (WMO header `YWUZ98`, `noaa-ndfd-pds.s3.amazonaws.com/wmo/wgust/`), at
  the grid point nearest the drop zone (0.87 km away, the point the sky,
  ceiling and API checks used). The archive's gust matched the API's
  `windGust`, which the dashboard reads, at 42 of 42 hours on 2026-10-13
  (docs/open-questions.md, "Forecasts kept for later"). Four issuances a
  day, the last file in each of 00, 06, 12 and 18Z, as for the sky cover
  and ceiling: 819 issuances from 2026-04-01 00:47Z to 2026-10-22 18:47Z.
  One was missing from the archive (2026-09-05 18Z) and one was cut short
  in it: `YWUZ98_KWBN_202609280047` ends inside its 48th message every
  time it is read. Its first 47 hours were kept. The fetch script now
  keeps the readable part of such a file instead of stopping, prints a
  `::warning::` line and writes an `ndfd-truncated` record into the
  archive, which the readers skip.
  Fetched 2026-10-23 with `PARTS=wgust python3 scripts/cloudCoverFetch.py`,
  a month at a time from the sandbox (about 6 GB and a minute and a half a
  month); 36,857 records in
  `data/parity/ndfd-wgust-2026-04-01-to-2026-10-22.jsonl.gz`.
- **The wind speed and direction**, added the same evening (`PARTS=wspd,wdir`;
  headers `YCUZ98`, `wmo/wspd/`, and `YBUZ98`, `wmo/wdir/`; about 57 and
  33 MB a file, about four minutes a month from the sandbox): the same 819
  issuances, 36,857 speed and 36,858 direction records in
  `data/parity/ndfd-wind-2026-04-01-to-2026-10-22.jsonl.gz`. The API's
  `windSpeed` and `windDirection` matched the archive at 42 of 42 hours
  on 2026-10-13 too. One more file was cut short in the archive:
  `YCUZ98_KWBN_202610070647` (speed, 2026-10-07 06:47Z), 45 hours kept
  and marked. A direction file is sometimes stamped a minute before its
  speed file (00:46Z against 00:47Z), so each element is picked on its
  own, as the kept reading picks them.
- **The reports:** KPMV's, 14,363 from 2026-04-01 to 2026-10-22, from the
  archives already kept (the drop-zone cloud-cover archive to 10-09, the
  weekly refresh's `metar-*`, and the kept-forecast window's).
- **Paired** as the kept forecasts are (`src/domain/ndfdGust.ts`): for each
  row of `NWS_ISSUANCES`, the newest issuance at least 0, 6 or 24 hours
  before the hour, chosen by time; the report within 10 minutes of the
  hour; the forecast gust in whole knots (`windDiffs`). Where KPMV
  reported a gust, the forecast's is set against it; where it reported
  none, against the reported steady wind. Hours past the reach of the
  issuances fetched are left out (`pastReach`). The lead here is that of
  four files a day, 0.9 to 12.2 hours at the latest issuance; the
  dashboard reads an API that updates about hourly.

`npx tsx scripts/nwsGustArchive.ts --ndfd data/parity/ndfd-wgust-*.jsonl.gz data/parity/ndfd-wind-*.jsonl.gz --reports <the report archives>`
prints it all, `--from`/`--to` for a window.

## First, the archive against the kept reading

Over the kept forecasts' own window (2026-10-13 16Z to 10-22 22Z), the
archive gives the same picture: at the latest issuance, KPMV reported a
gust in 53 of 223 hours, and the forecast's was above it in 47, the same
in 3 and below in 3, by +3.7 kt on average (the kept reading: 45, 5 and
3, +3.45 kt). So the six months below are the same forecast read the same
way.

## Six months, 2026-04-01 to 2026-10-22

| | latest issuance | 6 h or more ahead | 24 h or more ahead |
|---|---|---|---|
| hours paired | 4,789 | 4,784 | 4,766 |
| hours KPMV reported a gust | 964 | 959 | 954 |
| forecast gust above / same / below the reported gust | 605 / 93 / 266 | 607 / 92 / 260 | 556 / 81 / 317 |
| mean, forecast minus reported | +1.5 kt | +1.49 kt | +0.95 kt |
| median / p90 / largest miss | 3 / 8 / 24 kt | 3 / 8 / 25 kt | 3 / 8 / 24 kt |
| no gust reported: forecast gust over the steady wind, mean | +5.9 kt (3,825 h) | +5.9 kt | +6.0 kt |

**The side holds overall, less firmly than October showed.** Above in 63%
of gusting hours at the latest issuance, below in 28%, against 85% and 6%
in the kept window.

**By month** (latest issuance; hours with a reported gust; months in
Central time, as the days below are, so the first three hours fall on
March 31 and are left out of the table):

| | Apr | May | Jun | Jul | Aug | Sep | Oct |
|---|---|---|---|---|---|---|---|
| hours | 276 | 180 | 135 | 64 | 86 | 103 | 117 |
| mean | +1.0 | +0.8 | +2.3 | +2.8 | +1.2 | +1.0 | +3.1 |
| above / below | 148 / 87 | 101 / 67 | 100 / 25 | 48 / 11 | 52 / 27 | 63 / 32 | 93 / 14 |

**By the size of the reported gust**, the clearest pattern: the forecast
ran high on small gusts and low on the largest.

| reported gust | under 18 kt | 18 to 22 kt | 23 kt or more |
|---|---|---|---|
| hours | 436 | 320 | 208 |
| mean, latest issuance | +2.5 kt | +1.5 kt | −0.6 kt |
| above / below | 303 / 85 | 197 / 96 | 105 / 85 |
| mean, 24 h or more ahead | +2.0 kt | +1.1 kt | −1.5 kt |

**By day**, the size moved a lot. Of the 111 days (Central time) with at
least three gusting hours, the day's mean was within 2 kt of zero on 54,
more than 2 kt high on 42 and more than 2 kt low on 15; from −8.3 to
+6.9 kt, median +1.0 (latest issuance; 6 h and 24 h ahead alike, 53/40/17
and 51/37/21). By six-hour block of UTC the mean stayed between +1.3 and
+1.7 kt.

**Against the Student profile's limit.** The forecast wind flag reads
the higher of the forecast wind and gust against the profile's caution,
BSR 2-1 H's 14 mph read as 12 kt, and so does this count. Over the six
months the forecast gust was never under the forecast wind in whole
knots: 0 of 4,789 hours at the latest issuance, 0 of 4,784 and 0 of 4,766
at the other leads (and 0 of 34,149 hour-values in the kept forecasts,
2026-10-13 to 10-23), and no hour had a forecast speed without a gust at
its lead. So the gust decided it. At the latest issuance
the forecast was at or over 12 kt in 2,477 of 4,789 hours. KPMV's report near the hour was at or over
12 kt (the higher of its wind and gust, as the report's flag reads it) in
1,014 of those, and in 41 more the report was at or over 12 kt with the
forecast gust under it: 1,055 hours the report reached the figure. So
over these months the forecast was at the figure in about 2.3 hours
for each hour the report reached it, and under it in about one in 25 of
those (41 of 1,055). At 6 and 24 hours ahead: 2,451 and 2,402 hours, the
report too in 1,001 and 985, the report alone in 49 and 59. A report covers only the minutes before it; the station
may reach the figure at other minutes of the hour, so "reached" here
counts less than the station did.

## The wind speed and direction, six months

The same pairing for the speed and direction (`pairNdfdWind`,
`summarizeNdfdWind`), first over the kept window, where it gives the
kept reading again (speed −0.74 kt at the latest issuance against the
kept −0.78; the blocks −0.74, −1.48, −0.82 and 0 kt against −0.76, −1.45,
−0.80 and −0.17; direction +10.3° against +11.8° and +7.2° by speed),
then over the six months:

| | latest issuance | 6 h or more ahead | 24 h or more ahead |
|---|---|---|---|
| hours | 4,791 | 4,786 | 4,768 |
| speed, mean / median miss / p90 | +0.13 / 2 / 5 kt | +0.12 / 2 / 5 kt | +0.02 / 2 / 5 kt |
| speed, 00–05Z (7 pm–1 am CDT) | +0.19 | +0.15 | +0.10 |
| speed, 06–11Z (1–7 am) | −0.48 | −0.41 | −0.59 |
| speed, 12–17Z (7 am–1 pm) | +0.32 | +0.25 | +0.20 |
| speed, 18–23Z (1–7 pm) | +0.49 | +0.48 | +0.38 |
| direction, mean / median miss | +8.7° / 10° | +8.5° / 20° | +8.1° / 20° |

**The speed was centred over the six months**, a few tenths low in the
small hours and a few tenths high in the afternoon. The kept reading's
"a little under a knot low" was the October window's: over the same days
the archive says the same, over six months it does not. **The direction
sat clockwise** by about 8° at every lead, as in the kept reading.

The hours here (4,791) are the hours with a forecast and a report; the
page's speed charts count the 4,789 with a speed on both sides.

## On the #wind-errors page

Since 2026-10-23 the page has a section for this archive, "NWS forecasts
from NOAA’s archive, against KPMV", between the kept forecasts and
Open-Meteo's archive, a row per lead (`nwsArchiveSection`,
`src/domain/windErrors.ts`), paired by the kept reading's own code
(`pairInstants`) and read exactly as the kept section is. The
weekly ceiling data refresh fetches each week's speed, gust and
direction (`PARTS=wspd,wgust,wdir`, to `data/parity/ndfd-wind-*`) from the
newest issuance kept of the three (`earliestNewest`), checks that each
element brought something newer than its own newest kept, and rebuilds the
page with them; a failure there, like Open-Meteo's, leaves the page's file
as published and does not hold back the ceiling commit.

![Histograms of the NWS forecast from NOAA's archive minus KPMV's reports, at three leads](img/nws-archive-wind-errors-2026-10-22.svg)

A branch trial of the refresh on 2026-10-23 (run 40036630382) rebuilt
the page's file with the section (4,791, 4,786 and 4,768 hours by lead,
the week's reports reaching 10-23 00Z) and passed its tests. Its NDFD
fetch step was skipped, the archive being current to the last whole day,
so the step's first run on a runner is the refresh of 2026-10-26.

The figure is this reading's, to 2026-10-22, kept as it is; the page is
the current view.

## What this says for the card note

The question was whether the forecast gust's difference from the station
is consistent enough to describe on the card. Over six months:

- **The side, mostly yes:** above in about two thirds of gusting hours, at
  every lead.
- **The size, no:** about +1.5 kt on average, but half the gusty days were
  within 2 kt, two in five more than 2 kt high, one in seven more than
  2 kt low, and on the strongest gusts (23 kt or more) it ran low, not
  high.
- **In hours with no reported gust**, the forecast gust sat about 6 kt
  over the reported steady wind.

A figure like "the forecast gust runs about 1.5 kt high" would be true on
average and misleading on the windiest days, the ones that matter. The
decision stays the maintainer's (docs/open-questions.md). Nothing on the
dashboard changed, and nothing reads these figures.

KPMV is 11.5 miles from the drop zone, and the grid point is the drop
zone's, so part of every difference is the distance. The METAR's rule for
reporting a gust was not read for this.
