# Ceiling heights: the NWS forecast against the METAR

The question from 2026-10-13, after the cloud-cover comparison
([cloud-cover-sources.md](cloud-cover-sources.md)) left height out: how
near is the forecast ceiling to the one KPMV reports? The Ceiling & sky
card shows the NWS gridpoint's `ceilingHeight` for each coming hour. This
page changes nothing on the dashboard. Counts and spreads, never a grade.

## What was compared

- **The NWS ceiling** is NDFD's ceiling grid (WMO header YMUZ98, the public
  archive at noaa-ndfd-pds.s3.amazonaws.com, `wmo/cig/`). On 2026-10-13
  api.weather.gov's `ceilingHeight` at the drop zone served the same
  values, in metres, as the latest file at the drop zone's grid point, for
  every hour of its next day. The grid's -29 is "no ceiling" (the API's
  null). Read as the cloud-cover comparison reads sky cover: the last file
  in each of 00, 06, 12 and 18 Z, at the drop zone's grid point and at
  KPMV's, April 1 to October 9 2026. For each hour, the newest issuance at
  least 0, 6 or 24 hours before it. The card reads the API, which updates
  about hourly, so its lead is shorter than the "latest issuance" row's.
- **Open-Meteo** has no ceiling or cloud-base figure here: its `cloud_base`
  came back null, unit "undefined", at the drop zone on 2026-10-13. Its low
  band (up to 3 km) is the nearest it has to a height, so it is read by
  the band of the ceiling KPMV reported.
- **KPMV's ceiling** is its lowest BKN, OVC or VV base. A ceiling layer
  with no height (`BKN///`) leaves the hour out. Each top of the hour takes
  the report nearest it within 10 minutes, as before.

Both sides are held at or below 12,000 ft: KPMV, an AWOS, reports nothing
higher, so a forecast ceiling above that counts as none. The grid stores
whole metres (500 ft is 152 m, 498.7 ft), so its heights are rounded to
the nearest 10 ft, which brings each whole hundred back to itself. Heights are ft
AGL. The bands are the FAA flight-category ceiling limits (AIM 7-1-7,
`flightCategory.ts`): LIFR under 500 ft, IFR 500 to under 1,000, MVFR
1,000 to 3,000, VFR above 3,000 (here, up to 12,000). The records are
`data/parity/ceiling-2026-04-01-to-2026-10-09.jsonl.gz` (fetched with
`PARTS=cig` and SITES for the two points); the reports and Open-Meteo's
bands are the cloud-cover archive's.
`npx tsx scripts/ceilingSummary.ts data/parity/ceiling-2026-04-01-to-2026-10-09.jsonl.gz
data/parity/cloud-cover-2026-04-01-to-2026-10-09.jsonl.gz` prints the
tables below; the arithmetic is `src/domain/ceilingHeights.ts`.

## The NWS ceiling at the drop zone (the card's point)

| Issuance | Hours | Lead (h) | Both a ceiling | Forecast only | Reported only | Neither | Same band | Forecast − reported (ft): median, 10th–90th | Median size |
|---|---|---|---|---|---|---|---|---|---|
| NWS, latest issuance | 4475 | 0.9–12.2 | 899 | 309 | 397 | 2870 | 77% | 100, -3100 to 2400 | 700 |
| NWS, 6 h or more ahead | 4470 | 6.2–17.2 | 884 | 320 | 412 | 2854 | 76% | 0, -3000 to 2400 | 700 |
| NWS, 24 h or more ahead | 4137 | 24.2–30.2 | 715 | 279 | 461 | 2682 | 75% | 200, -3200 to 3600 | 1170 |

Forecast − reported (ft), median, by the reported ceiling's band (hours both had a ceiling):

| Issuance | LIFR | IFR | MVFR | VFR |
|---|---|---|---|---|
| NWS, latest issuance | 300 (n 136) | 200 (n 146) | -200 (n 244) | -1100 (n 373) |
| NWS, 6 h or more ahead | 300 (n 138) | 200 (n 147) | -200 (n 238) | -1200 (n 361) |
| NWS, 24 h or more ahead | 785 (n 104) | 335 (n 126) | 115 (n 198) | -800 (n 287) |

Forecast − reported (ft), median, by the forecast ceiling's band (hours both had a ceiling):

| Issuance | LIFR | IFR | MVFR | VFR |
|---|---|---|---|---|
| NWS, latest issuance | 100 (n 40) | 100 (n 210) | -100 (n 289) | 100 (n 360) |
| NWS, 6 h or more ahead | 100 (n 41) | 100 (n 212) | -140 (n 281) | 200 (n 350) |
| NWS, 24 h or more ahead | 0 (n 13) | 0 (n 139) | 200 (n 247) | 1315 (n 316) |

**NWS, latest issuance**, hours by band (rows: KPMV reported; columns: forecast)

| Reported \ Forecast | LIFR | IFR | MVFR | VFR | none | Same band |
|---|---|---|---|---|---|---|
| LIFR | 35 | 67 | 29 | 5 | 13 | 23% of 149 |
| IFR | 2 | 83 | 49 | 12 | 23 | 49% of 169 |
| MVFR | 3 | 49 | 145 | 47 | 78 | 45% of 322 |
| VFR | 0 | 11 | 66 | 296 | 283 | 45% of 656 |
| none | 1 | 5 | 42 | 261 | 2870 | 90% of 3179 |

**NWS, 6 h or more ahead**, hours by band (rows: KPMV reported; columns: forecast)

| Reported \ Forecast | LIFR | IFR | MVFR | VFR | none | Same band |
|---|---|---|---|---|---|---|
| LIFR | 35 | 71 | 26 | 6 | 11 | 23% of 149 |
| IFR | 2 | 84 | 47 | 14 | 22 | 50% of 169 |
| MVFR | 3 | 46 | 141 | 48 | 84 | 44% of 322 |
| VFR | 1 | 11 | 67 | 282 | 295 | 43% of 656 |
| none | 2 | 8 | 53 | 257 | 2854 | 90% of 3174 |

**NWS, 24 h or more ahead**, hours by band (rows: KPMV reported; columns: forecast)

| Reported \ Forecast | LIFR | IFR | MVFR | VFR | none | Same band |
|---|---|---|---|---|---|---|
| LIFR | 8 | 41 | 36 | 19 | 30 | 6% of 134 |
| IFR | 4 | 57 | 49 | 16 | 24 | 38% of 150 |
| MVFR | 1 | 35 | 111 | 51 | 91 | 38% of 289 |
| VFR | 0 | 6 | 51 | 230 | 316 | 38% of 603 |
| none | 0 | 3 | 44 | 232 | 2682 | 91% of 2961 |

## The distributions behind the medians

Asked 2026-10-13, after the medians by the forecast's band came out one
100 ft step from zero: what do the differences look like whole? Drop
zone's grid point, latest issuance; `scripts/ceilingSummary.ts` prints
the same for every issuance and for KPMV's point
(`diffDistribution`, `src/domain/ceilingHeights.ts`). The ratio column
is forecast ÷ reported. Percentiles are nearest-rank, but the median is
taken as every other table here takes it (the middle two averaged), so
the two agree.

**NWS, latest issuance**, what KPMV reported, by the forecast's band (each row: shares of that band's hours)

| Forecast | Hours | Reported LIFR | Reported IFR | Reported MVFR | Reported VFR | Reported none |
|---|---|---|---|---|---|---|
| LIFR | 41 | 85% | 5% | 7% | 0% | 2% |
| IFR | 215 | 31% | 39% | 23% | 5% | 2% |
| MVFR | 331 | 9% | 15% | 44% | 20% | 13% |
| VFR | 621 | 1% | 2% | 8% | 48% | 42% |
| none | 3267 | 0% | 1% | 2% | 9% | 88% |

**NWS, latest issuance**, forecast − reported (ft), by the forecast's band (hours both had a ceiling)

| Band | Hours | 10th | 25th | Median | 75th | 90th | Forecast ÷ reported, 25th–median–75th |
|---|---|---|---|---|---|---|---|
| LIFR | 40 | -400 | 0 | 100 | 200 | 200 | 1–1.5–2 |
| IFR | 210 | -1100 | -300 | 100 | 300 | 400 | 0.69–1.14–1.6 |
| MVFR | 289 | -4300 | -1000 | -100 | 600 | 1100 | 0.65–0.94–1.67 |
| VFR | 360 | -4100 | -2000 | 100 | 2400 | 4900 | 0.79–1.02–1.59 |

Share of those hours by size of the difference ("low": forecast below the report):

| Band | more than 3,000 low | 1,000 to 3,000 low | 500 to 1,000 low | 100 to 500 low | within 100 | 100 to 500 high | 500 to 1,000 high | 1,000 to 3,000 high | more than 3,000 high |
|---|---|---|---|---|---|---|---|---|---|
| LIFR | 0% | 0% | 8% | 5% | 60% | 28% | 0% | 0% | 0% |
| IFR | 2% | 8% | 7% | 18% | 24% | 40% | 2% | 0% | 0% |
| MVFR | 12% | 12% | 7% | 18% | 9% | 15% | 16% | 10% | 0% |
| VFR | 14% | 19% | 7% | 6% | 4% | 4% | 6% | 20% | 19% |

**NWS, latest issuance**, forecast − reported (ft), by KPMV's reported band (hours both had a ceiling)

| Band | Hours | 10th | 25th | Median | 75th | 90th | Forecast ÷ reported, 25th–median–75th |
|---|---|---|---|---|---|---|---|
| LIFR | 136 | 100 | 200 | 300 | 600 | 1190 | 1.5–2–3.25 |
| IFR | 146 | -100 | 0 | 200 | 600 | 1800 | 1–1.4–1.83 |
| MVFR | 244 | -900 | -500 | -200 | 700 | 2400 | 0.68–0.9–1.39 |
| VFR | 373 | -5500 | -3000 | -1100 | 700 | 2900 | 0.57–0.84–1.12 |

Share of those hours by size of the difference ("low": forecast below the report):

| Band | more than 3,000 low | 1,000 to 3,000 low | 500 to 1,000 low | 100 to 500 low | within 100 | 100 to 500 high | 500 to 1,000 high | 1,000 to 3,000 high | more than 3,000 high |
|---|---|---|---|---|---|---|---|---|---|
| LIFR | 0% | 0% | 0% | 1% | 21% | 51% | 16% | 8% | 4% |
| IFR | 0% | 0% | 0% | 10% | 32% | 32% | 10% | 12% | 5% |
| MVFR | 0% | 9% | 14% | 29% | 11% | 9% | 7% | 12% | 9% |
| VFR | 24% | 26% | 8% | 7% | 4% | 4% | 5% | 12% | 9% |

- **The medians sit near zero; the spread does not.** By the forecast's
  band, the middle half of the differences ran 0 to +200 ft under 500 ft,
  -300 to +300 from 500 to under 1,000, -1,000 to +600 from 1,000 to
  3,000, and -2,000 to +2,400 above 3,000. A forecast ceiling above
  3,000 ft missed by more than 1,000 ft, one way or the other, on 72% of
  the hours both had one, and was within 100 ft on 4%.
- **The miss grows with the height, roughly in proportion.** As a ratio
  the middle half reads alike from 500 ft up: the forecast was about 0.65
  to 1.6 times the reported height in the IFR, MVFR and VFR bands. Under
  500 ft (40 hours) its middle half ran 1 to 2 times, the forecast at or
  above the report.
- **When the forecast said IFR, the report was lower 31% of the time.**
  Of 215 hours with a forecast ceiling from 500 to under 1,000 ft, KPMV
  reported one under 500 ft on 67. A forecast under 500 ft was itself
  borne out on 35 of 41 hours (85%), but there were few of them.
- **A forecast ceiling above 3,000 ft came with no reported ceiling on
  42% of its hours**, and a forecast of none with a reported ceiling on
  12% (9% above 3,000 ft).
- **Grouped by what was reported, the shape leans** as the medians did:
  under 500 ft, 79% of the forecasts were more than 100 ft above the
  report and 1% more than 100 ft below (a 300 ft report cannot be missed
  downward by more than 300 ft); above 3,000 ft, 50% were more than
  1,000 ft below it.
- **A day ahead** the medians by the forecast's band were 0, 0, +200 and
  +1,315 ft, and the middle half above 3,000 ft ran -1,300 to +3,300.
- **At KPMV's own grid point** the medians and quartiles by the
  forecast's band moved by 200 ft at most, the 10th percentile by up to
  800 ft (-4,300 to -3,500 in the MVFR band).

## The chart

The tables above, and the same for every issuance and both grid points,
are drawn on one page on the dashboard's own site:
<https://amelia-m.github.io/lspc-weather/ceiling-errors/>, linked from
the dashboard's footer ("Ceiling forecast errors"), which points at the
file, `ceiling-errors/index.html`, since `npm run dev` answers the bare
folder with the dashboard (Pages serves the page for both). Its source is
`public/ceiling-errors/`: `index.html`, its script `chart.js` and the
data file, which Vite copies to the site as they are. The page carries a
Content-Security-Policy narrowed from the dashboard's (`vite.config.ts`):
its own script and data only, no inline script, no other host; it uses
the dashboard's system font. Since 2026-10-16; before that it was a
private claude.ai artifact that only the maintainer could open, deleted
on 2026-10-17 once the site's page had everything it held
(docs/open-questions.md). It has three charts, all from one data
file: hours by size of the difference (a diverging bar, forecast below
the report to the left), the spread in ft or as forecast ÷ reported on
a doubling scale, and the other side's bands for each band. Its controls
choose the grid point, the issuance and which side's band groups the
hours, and a table view repeats every figure. Since 2026-10-17 a
fourth section, with controls of its own, scores the kept forecasts'
hourly rain and thunder chances against KPMV's reports
(docs/forecast-chances.md); the data file carries them as `chances`,
written whenever the kept snapshots hold any. Since 2026-10-16, at the
maintainer's request, the spread is a raincloud per band in place of a
box plot: a density curve scaled to its own peak, the 10th to 90th
percentile line, middle half and median on its base, and every hour as a
dot beneath. A raincloud rather than a violin because the dots stay in
view, which matters where a band has a handful of hours (the kept
source's do); under 5 hours (`DENSITY_MIN_N`) a band shows its dots and
no curve. The curves are `densityCurve` (`src/domain/ceilingHeights.ts`,
tested): a Gaussian kernel at Silverman's bandwidth, never narrower than
50 ft, or in log2 of the ratio 0.1, since the reports come in 100 ft
steps and a narrower kernel draws each step as a spike. The data file
(version 2, about 340 KB) carries each band's values and curves; the
page computes only its axis, from the 5th to the 95th percentile of all
the points shown, pooled (a wider one squeezed the low bands to a
sliver), and counts the points past it at the edges. Curves are sampled
no wider than half their bandwidth, so no peak falls between samples.
The file is written one key a line with each array of numbers on one
line, so a regenerated file diffs by field. `tests/ceilingErrorsPage.test.ts`
holds the page, its script and its data to each other (the footer link,
the data version, every band's hours), and checks the policy refuses
inline script and other hosts and that no address appears outside a
plain link; each was broken once to see it fail. Checked on the built
site at 1,280, 390 and 320 px, and on the dev server, on 2026-10-16 by
following the footer link and back, with no policy violation logged; at
320 px a legend entry that would not wrap made the page scroll
sideways, and the first chart's axis labels ran together, both fixed
then. Deployed the same day: the page, `chart.js` and the data file
answered 200 from amelia-m.github.io (fetched with curl, which the
sandbox can do; its browser still cannot load the live site), and the
deployed dashboard's script carries the footer link. On 2026-10-17 the
maintainer asked why the text stopped short of the chart panels: its
paragraphs keep a readable measure, about 68 characters a line. They
keep it; instead, at 1,280 px and wider the method notes sit in a column
beside the charts (about 50 characters a line), and below them on a
narrower screen; the charts' one- or two-sentence subtitles run the
panel's full width. Checked at 1,500, 1,280, 1,100, 390 and 320 px: no
sideways scroll, the charts redrawn to their column's width. While it was an
artifact, on 2026-10-16 the maintainer saw a blank page at its link. The served files
were read back the same day: `index.html` is the repository's page,
byte for byte, inside the artifact's wrapper, with `ceiling-errors.json`
beside it, and the served page, rendered in Playwright's Chromium with
that file, drew all three charts at 1,100 px light and 390 px dark and
light, with the kept source and a saved view restored, and logged no
script error. The page draws its header without any script, so a fully
blank frame points at the viewer rather than the page's code. It was
opened in the Claude desktop app; the same link in a web browser at
claude.ai showed the page whole (the maintainer's screenshot, dark
theme, all three sources on the control), so the blank was the desktop
app's view of it. Later the same day, after the raincloud version was
published, the maintainer saw the page whole in the desktop app's side
panel too, so the blank did not last; nothing in the page changed to
fix it. A browser at claude.ai is the fallback if it recurs.

The data file is `public/ceiling-errors/ceiling-errors.json`, written by
`scripts/ceilingChartData.ts` from the same archives and the same
functions as `scripts/ceilingSummary.ts` (`summarizeCeilings`,
`diffDistribution`), so the chart and the tables above agree.

**Kept current by a workflow, since 2026-10-17.**
`.github/workflows/ceiling-data-refresh.yml` runs every Monday at 07:41Z
and on dispatch. It fetches the NDFD ceilings at both grid points and
KPMV's reports for the days since the newest record already kept, keeps
both under `data/parity/`, rebuilds the data file from every archive and
the keeper's snapshots on `forecast-archive`, commits them to `main` and
dispatches the Pages deploy. It dispatches the deploy itself because a
push made with the workflow token starts no other workflow, as in
`parity-summary.yml`. Since 2026-10-23 the same run also rebuilds the
`#wind-errors` page's file from the same snapshots and reports
(docs/kept-forecasts-vs-kpmv.md, "The spread, drawn"), held to the
published file the same way, and fetches Open-Meteo's archived 10 m wind
for its Open-Meteo section from the newest hour kept, on the same window
rule (`omWindNewest`: the earlier of its two runs' newest;
docs/surface-wind-sources.md, "Open-Meteo's archive"). A wind-side
failure (no Open-Meteo archive to start from, its fetch, or the rebuild)
leaves the page's wind file as published and does not hold back the
ceiling commit; a last step then fails the run. The steps that need more than a shell line are
`scripts/ceilingRefresh.ts`; the rules are `src/domain/ceilingRefresh.ts`,
pure, and tested in `tests/ceilingRefresh.test.ts`. Each test was seen to
fail with the behaviour it names broken (21 breaks, one at a time,
2026-10-17).

- **Which files.** `--ceiling` takes every
  `ceiling-<start>-to-<end>.jsonl.gz` under `data/parity/`, and
  `--cover` every `cloud-cover-…` and `metar-…` file named for a window
  the same way (`chartInputs`). The pattern leaves out
  `cloud-cover-stations-*`, whose METARs all carry a `site` the chart
  skips (5.5 MB read for nothing), and the reports and logs beside them.
  A test holds the published file's `sources` to exactly this list, so a
  file rebuilt by hand from fewer archives fails `npm test`.
- **Which days.** Each part starts on the UTC day of its newest record
  already kept: the newest NDFD issuance for the ceilings, the newest
  KPMV report for the METARs. It is read from the records, not the file
  names. A name says what was asked for, not what came back:
  `metar-2026-10-15-to-2026-10-17.jsonl.gz` holds reports to 2026-10-16
  23:55Z. Starting on that day re-reads at most one day, and a line found
  in two files counts once, so overlapping windows are harmless; starting
  after a name's end could skip the rest of a day fetched part-way, for
  good. Both parts end on the last whole UTC day before the run. NOAA
  writes two ceiling files an hour, at :16 and :46 (48 for October 16,
  about 16 MB each, in the archive's listing read 2026-10-17), and the
  fetch takes the last one in each issue hour (00, 06, 12, 18Z). A fetch
  made between the two would take the :16 file, and a later fetch of the
  same day the :46, so that day would count two issuances for one hour.
  Fetching whole days only, each day is read in its final form, and the
  day re-read in the overlap gives the same lines: on 2026-10-17 the
  re-read of
  October 16 gave its 240 ceiling lines and 72 reports exactly as kept.
  A part whose newest record is already on the last whole day is not
  fetched. With neither to fetch, the run stops there and commits
  nothing. A missed week is caught up by the next run, whose window is
  then two weeks.
- **When a fetch fails or brings nothing.** `cloudCoverFetch.py` exits
  non-zero when a request still fails after its retries (about ten
  minutes of them), and the run fails. Each fetch writes outside the
  repository and moves into `data/parity/` only when it holds a record
  newer than the newest kept. A window of whole days with none means the
  source failed, and the run fails. A day of the window with nothing at
  all is a warning on the run's page, not a failure: the next window
  starts after it, so failing on it would stop every later run on a gap
  no rerun can fill. The rebuilt file must then hold at least what the
  published one does (`shrinkage`): every source it named, as many kept
  snapshots, reports and issuances, reports to as late a time, and as
  many hours in every row of every point and of the chances. Adding
  reports or forecasts only adds hours, so a fall means a file went
  missing or came back short; the run fails and names each shortfall.
  `npm test` runs on the result before anything is committed. A run that
  fails commits nothing.
- **Only on `main`.** Only a run on `main` commits and deploys, and the
  schedule always runs there. A run dispatched on another branch fetches
  and rebuilds from that branch's files and scripts, as a trial, and
  keeps what it made as an artifact for seven days; it commits and
  dispatches nothing. Before pushing, the commit is rebased onto `main`
  as it then is, so a commit made while the fetch ran does not reject
  the push; a conflict (the data file rebuilt by hand meanwhile) fails
  the run.
- **Repository growth.** A week is about 7 KB of ceilings
  (`ceiling-2026-10-10-to-2026-10-17.jsonl.gz`, 28 issuances at two
  points, 1,680 lines, is 6.9 KB) and about 8 KB of reports
  (`metar-2026-10-10-to-2026-10-15.jsonl.gz`, 410 reports, is 6.4 KB):
  about 15 KB a week, under 1 MB a year, against a repository GitHub
  gave as 15.7 MB (the API's `size`, read 2026-10-17; 15,715 KB again
  on 2026-10-20). The first scheduled run, 2026-10-19, covered two days
  and added 6.1 KB. Measured on 2026-10-20 in a full mirror clone, by
  the packed size of the objects each commit range adds (`git rev-list
  --objects … | git cat-file --batch-check='%(objectsize:disk)'`), the
  whole repository, every branch, was 16.0 MB. What grows it on its own:
  the `forecast-archive` branch, 4.2 KB a snapshot over the 74 hourly
  snapshots from 2026-10-17 (before then it ran every few hours), about
  37 MB a year; and the workflows' commits to `main` (the parity summary
  and archive, this refresh), 0.12 MB in the week to 2026-10-20, about
  6 MB a year. That is about 43 MB a year, or 23 years to reach the
  1 GB GitHub recommends a repository stay under (its "about large
  files" page as remembered: docs.github.com is not reachable from the
  sandbox, so not read here). The week to 2026-10-20
  as a whole, the sessions' own commits included, added 1.4 MB (about
  14 years at that rate). What moves it is one-off data: the week to
  2026-10-13 added 10.9 MB, nearly all a 5 MB station cloud-cover
  archive committed twice and a 3 MB photo of the waiver sign. The data file
  changes in its long lines of values and curves: adding 17 hours on
  2026-10-17 changed 134 of its lines, a 15 KB diff (2.3 KB gzipped),
  while the file grew by 96 bytes, since only hours with a ceiling on
  both sides add values. So one commit of each a
  week is kept as it is. The weekly files are not merged into one
  archive: each stays as its fetch returned it, and the names in
  `sources` say what each build read.

To do the same by hand: fetch with `PARTS=cig
SITES="DZ:40.8703:-96.1085,PMV:40.9484:-95.9174" python3
scripts/cloudCoverFetch.py <start> <end>
data/parity/ceiling-<start>-to-<end>.jsonl.gz` and `PARTS=metar python3
scripts/cloudCoverFetch.py <start> <end>
data/parity/metar-<start>-to-<end>.jsonl.gz` (no SITES, so the records
keep the drop-zone archive's shape), with the days
`npx tsx scripts/ceilingRefresh.ts window` prints; then run
`scripts/ceilingChartData.ts` on the files
`npx tsx scripts/ceilingRefresh.ts inputs ceiling` and `… inputs cover`
list, with `--kept` as below, and merge to `main`. The page also has a
file picker that shows a newer `ceiling-errors.json` in one browser
without a deploy.

**Checked from the sandbox, 2026-10-17, before the workflow first ran
on GitHub.** Every `run:` step of the workflow was run in a scratch copy
of the repository, on a branch ref, with the setup actions skipped, the
forecast archive extracted in place of the worktree step, and the window
step given a clock of 2026-10-18 05:00Z. On the real clock it found both
parts current (newest issuance 2026-10-16 18:47Z, newest report 23:55Z
that day) and stopped, as it should a day after a hand fetch. With the
later clock it fetched October 16 to 17: 7 NDFD files, 420 records, 180
of them newer than the newest kept; 126 reports, 54 newer. The rebuilt
file read 41 kept snapshots (published: 25) and 13,989 reports to
2026-10-17 17:55Z (13,935 to 2026-10-16 23:55Z); the drop zone's rows
held 4,661, 4,656 and 4,317 hours (4,643, 4,638, 4,302), the kept
source's 99, 93 and 74 (81, 75, 56), the chances 98, 92 and 74 (80, 74,
56). The shrinkage check passed and `npm test` passed on it. The
failure paths were run too: the two files swapped, the check named 23
shortfalls and exited 1; a fetch with nothing newer, and an empty one,
each exited 1. `actionlint` 1.7.7 found nothing in the workflow
(without shellcheck, which is not installed here). Not run: anything on
GitHub, so the commit, rebase, push and deploy dispatch are untried. The
files fetched in the check were not committed, since they held part of
October 17, which a run on `main` would not fetch.

### The forecasts the card read, kept hourly

Since 2026-10-15 the data file also takes the snapshots
`scripts/forecastKeep.ts` commits to the `forecast-archive` branch
(docs/open-questions.md, "Forecasts kept for later"): api.weather.gov's
own `ceilingHeight` at the drop zone, as the card fetched it. They are a
third source on the chart's "Forecast read at" control ("Drop zone, as
the card read it"), never merged into the NDFD rows. Each snapshot's
hours are issued at its `updateTime`, the hour the forecast was made, as
an NDFD file's are at its issue time (`keptCeilingRecords`,
`src/domain/ceilingHeights.ts`); the API's null is no ceiling.

```
git fetch origin forecast-archive
git worktree add --detach <dir> origin/forecast-archive
npx tsx scripts/ceilingChartData.ts \
  --ceiling data/parity/ceiling-2026-04-01-to-2026-10-09.jsonl.gz \
    data/parity/ceiling-2026-10-10-to-2026-10-17.jsonl.gz \
  --cover data/parity/cloud-cover-2026-04-01-to-2026-10-09.jsonl.gz \
    data/parity/metar-2026-10-10-to-2026-10-15.jsonl.gz \
    data/parity/metar-2026-10-15-to-2026-10-17.jsonl.gz \
  --kept <dir>/data --out public/ceiling-errors/ceiling-errors.json
```

That is the file as published on 2026-10-17 (its `sources` field lists
what it was built from). The weekly refresh runs the same command with
every dated archive under `data/parity/` (`chartInputs`, above), so each
run adds its new files to these.

`--kept` takes files or folders. KPMV's reports for the kept window are
`data/parity/metar-2026-10-10-to-2026-10-15.jsonl.gz` (`PARTS=metar`,
fetched 2026-10-15 at 16:45Z, 410 reports to 16:35Z) and
`data/parity/metar-2026-10-15-to-2026-10-17.jsonl.gz` (fetched 2026-10-17
at 00:11Z, 144 reports to 2026-10-16 23:55Z); the weekly refresh
fetches each later window beside them. The NDFD archive for the same days, at both
points, is `data/parity/ceiling-2026-10-10-to-2026-10-17.jsonl.gz`
(`PARTS=cig`, 28 files, issuances 2026-10-10 00Z to 10-16 18Z, fetched
2026-10-17); the chart's data file reads it beside the first, so its
NDFD rows now run to 2026-10-17 00Z (4,643 hours at the latest issuance
at the drop zone's point). The tables above are still the April to
October 9 archives alone.

An hour counts in a row only when the issuance that row would need for
it could have been in what was gathered: at most 6 hours
(`END_REACH_H`) past the source's last issuance, beyond the row's own
lead (`summarizeCeilings`, so every caller has it). Six hours is the
NDFD archive's spacing as read (four issuances a day) and the longest
gap between the keeper's runs seen. Without it, the new reports for
October 10 to 15 were scored against the NDFD archive's last issuance
(October 9, 18Z), up to 30 hours old, in its "latest issuance" row,
which grew from 4,475 to 4,500 hours. With it, that row was the same as
before to the figure, and the 6 h and 24 h rows held 6 and 24 more hours
than the tables above: October 10's hours, which the October 9
issuances do reach at those leads (before the October 10 to 17 archive
was added). The tables above, from the archives
alone, are unchanged by the rule (`ceilingSummary.ts` output compared
line for line on 2026-10-15). A gap between kept snapshots in the middle
of the series is not cut: its hours count, at the lead the gap gives
them, which the chart's lead range shows.

First figures, 2026-10-15, from 11 snapshots (2026-10-13 15:35Z to
2026-10-15 13:57Z updates) against KPMV to 16:35Z: 49 hours with the
newest kept forecast at most 6.4 hours old, 27 of them with a ceiling on
both sides, 43 at 6 hours or more ahead and 24 at 24 hours or more; 11
snapshots gave records (a snapshot whose fetch failed gives none and is
not counted). That
is two days and mostly one rainy spell, so the chart shows it but no
finding rests on it yet.

Read hour by hour on 2026-10-17, after the maintainer asked why this
source looks so unlike the other two: its 27 hours with a ceiling on both
sides are three spells, the evening of October 13 (5 hours, reported
2,000 to 2,200 ft, forecast 3,300 to 4,600), October 14 (5 hours,
reported 3,200 to 6,000, forecast 5,200 to 9,100) and one ceiling that
came down from 3,000 ft to 300 ft between 00Z and 16Z on October 15 (17
hours; the forecast came down with it, a step behind, a few hundred to
1,500 ft above). The forecast was above the report in 26 of the 27.
Consecutive hours of one spell are not independent, and its bands hold
1 to 15 hours, so its shares swing on single hours (the 500 to 999 ft
row's 100% is one hour). It is the same forecast as the NDFD grid (the
API matched it value for value, docs/open-questions.md); what differs is
which hours: two days of October against six months.

**Over the same hours, 2026-10-17.** `scripts/ceilingSameHours.ts` scores
both drop-zone sources by the same rules against the same reports and
matches them hour for hour (its output is
`data/parity/ceiling-same-hours-2026-10-13-to-2026-10-17.md`, with the
issuance each source was read from at each hour). At the latest
issuance the kept source had 81 hours (October 13 16Z to 17 00Z), and
the NDFD archive scored all 81 of them too: the same forecast ceiling in
59, and with a ceiling on all three sides (46 hours) a median NDFD −
kept of 0 ft. Against the report the median was +500 ft from NDFD and
+300 from the kept source. Of the 22 hours where they differ, the kept
source was read from the later issuance in 19: the API's forecast
updates between NDFD's four issuances a day, and the keeper took it
then. Through 14Z to 18Z on October 15 it said 400 to 600 ft (updated
13:57Z) against NDFD's 800 to 1,200 (12:46Z), with the report at 300 to
1,100. The other 3 are October 13 20Z and 21Z and October 15 08Z, when
the keeper ran only every 3 to 6 hours and its snapshot was older than
NDFD's issuance. At 6 and 24 hours ahead the sources agree as often
(56 of 75 and 41 of 56 hours alike, median NDFD − kept 0), but there
neither is mostly the later: the kept source in 11 of 19 and 9 of 15
differing hours. So the kept source looks unlike the six-month rows
because of the days it covers, not because it is another forecast; over
the same days the NDFD rows read much as it does.

**The page says so.** Since 2026-10-17 a plain line above the charts
names a row's hours and dates when they fall within 14 calendar days or
fewer (`sampleNote` in `public/ceiling-errors/note.js`, from each row's
first and last hour, `span`, in the data file): a few days are a few
weather spells at most, whose hours are not independent of each other,
so the shares describe those days. It is the days, not the hours, that
make a row a few spells, so a row of scattered hours over months gets no
note. Two weeks is the page's own line, not a published one; the note
sets no colour and grades nothing, and a row with no hours gets none.
Until 2026-10-16 GitHub ran the keeper every 3 to 6 hours; since then
hourly.

## The NWS ceiling at KPMV's own grid point

The same reports, with the forecast read at the grid point nearest KPMV's
coordinates (40.9484, -95.9174, the FAA's), 1.08 km from them, instead of
at the drop zone's, about 11.5 miles away. This takes the distance between
forecast and station out of the comparison.

| Issuance | Hours | Lead (h) | Both a ceiling | Forecast only | Reported only | Neither | Same band | Forecast − reported (ft): median, 10th–90th | Median size |
|---|---|---|---|---|---|---|---|---|---|
| NWS, latest issuance | 4475 | 0.9–12.2 | 909 | 297 | 387 | 2882 | 77% | 100, -3200 to 2600 | 800 |
| NWS, 6 h or more ahead | 4470 | 6.2–17.2 | 901 | 316 | 395 | 2858 | 76% | 100, -3100 to 2600 | 700 |
| NWS, 24 h or more ahead | 4137 | 24.2–30.2 | 717 | 282 | 459 | 2679 | 74% | 300, -3200 to 3400 | 1170 |

Forecast − reported (ft), median, by the reported ceiling's band (hours both had a ceiling):

| Issuance | LIFR | IFR | MVFR | VFR |
|---|---|---|---|---|
| NWS, latest issuance | 300 (n 138) | 200 (n 151) | -100 (n 246) | -1200 (n 374) |
| NWS, 6 h or more ahead | 300 (n 140) | 200 (n 148) | -200 (n 245) | -1100 (n 368) |
| NWS, 24 h or more ahead | 700 (n 109) | 300 (n 123) | 300 (n 205) | -700 (n 280) |

Forecast − reported (ft), median, by the forecast ceiling's band (hours both had a ceiling):

| Issuance | LIFR | IFR | MVFR | VFR |
|---|---|---|---|---|
| NWS, latest issuance | 100 (n 41) | 100 (n 214) | 0 (n 281) | 300 (n 373) |
| NWS, 6 h or more ahead | 100 (n 37) | 100 (n 225) | -100 (n 278) | 200 (n 361) |
| NWS, 24 h or more ahead | 0 (n 16) | 70 (n 135) | 300 (n 242) | 1385 (n 324) |

**NWS, latest issuance**, hours by band (rows: KPMV reported; columns: forecast)

| Reported \ Forecast | LIFR | IFR | MVFR | VFR | none | Same band |
|---|---|---|---|---|---|---|
| LIFR | 38 | 71 | 24 | 5 | 11 | 26% of 149 |
| IFR | 2 | 85 | 52 | 12 | 18 | 50% of 169 |
| MVFR | 1 | 46 | 147 | 52 | 76 | 46% of 322 |
| VFR | 0 | 12 | 58 | 304 | 282 | 46% of 656 |
| none | 0 | 6 | 44 | 247 | 2882 | 91% of 3179 |

- **Ceiling or not:** a ceiling on 909 of the 1,296 hours KPMV reported
  one (70%), and on 297 of the 3,179 it reported none (9%). At the drop
  zone's point, 69% and 10%.
- **How high, both a ceiling:** median +100 ft, half within 800 ft (700
  at the drop zone's), 10th to 90th percentiles -3,200 to +2,600 ft.
- **By the forecast's band:** +100, +100, 0 and +300 ft (at the drop
  zone's point +100, +100, -100 and +100). Near the mark in every band
  again.
- **Very low ceilings:** the forecast put one under 500 ft on 41 hours,
  against 149 reported, the same count as at the drop zone's point.
- **A day ahead:** where it gave a ceiling above 3,000 ft, the reported
  one was a median 1,385 ft lower (1,315 at the drop zone's).

So the 11.5 miles between the drop zone and KPMV account for little of
the difference between the forecast and the report: at KPMV's own point
the counts move by up to 17 of about 4,500 hours and the medians by up to
200 ft, not consistently in one direction.

## Open-Meteo's bands, by the ceiling KPMV reported

| Reported ceiling | Hours | Low band ≥ 5/8 | Mid band ≥ 5/8 | Total ≥ 5/8 |
|---|---|---|---|---|
| LIFR | 149 | 93% | 28% | 93% |
| IFR | 169 | 93% | 29% | 93% |
| MVFR | 322 | 92% | 22% | 94% |
| VFR | 657 | 40% | 38% | 61% |

## What it shows

- **Whether there is a ceiling.** With the latest issuance, the forecast
  had one on 899 of the 1,296 hours KPMV reported one (69%), and on 309 of
  the 3,179 hours it reported none (10%). The cloud-cover test (sky cover at
  or above 5/8, cloud-cover-sources.md) caught a few more ceilings (73%) at
  twice the hours without one (20%).
- **How high, when both had one.** The median difference was +100 ft, and
  half the hours were within 700 ft; the 10th to 90th percentiles ran from
  3,100 ft too low to 2,400 ft too high.
- **Read by the forecast's own figure, the median was near the mark in
  every band, and the spread around it was not.** Grouped by the band
  the forecast gave, the median difference was +100 ft under 500 ft,
  +100 from 500 to under 1,000, -100 from 1,000 to 3,000 and +100 above
  3,000: one 100 ft step. That is the grouping a reader of the card's
  figure is in. The middle half of the differences widened from 200 ft
  under 500 ft to 4,400 ft above 3,000, about in proportion to the
  height (see "The distributions behind the medians").
- **Grouped by what KPMV reported, it looks biased, and that is mostly
  the grouping.** By the reported band the medians are +300, +200, -200
  and -1,100 ft. Sorting hours by the observed value does this to any
  forecast with errors: a reported 300 ft ceiling can be missed upward by
  thousands of feet but downward by 200 at most, and above 3,000 ft the
  12,000 ft cap removes forecasts that ran higher. The medians are stable
  (a by-hand resampling on 2026-10-13, 2,000 draws, put the under-500 ft
  one's 90% interval at 300 to 300) and round because both sides come in 100 ft steps: every reported
  base is a whole hundred, and 93% of the forecast heights were within
  2 ft of one before the 10 ft rounding.
- **What the grouping does show: the forecast seldom goes very low.**
  KPMV reported a ceiling under 500 ft on 149 hours; the forecast put one
  there on 41, 35 of them on those hours. Of the 149, it put 67 at 500 to
  1,000 ft, 29 at 1,000 to 3,000, 5 above and 13 at none.
- **Six hours ahead reads much as the latest issuance does; a day ahead,
  less closely.** At 24 hours or more ahead the median size of the
  difference grew from 700 to 1,170 ft, the forecast put 8 of 134
  sub-500 ft ceilings in that band, and where it gave a ceiling above
  3,000 ft the reported one was a median 1,315 ft lower.
- **KPMV's own grid point reads almost the same** as the drop zone's;
  see the section above.
- **Open-Meteo's low band at or above 5/8** was there on 92 to 93% of the
  hours KPMV reported a ceiling of 3,000 ft or lower, and on 40% of those
  with one above 3,000 ft (its mid band on 38%). It marks a low
  ceiling as likely without saying whether it is at 400 or 2,500 ft.

## What this does not say

- **Season.** April to early October at one station, as before.
- **The card's lead.** The rows here are four issuances a day; the card
  reads an API that updates about hourly.
- **Distance.** KPMV is about 11.5 miles from the drop zone. The forecast
  at the two grid points reads almost alike against KPMV's reports, but
  nothing here measures the sky over the drop zone itself.
