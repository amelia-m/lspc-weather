# Rain and thunder chances against KPMV's reports

Started 2026-10-17. The dashboard's hourly rain and thunder chances are
api.weather.gov's gridpoint `probabilityOfPrecipitation` and
`probabilityOfThunder`. No archive holds them by the hour: NDFD has only
a 12-hour `pop12` and no thunder element (docs/open-questions.md,
"Forecasts kept for later"). The forecast keeper has saved them hourly
since 2026-10-13, as the card fetched them, so these are scored from its
snapshots alone. The scoring is `src/domain/chances.ts` (pure, tested in
`tests/chances.test.ts`). `scripts/ceilingChartData.ts` writes it into the
ceiling page's data file (`chances`), and the page draws it in a section
of its own, "Rain and thunder chances". Counts only, as on the rest of
that page. Nothing on the dashboard reads any of it, and no forecast
chance raises a flag there (CLAUDE.md).

## What counts as it happening

**Rain.** NWS's chance of precipitation is, in its Peachtree City
office's words, "the probability that the forecast grid/point in
question will receive at least 0.01" of rain" (weather.gov/ffc/pop, read
2026-10-17). So an hour counts as rain when KPMV measured at least
0.01 in. in it. That comes from the `P` group in the remarks, not from
the weather group: drizzle with no `P` group, or `P0000` (a trace), is
precipitation but not 0.01 in. Those hours are counted separately
("some precipitation reported, under 0.01 in.") and are not rain here.
Drifting or blowing snow (`DRSN`, `BLSN`) is snow lifted by the wind and
counts as neither (none in the archive).

KPMV reports at :15, :35 and :55. From April to October 9, 2026 there
were 4,460, 4,453 and 4,462 reports at those minutes, and 19 or fewer at
any other (57 off those minutes from April to October 16, special
reports among them). Its `P` amount runs from one :55 report to the next. On
2026-10-15 the reports read `P0006` at 10:55, then `P0001`, `P0003` and
`P0007` at 11:15, 11:35 and 11:55, with the six-hour `60013` at 11:55
equal to 0.06 + 0.07. Across the archive to October 9, in all 220 hours
with a `P` group in two or more reports, the amount rose or held from
:15 to :35 to :55; it never fell. So the hour read for rain is the one
ending at :55, five minutes ahead of the forecast's clock hour: a
report at :56 to :59 gives its amount to the next hour, since it runs
from the :55 report before it. The weather group is different. It is
what was seen at the report's minute, so thunder, vicinity weather and
precipitation codes count in the clock hour they were seen in, a special
report at 16:58 in 16Z. An hour counts only when its
:55 report is on record, since without it the hour's amount is not all
there; a special report at :48 is not the hourly one. A report with no
`P` group is no precipitation unless it says `PNO`, the gauge not
available (2026-08-26 07:15Z, once in the archive), or gives `P////`;
then the hour is unknown and left out of the rain count, unless another
report in it measured 0.01 in.

**Thunder.** An hour counts as thunder when a report in it gave `TS` in
its weather group (`TS`, `TSRA`, `-TSSN` and so on). `VCTS`, a
thunderstorm in the vicinity, is not thunder at the station; it is
counted separately. KPMV wrote one as `-VCTSRA` on 2026-10-13, with the
intensity before `VC`, and that is read as vicinity weather too. An hour
whose reports say `TSNO` (the lightning sensor not available), and that
reported no `TS`, is left out as unknown: one hour in the archive. KPMV
does report thunder. Of the 4,629 hours from April 1 to October 16 with
a :55 report, 97 had `TS` and 276 had 0.01 in. or more (one unknown
each).

Scoring the thunder chance against the station alone is this app's
choice. NWS's own definition of its thunder chance (a point, or an area
around it) was not read.

## How each hour's forecast is picked

As for the ceilings (docs/ceiling-heights.md): one row per issuance lead
(`NWS_ISSUANCES`: latest, 6 h and 24 h or more ahead). Each takes the
newest kept snapshot whose `updateTime` is at least that lead before the
hour's start. Hours more than 6 hours past the last snapshot's reach for
the row's lead are left out (`END_REACH_H`). The API runs equal hours
together (`P2DT21H` at 0% for 69 hours, read 2026-10-17), and each hour
of a run takes its value. A null value is no forecast.

The chances are grouped as 0%, 1 to 9%, then tens to 90 to 100%. The
API's are whole percents; a fractional one would join the group whose
lowest value it reaches (one under 1% the 1 to 9% group, so 0% holds
only 0), and a value outside 0 to 100% stops the run. KPMV's hourly
report has always been at :55 in the archive; one filed a minute either
side would drop its hour, and nothing here allows for it. For
each group the page shows how many hours, how many it happened in, and
the group's average chance. Beside them it gives the chances added up:
the number of hours a forecast meaning exactly what it said would have
expected it in. It computes no score. The hours short of the event are
counted by `CHANCE_NEAR`, beside `CHANCE_EVENT`.

## First reading, 2026-10-17

Kept forecasts from 2026-10-13 15:35Z, reports to 2026-10-16 23:55Z. At
the latest issuance, 80 hours, October 13 16Z to October 16 23Z:

- **Rain:** 9 hours with 0.01 in. or more, all on October 15, 10Z to
  18Z. The chances added up to 13.7 hours. Two more hours had
  precipitation under 0.01 in., 08Z and 19Z that day. By group: 0 of 15 hours at 0%, 0 of 34 at 1 to 9%,
  0 of 14 at 10 to 19%, 0 of the 7 between 20 and 49%. Then 2 of
  3 at 60 to 69%, 2 of 2 at 70 to 79%, 2 of 2 at 80 to 89% and 3 of 3 at
  90 to 100%.
- **Thunder:** none at the station in any of the 80 hours. The chances
  added up to 4.2 hours, none above 29%.
- At 6 and 24 hours ahead: 74 and 56 hours, the same 9 rain hours, the
  chances adding up to 14.8 and 13.9 hours; thunder 0, the chances 5.3
  and 3.3 hours.

That is four days and one rain spell, so the page carries its
small-sample note. Rain in the low groups not happening, and in the high
groups happening, says nothing yet about whether a 30% chance comes true
about 30% of the time. That needs weeks of hours in each group.

## Adding data

The chances come from the kept snapshots and KPMV's reports. A later
METAR fetch (`PARTS=metar python3 scripts/cloudCoverFetch.py`) and a
current checkout of `forecast-archive` extend them. Regenerate the data
file as docs/ceiling-heights.md, "The chart", says; the chances are
written whenever the kept snapshots hold any.
