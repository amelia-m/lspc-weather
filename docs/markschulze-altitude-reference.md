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
It samples 20 pressure levels to this app's 6, so small differences in the
middle of the profile are expected and are not a disagreement about the data.

Its `hourOffset` parameter and its "Forecast valid now / valid in about N
minutes" line are the equivalent of this app's valid-time note. When the two
tables differ, compare those before concluding the winds differ.

## Re-checking this

```
curl -H 'Referer: https://www.markschulze.net/winds/' \
  'https://www.markschulze.net/winds/winds_openmeteo.php?lat=40.8675&lon=-96.11&hourOffset=0&referrer=MSWA2024'
```

A bare request 403s; the site checks the referer. Compare `altFt[0]` against
`groundDir`/`groundSpd`/`groundTemp`, and `altFtRaw` against `groundElev`, as
above.
