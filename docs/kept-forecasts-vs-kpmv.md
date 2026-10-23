# The kept NWS forecasts against KPMV's reports

First run 2026-10-22, at the maintainer's request. The forecast keeper
(`scripts/forecastKeep.ts`, the `forecast-archive` branch) has saved
api.weather.gov's gridpoint for the drop zone hourly since 2026-10-13, as
the card fetched it. Two of its fields were already scored: the ceiling
(docs/ceiling-heights.md) and the rain and thunder chances
(docs/forecast-chances.md). This scores the rest: wind speed, gust,
direction, temperature, visibility and rainfall. Sky cover is left to
docs/cloud-cover-sources.md, which reads it from NDFD's archive, where it
matched the API value for value.

The arithmetic is `src/domain/keptForecasts.ts` (pure, tested in
`tests/keptForecasts.test.ts`); `scripts/keptForecastsVsKpmv.ts` reads the
files and prints. Spreads and counts, forecast minus reported, never a
grade. Nothing on the dashboard reads any of it, and none of it raises or
moves a flag (CLAUDE.md).

## How the hours are paired

As for the ceilings. Each hour is paired three ways (`NWS_ISSUANCES`):

- the newest kept issuance at least 0 hours before the hour's start;
- the newest at least 6 hours before;
- the newest at least 24 hours before.

The issue time is the gridpoint's `updateTime`. Hours more than 6 hours
past the last snapshot's reach are left out (`END_REACH_H`). The forecast
for an hour is set against the KPMV report nearest the hour's start,
within 10 minutes (`reportNear`, the same rule the ceilings use). In
practice that is the :55 report before it.

- **Units.** The API serves wind in km/h, temperature in °C and visibility
  in metres. Read on 2026-10-22, every wind figure was a whole number of
  knots in km/h (5.556 is 3 kt, 14.816 is 8 kt). So speeds are compared
  in whole knots, as a METAR reports them and the dashboard prints them.
- **Gust.** A METAR gives a gust (`G`) only when there is one to report.
  The forecast always gives one. So the gust is split two ways:
  - in hours the station reported one, forecast gust against reported gust;
  - in hours it reported none, forecast gust against the reported steady
    wind.
- **Direction.** Calm and `VRB` reports have no direction and are not
  counted. The rest are split at a reported 10 kt, since a light wind's
  direction is the least settled. The split is a reading aid, not a
  threshold anything acts on. Both sides report direction to 10°.
- **Visibility.** KPMV reports nothing above 10 SM, so both sides are
  capped there. Read unrounded, the forecast's metres made nearly every hour
  "under 10 SM": 16,080 m is 9.99 SM. So the forecast is rounded to the
  nearest whole mile from 3 SM and the nearest quarter below (`asReported`).
  That is this comparison's choice: how an automated station rounds its own
  reading was not read. KPMV's reports in the window read 10, 7, 5, 4, 3,
  2 1/2 and 2 SM. Rounding down instead would move 35 more hours at the
  latest issuance (32 and 39 at the other leads) to "forecast under
  10 SM". The forecast had those hours between 9.5 and 10 SM, and KPMV
  reported 10 SM in every one.
- **Rainfall.** The gridpoint's `quantitativePrecipitation` is a total over
  six-hour periods, so it is not spread over hours as the instant fields
  are. Only the periods of six hours starting at 00, 06, 12 and 18Z are
  scored. The API also serves shorter ones (07Z for five hours, 15Z for
  three, a three-hour tail), which would overlap them. Each period is set
  against KPMV's hourly amounts added up over its clock hours. The hourly
  amount is the largest `P` group in the hour ending with its :55 report
  (`reportedHours`' `amount`, the hour rule of docs/forecast-chances.md).
  In practice that is the :55 report's own. A period is left out when:
  - it is past the reach of what was gathered, as the hours are;
  - it has an hour it cannot add: no :55 report, or `P////`/`PNO`.

## First reading, 2026-10-22

166 kept snapshots, 2026-10-13 15:50Z to 2026-10-22 22:23Z, every one
with the gridpoint. 716 KPMV reports from IEM, 2026-10-13 00:15Z to
2026-10-22 22:35Z (`data/parity/kept-forecasts-kpmv-reports-2026-10-13-to-2026-10-22.jsonl.gz`;
not named `metar-*`, which the weekly ceiling refresh would take as an
input to the published ceiling page, `chartInputs`).

| | latest issuance | 6 h or more ahead | 24 h or more ahead |
|---|---|---|---|
| hours | 223 | 217 | 199 |
| lead | 0.05 to 6.4 h | 6.05 to 12.4 h | 24.05 to 30.4 h |
| speed, signed mean | −0.78 kt | −0.72 kt | −1.2 kt |
| speed, median / p90 / largest miss | 1 / 4 / 6 kt | 2 / 4 / 7 kt | 2 / 4 / 7 kt |
| speed, mean forecast vs reported | 6.57 vs 7.35 kt | 6.7 vs 7.41 kt | 6.47 vs 7.67 kt |
| gust reported, hours | 53 of 223 | 53 of 217 | 52 of 199 |
| gust, where reported: signed mean, median / p90 miss | +3.45 kt, 3 / 8 | +4.04 kt, 3 / 8 | +4.02 kt, 3 / 10 |
| gust, none reported: forecast gust over the steady wind, mean | +4.59 kt | +4.71 kt | +4.31 kt |
| direction under 10 kt: signed mean, median / p90 miss | +11.8°, 10 / 30° (170) | +11°, 10 / 30° (164) | +7.4°, 10 / 30° (147) |
| direction 10 kt or more: signed mean, median / p90 miss | +7.2°, 10 / 20° (50) | +7.4°, 10 / 20° (50) | +8°, 10 / 20° (50) |
| temperature, signed mean | −0.48 °C | −0.72 °C | −0.83 °C |
| temperature, median / p90 / largest miss | 0.87 / 2 / 3.4 °C | 1.02 / 2.5 / 3.7 °C | 1.23 / 2.6 / 3.9 °C |

**Wind speed.** The forecast ran under the station by a little under a
knot, most at night. At the latest issuance, by six-hour block of UTC:

| block | 00–05Z (7 pm–1 am CDT) | 06–11Z (1–7 am) | 12–17Z (7 am–1 pm) | 18–23Z (1–7 pm) |
|---|---|---|---|---|
| speed, signed mean | −0.76 kt (54) | −1.45 kt (54) | −0.80 kt (56) | −0.17 kt (59) |
| temperature, signed mean | −0.63 °C (54) | −0.87 °C (54) | +0.09 °C (56) | −0.54 °C (59) |

In the afternoon, the hours most jumps are made, the speed's signed mean
was −0.17 kt at the latest issuance, +0.15 at 6 hours ahead and −0.40 at
24 hours ahead. The surface-wind sampler found the same lean with a
different pairing: NWS's forecast read when each report was newest, 742
reports, signed mean −0.75 kt (docs/surface-wind-sources.md).

**Gust.** In the hours KPMV reported a gust, the forecast's was higher, by
3 to 4 kt on average. The sampler had +2.1 kt over 229 gusting reports.
In the other three quarters of hours the forecast still gave a gust,
about 4.5 kt over the steady wind the station reported. The METAR's rule
for reporting one is not this app's to judge from here.

**Gust, closer** (asked 2026-10-23: consistently high, or scattered
both ways?). Consistently high, by an amount that varied. Where KPMV
reported a gust, the forecast's was above it in 45 of 53 hours at the
latest issuance, the same in 5 and below in 3, by 1 to 4 kt
(`gustSide`). At 6 and 24 hours ahead: 50, 2 and 1 of 53, and 46, 4 and
2 of 52.

- **How far above, latest issuance:** 1 to 3 kt in 20 hours, 4 to 6 kt
  in 16, 7 to 11 kt in 9.
- **By day, not by size.** The gusting hours bunch into a few windy days:
  22 on October 16, 11 on October 18, 8 on October 17, 7 on October 15.
  Three of those days the forecast ran about 4 to 5 kt high on average
  (October 15, 16 and 18). On October 17 it ran 0.6 kt high (−2 to +2).
  By the reported gust's size it hardly moved: a mean of +3.4 kt under
  18 kt, +3.7 at 18 to 22, +3.2 at 23 or more.
- **The steady wind was right in those hours; the gap over it was not.**
  The forecast speed was +0.2 kt from the reported speed on average in
  these 53 hours. The forecast put its gust 10.2 kt over its own speed,
  where KPMV's gusts were 6.9 kt over its reported speed.

Part of the gap may be what each figure is. A report's gust covers the
minutes before that report. The forecast's hour figure may be the hour's
peak, but NWS's definition of its gust element was not read, so that is
unconfirmed. The surface-wind sampler, pairing differently, found the
same side with less size: +2.1 kt over 229 gusting reports
(docs/surface-wind-sources.md). Fifty-three hours over a handful of windy
days is a small sample, so the size of the gap is not settled. The side
it falls on was the same at all three leads.

**Direction.** Median miss 10° at every lead, the smallest a 10° figure
can show. The forecast sat clockwise of the report on average, by 7 to
12°. Both sides give direction in degrees true.

**Temperature.** The forecast ran cool by about half a degree C at the
latest issuance, nearer a degree at 24 hours ahead, most at night.

**Visibility.** Only one spell, the rain of October 15. KPMV reported
under 10 SM in 11 paired hours.

- Ten were on October 15, the hours 08Z to 19Z (reports 07:55 to
  18:55Z), down to 2 SM. The latest issuance had those hours under 10 SM
  too.
- The eleventh was 4 SM in haze at 23:55Z on October 20, the only report
  under 10 SM that evening, with the forecast at 10.

The latest issuance put 10 more hours under 10 SM that KPMV reported at
10, most of them at 9 SM:

- October 14, 04Z (11 pm CDT);
- October 15, 09Z and 10Z (as the rain began) and 20Z to 23Z (after it
  ended);
- October 22, 11Z to 13Z (6 to 8 am CDT).

Across the 21 hours either side was under 10 SM, the forecast was a median
1 SM off.

**Rainfall.** The one rain spell again: 0.60 in. at KPMV between October
15 06Z and 24Z. By six-hour period:

| period (UTC) | latest issuance | 6 h or more ahead | 24 h or more ahead | measured |
|---|---|---|---|---|
| Oct 14 00–06Z | 0.09 | 0.15 | — | 0 |
| Oct 14 06–12Z | 0.04 | 0.04 | — | 0 |
| Oct 15 06–12Z | 0.26 | 0.15 | 0.19 | 0.13 |
| Oct 15 12–18Z | 0.41 | 0.41 | 0.20 | 0.44 |
| Oct 15 18–24Z | 0.08 | 0.08 | 0.08 | 0.03 |

A dash is a period the row could not pair. The 24-hour row's first is
October 14 18Z, a day after the first kept snapshot. All other periods
were 0 on both sides. The rows paired 36, 35 and 32 periods. Over them
the forecast added up to 0.88, 0.83 and 0.47 in., against 0.60
measured.

**How far this goes.** Nine and a half days, one rain spell, one
low-visibility spell, and October weather. The night-time leans in wind
and temperature held at all three leads, but nine nights do not make a
season. The figures are a first reading, to be read again as the keeper
adds days. A grid point's forecast set against one station is also not
the same thing as the forecast's error at that station. KPMV is 11.5
miles from the drop zone, and the gridpoint is the drop zone's.

## The spread, drawn (2026-10-23)

![Histograms of forecast minus reported wind speed, gust and direction at three leads](img/kept-wind-errors.svg)

The same pairs as the tables above, as histograms of forecast minus reported,
one row per lead (`scripts/keptWindErrorsPlot.ts`, which uses the
comparison's own pairing). The figure shows what the means alone did not:

- **Speed** is one hump, centred a knot below the report (median −1 kt,
  the tallest bin −1 kt) rather than a few large misses pulling the mean
  down. At the latest issuance the forecast was below the report in 129
  hours, above it in 56 and level in 38, nearly all within 4 kt either
  way. At 24 hours ahead the median and the tallest bin are the same; the
  mean moves 0.4 kt further below (−1.2 kt), and fewer hours are above
  (130 below, 33 above).
- **Gust** sits almost wholly right of zero at every lead (45, 50 and 46
  of 52 or 53 hours above), but spread from 0 to +12 kt with no single
  peak. That is the "consistent side, varying size" of "Gust, closer"
  above, drawn.
- **Direction** peaks at +10°, one step of the 10° both sides report in,
  with a tail clockwise to +50° and a few beyond. At the latest issuance
  142 hours were clockwise of the report and 25 anticlockwise; the median
  is +10° at every lead. Most of the tail is light winds
  (median miss 10° both under and over 10 kt, but p90 30° under against
  20° over, in the table).

Rerun it as the keeper adds days:

```
npx tsx scripts/keptWindErrorsPlot.ts <dir>/data docs/img/kept-wind-errors.svg data/parity/kept-forecasts-kpmv-reports-2026-10-13-to-2026-10-22.jsonl.gz <newer reports>
```

## Running it again

```
git fetch origin forecast-archive
git worktree add --detach <dir> origin/forecast-archive
npx tsx scripts/keptForecastsVsKpmv.ts <dir>/data data/parity/kept-forecasts-kpmv-reports-2026-10-13-to-2026-10-22.jsonl.gz <newer reports>
```

KPMV's reports for a later window come from IEM's ASOS archive, as here:
`https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?station=PMV&data=metar&year1=…&tz=Etc/UTC&format=onlycomma&latlon=no&report_type=3&report_type=4`,
written as `{src: 'metar', obsAt, raw}` lines, or the weekly refresh's
`data/parity/metar-*.jsonl.gz` files. The script drops reports seen
twice, so overlapping files can be passed together.
