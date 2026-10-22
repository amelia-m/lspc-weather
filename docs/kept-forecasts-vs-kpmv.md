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
  "under 10 SM": 16,080 m is 9.99 SM. So the forecast is read as a report
  would be: whole miles from 3 SM, quarters below (`asReported`). KPMV's
  reports in the window read 10, 7, 5, 4, 3, 2 1/2 and 2 SM.
- **Rainfall.** The gridpoint's `quantitativePrecipitation` is a total over
  six-hour periods, so it is not spread over hours as the instant fields
  are. Each period is set against KPMV's hourly amounts added up over its
  clock hours. The hourly amount is the hour's largest `P` group, the :55
  report's unless a special after it measured more (`reportedHours`'
  `amount`, the hour rule of docs/forecast-chances.md). A period with an
  hour it cannot add (no :55 report, or `P////`/`PNO`) is left out.

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

**Direction.** Median miss 10° at every lead, the smallest a 10° figure
can show. The forecast sat clockwise of the report on average, by 7 to
12°. Both sides give direction in degrees true.

**Temperature.** The forecast ran cool by about half a degree C at the
latest issuance, nearer a degree at 24 hours ahead, most at night.

**Visibility.** Only one spell, the rain of October 15. KPMV reported
under 10 SM in 11 hours. Ten of them were on October 15, 07Z to 19Z,
down to 2 SM, and the forecast had those hours under 10 SM too (latest
issuance). The eleventh was 4 SM in haze at 23:55Z on October 20, the
only report under 10 SM that evening, with the forecast at 10. The latest
issuance put 10 more hours under 10 SM that KPMV reported at 10, most of
them at 9 SM:

- October 15, 09Z and 10Z (the rain's start, reported 10 SM);
- October 15, 20Z to 23Z (its end);
- dawn hours on other days.

Across the 21 hours either side was under 10 SM, the forecast was a median
1 SM off.

**Rainfall.** The one rain spell again: 0.60 in. at KPMV between October
15 06Z and 24Z. By six-hour period:

| period (UTC) | latest issuance | 6 h or more ahead | 24 h or more ahead | measured |
|---|---|---|---|---|
| Oct 14 00–06Z | 0.09 | 0.15 | 0 | 0 |
| Oct 14 06–12Z | 0.04 | 0.04 | 0 | 0 |
| Oct 15 06–12Z | 0.26 | 0.15 | 0.19 | 0.13 |
| Oct 15 12–18Z | 0.41 | 0.41 | 0.20 | 0.44 |
| Oct 15 18–24Z | 0.08 | 0.08 | 0.08 | 0.03 |

All other periods were 0 on both sides. Over the 36, 35 and 32 periods
each row could pair, the forecast added up to 0.88, 0.83 and 0.47 in.
against 0.60 measured.

**How far this goes.** Nine and a half days, one rain spell, one
low-visibility spell, and October weather. The night-time leans in wind
and temperature held at all three leads, but nine nights do not make a
season. The figures are a first reading, to be read again as the keeper
adds days. A grid point's forecast set against one station is also not
the same thing as the forecast's error at that station. KPMV is 11.5
miles from the drop zone, and the gridpoint is the drop zone's.

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
