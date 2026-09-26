# Does Mark Schulze's Winds Aloft label altitudes AGL or MSL?

**AGL.** Checked 2026-09-22 against the live tool and its own API.

This mattered because the winds-aloft card tells a jumper to cross-check against
that tool, and a jumper who did was once told "MSL" by an AI. It was wrong. At
this DZ the field elevation is about 1,150 ft, so reading one table against the
other on the wrong scale misaligns them by roughly a thousand feet — most of the
way to the next row.

Nothing in this repository asserted either way until now. What follows is the
evidence, so the claim can be rechecked rather than taken on trust.

## Where the "MSL" on the page comes from

`markschulze.net/winds/` has a line reading:

```
Elevation    1145 ft / 349 m MSL
```

That is the **ground elevation** of the selected location, and it is genuinely
MSL. It is the most likely thing to have produced the wrong answer: it is the
only "MSL" on the page, and it sits directly above the winds table. It says
nothing about the scale of the table.

## The evidence that the table is AGL

Four independent lines, all from the tool itself.

**1. Its own export header.** `getPos_maptest.js` builds the downloadable text
file with the column header:

```js
textFileString += ' Alt \tDir\tSpd\tTemp\n';
textFileString += 'ftAGL \tdeg\tkts\tdegC\n';
```

**2. The first row is the ground.** The table's lowest row is labelled
`Surface`, and its values equal the separately-reported ground values exactly.
From `winds_openmeteo.php` at the DZ coordinates:

| | dir | speed | temp |
|---|---|---|---|
| `altFt[0]` | 38° | 8 kt | 16 °C |
| reported ground | 38° | 8 kt | 16 °C |

A row numbered 0 that *is* the surface is an AGL scale.

**3. The raw pressure-level heights are ground-relative.** The API also returns
`altFtRaw`, the model's own pressure-level heights. Read as MSL they are
physically wrong; add the reported ground elevation and they land where the
observed pressure puts them. With `groundElev` 1,145 ft and `QNH` 1020.6 hPa:

| level | `altFtRaw` | as MSL, if raw were MSL | raw + groundElev |
|---|---|---|---|
| 1000 hPa | −581 ft | 581 ft **below sea level** | 564 ft |
| 925 hPa | 1,594 ft | 1,594 ft | 2,739 ft |
| 850 hPa | 3,914 ft | 3,914 ft | 5,059 ft |
| 500 hPa | 17,828 ft | 17,828 ft | 18,973 ft |

At 1020.6 hPa the 1000 hPa surface sits a few hundred feet *above* sea level,
not 581 ft below it, and the 850 hPa surface sits near 5,000 ft rather than
3,900. The right-hand column is the physical one, so `altFtRaw` — and the
`altFt` grid interpolated from it — is height above ground.

**4. It agrees with this app, which is explicitly AGL.** Same hour, same
coordinates, 13,000 ft AGL: this app read 303° / 20 kt / −4 °C and the tool read
303° / 20 kt / −4 °C. A scale mismatch would show as a systematic offset,
largest in the low levels where the gradient is steepest. There is none.

## Also worth knowing

The tool now runs on **Open-Meteo** (`winds_openmeteo.php`), the same source
this app uses — which is why the two agree closely rather than approximately.
It samples 20 pressure levels. This app sampled 6 until 2026-09-23, when a
same-hour comparison (08Z, run from the app's own fetch path and the tool's
API) showed what that cost in the middle of the profile:

| ft AGL | app dir/kt | Schulze dir/kt | Δ dir |
|---|---|---|---|
| 0 | 126 / 7 | 124 / 8 | 2° |
| 1,000 | 129 / 12 | 127 / 14 | 2° |
| 3,000 | 203 / 8 | 178 / 9 | 25° |
| 5,000 | 265 / 6 | 289 / 8 | 24° |
| 6,000 | 274 / 10 | 312 / 13 | 38° |
| 7,000 | 283 / 14 | 312 / 16 | 29° |
| 8,000 | 292 / 18 | 309 / 20 | 17° |
| 9,000–13,000 | within 3° and 1 kt | | |

The bottom and top agreed; the band between did not, because 850 hPa sat near
4,000 ft AGL and 700 hPa near 9,300, and the wind backed from 256° to 312°
between them where the app had no sample. The app now asks for the levels the
tool itself samples below 18,000 ft — 1000, 975, 950, 925, 900, 850, 800, 750,
700, 650, 600, 550 and 500 hPa, read from its `altFtRaw` that day
(`OPEN_METEO_PRESSURE_LEVELS` in `src/domain/normalize.ts`) — so the two tables
are built from the same samples, and the widest gap in the 13,000 ft column is
about 2,100 ft. Open-Meteo also serves 775 and 725 hPa (checked 2026-09-23);
they were left out so that the sampling matches the tool's exactly, which is
what makes it a cross-check. `scripts/schulzeCompare.live.ts` prints the two
profiles side by side at the same valid hour. Run after the change, the same
day at 19Z:

| ft AGL | app dir/kt/°C | Schulze dir/kt/°C | Δ dir |
|---|---|---|---|
| 0 | 126 / 7 / 19 | 128 / 8 / 19 | 2° |
| 1,000–4,000 | identical | | 0° |
| 5,000 | 221 / 8 / 12 | 217 / 8 / 12 | 4° |
| 6,000 | 288 / 9 / 11 | 288 / 8 / 11 | 0° |
| 7,000–13,000 | identical | | 0° |

Every remaining difference has a known cause, none of them the data:

- **Direction across a large turn.** Both tools interpolate direction linearly
  along the shortest arc between the two samples that bracket a row, then
  round to whole degrees. The 5,000 ft row sits between the 850 hPa sample
  (124° at 4,062 ft) and the 800 hPa one (290° at 5,732 ft), a 166° turn; the
  app's arithmetic gave 221° and the tool's 217°. The bigger the turn between
  two samples, the more a rounding choice moves the row between them.
- **The surface row.** This app's is Open-Meteo's 10 m wind
  (`wind_speed_10m`/`wind_direction_10m`); the tool's is the
  `groundDir`/`groundSpd` its API reports, whose derivation has not been read.
  2° and 1 kt apart here.
- **The valid hour**, when the two are not aligned: see "Re-checking this".

- **Which forecast run each request was served.** Not yet explained. The first
  run of `scripts/schulzeCompare.live.ts` on a GitHub runner, 2026-09-23 at
  18:42Z for the same 19Z hour as the sandbox run at 18:31Z above, printed the
  app within 4° of the tool below 5,000 ft but 7–12° off from 5,000 to
  10,000 ft. The app's numbers were identical to the 18:31Z run at every level
  (274° / 9 kt at 700 hPa); the tool's had changed (261° / 8 kt), and were
  still those values when read again at 18:46Z. So a newer forecast reached
  the tool's request and not the app's, in the same two seconds from the same
  runner. Two candidates, neither checked: Open-Meteo serving a cached response
  for the app's URL, which is byte-identical from run to run, or the two
  requests naming different models (the tool's request has not been read).
  This one is a difference in the data, and it is the one to chase; the
  parity job's daily table will show how often it happens.

Before 2026-09-23 there was a fifth, and it dwarfed the others: the sampling
gap described above. It is gone, and the comparison script exists so that its
return would be noticed.

Its `hourOffset` parameter and its "Forecast valid now / valid in about N
minutes" line are the equivalent of this app's valid-time note. When the two
tables differ, compare those before concluding the winds differ.

## How far apart the tables are, by the time they represent

The valid hour is the largest cause of a difference by far. Measured once, on
2026-09-26 at 16:19Z: this app's own request and interpolation for each of the
next 32 hours, against Schulze's endpoint at `hourOffset` 0 to 31 fetched the
same minute, every app hour paired with every Schulze hour and grouped by how
many hours apart the two valid times were. Rows from 1,000 to 13,000 ft,
absolute differences:

| hours apart | pairs | dir avg | dir 90th | dir max | speed avg | speed 90th | speed max |
|---|---|---|---|---|---|---|---|
| 0 | 416 | 0.5° | 1° | 7° | 0.0 kt | 0 kt | 1 kt |
| 1 | 806 | 9.6° | 24° | 175° | 1.2 kt | 3 kt | 5 kt |
| 2 | 780 | 18° | 48° | 169° | 2.0 kt | 5 kt | 9 kt |
| 3 | 754 | 26° | 69° | 179° | 2.8 kt | 6 kt | 10 kt |
| 6 | 676 | 47° | 143° | 180° | 4.4 kt | 9 kt | 18 kt |
| 12 | 520 | 85° | 157° | 180° | 6.8 kt | 14 kt | 18 kt |
| 24 | 208 | 143° | 175° | 180° | 9.4 kt | 18 kt | 25 kt |

At the same hour the two tools agree to a degree; each hour between the valid
times adds roughly as much as the forecast itself changes in an hour. The
large direction maxima are light winds, where a few knots of change swings
the arrow: of the one-hour pairs where both speeds were 10 kt or more, the
largest direction difference was 21° and the 90th percentile 9°, against 175°
and 24° over all pairs. One day's weather, a front coming through, so treat
the figures as the shape of the effect rather than a constant.

The two pages are one hour apart in the second half of every hour (this card
snaps to the nearest hour, Schulze's shows the hour in progress), and on
13 percent of same-hour samples between 2026-09-24 and 26 one side was on a
newer model run than the other (5 of 38). The #parity page tracks both from
the live samples, in its "Time the tables represent" table. To repeat the
measurement above, fetch the two for a run of hours and pair them; the
endpoint serves `hourOffset` up to at least 47.

## Re-checking this

```
curl -H 'Referer: https://www.markschulze.net/winds/' -H 'User-Agent: Mozilla/5.0' \
  'https://www.markschulze.net/winds/winds_openmeteo.php?lat=40.8675&lon=-96.11&hourOffset=0&referrer=MSWA2024'
```

A bare request 403s; the site checks the referer, and without a browser-like
User-Agent it answers Node's fetch with an HTML page instead of JSON.
`hourOffset=0` is the hour in progress; this app snaps to the nearest hour, so
late in an hour compare against `hourOffset=1`. The gridded values are
`direction`, `speed` and `temp`, keyed by the `altFt` altitude as a string. Compare `altFt[0]` against
`groundDir`/`groundSpd`/`groundTemp`, and `altFtRaw` against `groundElev`, as
above.
