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
between them where the app had no sample. From then until 2026-10-08 the app
asked for exactly the levels the tool itself samples below 18,000 ft — 1000, 975, 950, 925, 900, 850, 800, 750,
700, 650, 600, 550 and 500 hPa, read from its `altFtRaw` that day
(`OPEN_METEO_PRESSURE_LEVELS` in `src/domain/normalize.ts`) — so the two tables
were built from the same pressure levels, and the widest gap in the 13,000 ft column is
about 2,100 ft. Open-Meteo also serves 775 and 725 hPa (checked 2026-09-23);
they were left out so that the sampling matched the tool's exactly, which is
what made it a cross-check. (Superseded 2026-10-08: the default table now
takes them and five more, and the cross-check is the "As Schulze" table; see
"Two tables" below.) `scripts/schulzeCompare.live.ts` prints the two
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
  (`wind_speed_10m`/`wind_direction_10m`), the height an airport anemometer
  reads. The tool's `groundDir`/`groundSpd` is not a surface wind. It is its
  own table's 0 ft row: a straight line through its raw pressure levels,
  read at the ground. Where a level lies below the ground, the line runs
  between the nearest level below and the nearest above (interpolation);
  where none does, it runs through the two lowest levels and is extended
  down to 0 ft (extrapolation). It never uses the model's 10 m wind. See
  "How the surface row was worked out" below for the evidence.

  At this DZ the two levels are 1000 hPa, about 500 ft *below* the ground
  (Open-Meteo extrapolates it underground), and 975 hPa, about 200 ft above.
  For example, at 02Z on 2026-10-03, 121° / 5 kt at −518 ft and 119° / 10 kt
  at +203 ft give 120° / 8.6 kt; the tool showed 120° / 9, and Open-Meteo's
  10 m wind that hour was 123° / 3.9 kt. So the tool's ground row reads like
  the wind a couple of hundred feet up. At night, when the air near the
  surface decouples, it runs well above the 10 m wind; over 1,028 runs to
  2026-10-02 its median was 8 kt to this app's 6.2. Neither is wrong; they
  are different heights, and the observed METAR wind is the one the student
  ground-wind limits are written against.
- **The valid hour**, when the two are not aligned: see "Re-checking this".

- **Which forecast run each request was served.** First seen on the first
  run of `scripts/schulzeCompare.live.ts` on a GitHub runner, 2026-09-23 at
  18:42Z: for the same 19Z hour the app's numbers were unchanged from a run
  eleven minutes earlier (274° / 9 kt at 700 hPa) while the tool's had moved
  to a newer forecast (261° / 8 kt), 7–12° apart from 5,000 to 10,000 ft.
  Counted by the sampler to 2026-10-05 (its Schulze side every four or five
  minutes, plus the daily run): on the same hour the two were on different
  runs in 114 of 1,611 comparisons, mostly between half past and ten to the
  hour, in stretches of up to about half an hour. Different models were
  effectively ruled out on 2026-09-24 (one level in one hour matched
  `best_match`, `gfs_seamless` and `ncep_hrrr_conus` and no other), and
  nothing in the app's response asks for caching. The cause is still open, since the comparison switches to the
  tool's next-hour request at the same half past: `docs/open-questions.md`,
  "Which forecast run…", and the figures in `docs/source-parity.md`, "What
  the sampler found".

Before 2026-09-23 there was a fifth, and it dwarfed the others: the sampling
gap described above. It is gone, and the comparison script exists so that its
return would be noticed.

Its `hourOffset` parameter and its "Forecast valid now / valid in about N
minutes" line are the equivalent of this app's valid-time line and offset bar,
and its ±1 hr buttons of the card's −1 h / +1 h buttons (added 2026-09-27;
they reach two hours back and four ahead of the hour nearest the clock).
When the two tables differ, compare the valid times before concluding the
winds differ; after half past, one press of −1 h on this card, or +1 hr on
his, lines the two up.

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
newer model run than the other (5 of 38). The #parity page shows both, in
its "Time the tables represent" table, mostly from the sampler that ran to
2026-10-05; since then from the comparison runs, eight a day each
scheduled at a different minute (`.github/workflows/comparisons.yml`),
four of them in the second half of the hour. To repeat the
measurement above, fetch the two for a run of hours and pair them; the
endpoint serves `hourOffset` up to at least 47.

## How the surface row was worked out

The tool's server computes `groundDir`/`groundSpd`; its code is not
readable, so the rule above was reverse-engineered from its output. On
2026-10-03, around 01Z, the API was read for every hour listed below, and
each hour's raw levels (`altFtRaw`, `directionRaw`, `speedRaw`) were put
through the candidate rule and compared with the ground value it served.
The page's own script (`getPos_maptest.js`) loads this same endpoint,
`winds_openmeteo.php`, so this is what a reader of the page sees.

| Site | Ground | Hours | Levels used | Matched |
|---|---|---|---|---|
| This DZ (40.8675, −96.11) | 1,145 ft | 48 (offsets 0 to 47) | 1000 hPa below, 975 hPa above | 48 |
| Longmont, CO (40.164, −105.163) | 5,039 ft | 12 | the level just below and just above | 12 |
| Near Houston (29.45, −95.18) | 26 ft | 6 | none below: the two lowest, extended down | 6 |
| Near Tampa (28.05, −82.40) | 89 ft | 6 | none below: the two lowest, extended down | 6 |

72 hours in all. Direction matched to the degree in every one; speed
matched within 1 kt. The speed slack is rounding: the API returns raw
speeds in whole knots, and the tool probably interpolates the unrounded
values, so the whole-knot inputs reproduce its speed to within a knot (8 of
the 48 DZ hours were 0.6 to 0.7 kt off; none more).

Two candidates were ruled out on the way. At the sea-level sites, with no
level below ground, the ground value matched neither Open-Meteo's 10 m nor
its 80 m wind for the same hour (e.g. Houston 00Z: tool 55° / 6 kt, 10 m
83° / 5.5 kt, 80 m 82° / 7.1 kt), and the extension of the two lowest
levels matched all six. An earlier suspicion, recorded in
`scripts/schulzeCompare.live.ts`, that a km/h figure was being read as
knots does not fit: over 1,028 runs the median ratio of the tool's ground
speed to this app's was 1.18, not 1.85.

What this does not show: it is one day's forecasts at four sites, read from
outside. A different formula that lands within a knot would also fit the
speeds, though matching every direction exactly makes that unlikely. If
the tool changes, the check below will show it.

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

To re-check the surface row: take the raw level nearest below 0 ft and the
nearest above (or, with none below, the two lowest), draw a straight line
through them in speed and in direction (the shorter way round), and read it
at 0 ft. It should give `groundDir` exactly and `groundSpd` within 1 kt.

## Below the lowest pressure levels: the canopy-layer heights (2026-10-08)

Since 2026-10-08 the app also asks Open-Meteo for its winds at 80, 120 and
180 m above the model's ground (`OPEN_METEO_HEIGHT_LEVELS_M` in
`src/domain/normalize.ts`). Where the lowest pressure levels sit depends on the
day's pressure: at NE69 over the 92 days to 2026-10-08, 975 hPa ran from below
ground to about 290 ft up and 950 hPa from about 400 to 1,000 ft, and to
1,200 ft in the winter highs of Jan–Feb 2026. Before this the table drew a
straight line from the 10 m wind to the first level above ground through the
canopy layer. Over the 48 hours from 2026-10-08 01Z, Open-Meteo's own 80, 120
and 180 m winds differed from that line by a median of 2.6, 2.3 and 1.2 kt,
and by up to 7.0, 5.4 and 8.6 kt. They are the same forecast, not a
measurement; 80 m is a native HRRR and GFS output, and which model levels
Open-Meteo builds 120 and 180 m from has not been confirmed.

Schulze's tool samples pressure levels only. What that does to the comparison:

- The 500 ft row is the one the heights normally decide, and his table has no
  500 ft row (no run in `data/parity/logs-to-2026-10-05.jsonl.gz` has one).
- The Surface row is now interpolated from the 10 m sample toward the 80 m
  wind rather than toward the first pressure level; it sits a few feet above
  the 10 m sample here, so it moves by a fraction of a knot.
- On hours when 950 hPa is above 1,000 ft (134 of 1,416 hours in Jan–Feb
  2026, from Open-Meteo's historical forecast), the 1,000 ft row lies between
  the 180 m wind and 950 hPa rather than between two pressure levels, and can
  differ from his for that reason.
- The run-matching check (`rawMismatch`) pairs his raw levels with this app's
  pressure levels only, so the new heights cannot trip it.

Run live the same day at 02Z, after the change: Surface 4° and 1 kt apart,
every row from 1,000 ft up within 1° and 1 kt.

## Two tables: this app's default and "As Schulze" (2026-10-08)

From 2026-10-08 the default table also takes seven pressure levels the tool
does not sample (875, 825, 775, 725, 675, 625 and 575 hPa,
`OPEN_METEO_EXTRA_PRESSURE_LEVELS`). Read that day, each was served with
values that are not the average of its neighbours, so they are model levels.
Over the next 48 hours they moved the default table a median of under 0.5 kt,
at most 2.6 kt and 11° (at 3,000 ft).

So that the app can still show it reproduces the tool, the Winds aloft card
has an "As Schulze" view that rebuilds the same hour his way
(`interpolateAsSchulze` in `src/domain/windsAloft.ts`): his levels below
18,000 ft only, the levels below ground kept, altitudes measured from his ground
(Open-Meteo's `elevation`) rather than the field, and his Surface row, the
line through the level below the ground and the one above (or the two lowest,
extended down). The levels and the ground are read from his API's output; the
Surface rule is inferred from it (above). `scripts/schulzeCompare.live.ts`
logs both tables against his on every run (`aligned`, the default; and
`asSchulze`), and `#parity` shows them separately.

First live runs, 2026-10-08 near 02:46Z, for 03Z: the "As Schulze" table
matched his to 0° and 0 kt at every row, the Surface row included. A run a
minute earlier was 5° and 2 kt apart at 5,000 and 6,000 ft, the pattern of the
two being served different forecast runs (still open, above), which the logs
will now count for both tables.


## His raw-data view, his file, and his preset for this DZ (2026-10-08)

The page has two views besides its table: "Raw Winds Aloft Data" (each
pressure level at its height above ground) and "Show File" (the text export,
`ftAGL` header and all). Screenshots of both at 02Z on 2026-10-08, and his API
read at 03Z, settle three things that were inferred or assumed before.

- **The raw levels are Open-Meteo's, unaltered, in knots.** All twenty
  levels (1000 to 150 hPa) for eight hours (03Z to 00Z, every third hour) were
  set against Open-Meteo's own pressure-level output at the same point: the
  height of each was `(geopotential_height − elevation) × 3.28084`, rounded,
  every time, and all 160 level-hours matched in direction, in speed (whole
  knots) and in temperature. Open-Meteo works out direction per requested speed
  unit, so a km/h request and a knots request can differ by 1°; the knots
  request matched 160 of 160 and km/h 17. His QFE is Open-Meteo's
  `surface_pressure` for the hour (974.3 hPa at 03Z, both). One earlier read
  was 1° apart at most levels, against an Open-Meteo request made a few
  minutes before; read again together, the two agreed, so Open-Meteo's
  numbers had changed in between.
- **Between levels, his table is a straight line in height above ground.**
  The 39 rows of the 02Z file (0 to 38,000 ft) were rebuilt from the raw view's
  levels with `interpolateAsSchulze`: every direction matched to the degree;
  two speeds were 1 kt apart (9,000 and 20,000 ft), which is the raw view's
  whole-knot speeds, not his unrounded ones, being interpolated here. The
  Surface row (335° / 3 kt / 24 °C) fits the inferred rule, but that hour does
  not test it: 975 hPa sat 23 ft above his ground, so any rule gives the same.
- **His preset for this DZ is not quite the app's point.** His page's "Lincoln
  Sport Parachute Club" link reads its coordinates from `dropzones.geojson`:
  40.8675006, −96.11001, under a metre west of the app's 40.8675, −96.11.
  Open-Meteo puts its ground at 345 m (1,132 ft, his page's "Elevation") at
  his preset and at 349 m (1,145 ft) at the app's point: its terrain steps
  4 m between the two, likely a cell edge in its elevation model. Both fall
  in the same forecast cell and the winds are identical; only the ground his
  heights are measured from differs. The card's link to his page carries the
  app's point (`DATA_SOURCES.markschulze`), so a reader who follows it sees
  his table from 1,145 ft, the same ground as the "As Schulze" view; one who
  picks the club from his own list sees it from 1,132 ft, 13 ft lower. (The
  default table is measured from the published field elevation, 1,182 ft,
  as before.) `scripts/schulzeCompare.live.ts` asks his API for the app's
  point, so its logs compare like with like. Both points were in the field
  south-west of the runway, below it, not on the landing areas. Later the
  same day the app's point moved to the landing area by the pea gravel
  (40.8703, −96.1085), where Open-Meteo's ground is 1,165 ft; the
  comparison and the card's link follow it, his own list's pin does not
  (`docs/open-questions.md`).

## Which Surface row is nearer the measured wind (2026-10-08)

This app's Surface row runs below Schulze's in most logged hours (by about
3 to 5 kt between midnight and 9 AM local, under 1 kt at midday; `#parity`,
"The ground row"). Lower is not wrong in itself, since the two are different
heights; the question is which is nearer the wind a jumper meets on the
ground. Both were set against KPMV's reported wind (IEM's ASOS archive,
routine and special reports, mean of those within 30 minutes of the valid
hour), for every valid hour the comparison logs held both sides of the same
hour, with each side's median over that hour's runs, this side rounded to
whole knots as both pages show it (KPMV reports whole knots too):

| hours | n | KPMV median | this app: bias, mean abs error | Schulze: bias, mean abs error | nearer (this app, Schulze, tied) |
|---|---|---|---|---|---|
| all | 156 | 4.7 kt | +1.5, 2.1 kt | +3.5, 3.7 kt | 104, 23, 29 |
| night, 7 PM to 7 AM | 75 | 4.0 kt | +1.5, 2.1 kt | +4.4, 4.6 kt | 62, 7, 6 |
| day, 7 AM to 7 PM | 81 | 5.3 kt | +1.5, 2.1 kt | +2.6, 2.9 kt | 42, 16, 23 |
| 9 AM to 6 PM | 62 | 6.3 kt | +1.4, 2.2 kt | +2.2, 2.5 kt | 27, 15, 20 |

Both forecasts ran above the measured wind, the 10 m row by about 1.5 kt and
Schulze's by more, most at night, which fits his row reading like the wind a
couple of hundred feet up. What this does not settle: KPMV is 11.5 mi from
the DZ on different ground, a METAR's wind is a two-minute mean, and the hours
are those the comparison happened to log (most of them from the dense sampler,
2026-09-30 to 10-05), so it is a sample of two weeks of early autumn, not a
season. The Surface wind card reads the observation, not either forecast.

What the result does and does not say:

- This app's Surface row is not a figure it works out. It is Open-Meteo's
  own forecast of the wind at 10 m (33 ft), read as served and rounded to
  whole knots (since 2026-10-08 taken straight through `isSurface`; before
  that, at the old point, interpolated a few feet from it). 10 m is the
  height an airport wind sensor stands at, KPMV's included, so part of why
  it lands nearer is that it forecasts the same height that is measured.
- Schulze's Surface row is not wrong for being further off. It answers a
  different question: a straight line through the pressure levels read at
  the ground, which comes out nearer the wind a couple of hundred feet up.
  The gap is widest at night (62 hours to 7), when the air at the ground
  goes calm under moving air above, and narrowest in the jumping hours
  (27 to 15, with 20 ties).
- Both ran above the measured wind on average, the 10 m row by about 1.5 kt.
- Most of the 156 hours were logged at the point used until 2026-10-08, in
  the field south-west of the runway; none at the landing area yet.

To repeat it: take every Schulze record with `aligned` and `ground`, place
each on its valid hour (the run time rounded to the hour, checked against
`appHour`), take each side's median over that hour's runs (`ourShownKt`
where the record has it, else `ourKt` rounded; his `theirKt`), and set both
against the mean of KPMV's reports within 30 minutes of the hour from IEM's
archive (`mesonet.agron.iastate.edu/cgi-bin/request/asos.py?station=PMV&data=sknt`,
report types 3 and 4). It was run by hand from the scratchpad, not from a
script in this repository.
