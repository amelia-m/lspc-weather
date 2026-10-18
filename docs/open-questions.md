# Open questions and follow-ups

Live backlog. Closed items should be deleted rather than marked done — the
repository history is the record.

## Needs a human with a document

These cannot be settled from the code.

1. **Which 105.17 visibility row the flag should use.** The visibility flag
   fires below 3 SM, the section's row for jumps below 10,000 ft MSL. Brown's
   is at 1,182 ft MSL, so a 10,000 ft AGL exit is in the other row: 5 SM and
   1 mile from cloud. The reading is the METAR's surface visibility and the
   reg's measure is flight visibility at altitude, so the flag stays on the
   lower row and prints both (read through the eCFR 2026-09-23; A8 on the
   #citations page). Whether a surface reading should be held to the 5 SM row
   is a call for the S&TA and the PIC, not for this code.

2. **The claims still need an instructor, not another reading.** Every USPA,
   CFR and FAA citation has now been read at its source — the SIM at uspa.org
   on 2026-09-22; 14 CFR 105.17 and 105.19, AIM 7-1-7 and FAA-P-8740-2 on
   2026-09-23 — and the claims corrected against them, so the section numbers
   are no longer guesses. The club's posted tiers are a transcription of an
   undated photo of the sign, which no reading can improve on. What a reading
   could not settle is on the #citations page as each entry's "Please confirm"
   list — among them whether rounding the 14 mph student limit *down* to 12 kt
   is the right direction for a limit a jumper reads off a card (A1), and
   whether the club's posted waiver tiers have been filed as a SIM 2-2 waiver
   (A5). The page takes the answers in place — a verdict per claim, yes / no /
   not sure and a note per question, kept in the browser — and sends them as a
   prefilled GitHub issue or as copied text. The next step is an instructor or
   S&TA working through it. The maintainer asked on 2026-10-09 not to be
   asked about the verdicts again for a week: raise it no sooner than
   2026-10-16.

3. **The app's own thresholds, for an instructor's judgement rather than a
   lookup.** Part B of the citations page — currently one entry, the 25 kt
   licensed bar scale, which triggers nothing and only sets how long a bar is
   drawn.

## Watch: a change document for the 2026 SIM

USPA revises the online SIM within an edition through change documents,
listed on https://www.uspa.org/sim under "Available Change Documents". The
list loads by script, so a fetch of the page cannot read it. In the
maintainer's browser on 2026-10-10 it held only an Archive folder (2021-2022
SIM Rev1 to Rev4, 2023-2024 SIM Rev1 to Rev3), none for the 2026 SIM. When
one appears, read it, read again any part it changes that this app cites or
quotes, and record it in `src/config/readingLog.ts`. The daily fingerprint
check catches a changed cited part either way; a change document is what
would name the revision.

## Done: the waiver sign's photo under the tier selector

Asked for 2026-10-08, added 2026-10-09: under the LSPC waiver tier buttons
(`ProfileSelector`), "Photo of the posted sign (undated)" opens
`public/lspc-waiver-sign.jpg`, served with the site so it opens without
GitHub. It is a crop of `docs/lspc-waivered-wind-limits.jpg` (the photo as
taken, kept as the record) to the framed sign, 1,400 px wide and about
210 KB, against 3 MB for the original; a test checks the file is there.

## Open-Meteo's cloud cover: shown, and now compared

Asked for 2026-10-08, and added the same day at the maintainer's request:
the Ceiling & sky card shows Open-Meteo's total cloud cover for each hour
as a narrow grey bar in an outlined track and a grey figure beside the NWS
sky cover, with the low/mid/high bands in each hour's tooltip. It rides on the winds request
(`OPEN_METEO_CLOUD_VARIABLES`), is left out when Open-Meteo does not
answer, and is never shown as a ceiling: Open-Meteo serves cloud as a
share of the sky (total, and bands up to 3 km, 3 to 8 km and above 8 km,
per open-meteo.com/en/docs, read 2026-10-08), with no base height. It is
grey whatever the amount, so it asserts no category; since 2026-10-09 the
NWS bars are likewise one colour whatever the cover (the few/scattered/
broken/overcast colours had no key and read as a verdict).

What the dashboard reads the sky from:

- **Now:** the KPMV METAR (Plattsmouth, about 12 mi ENE), from IEM first and
  api.weather.gov second, its sky groups parsed from the METAR text
  (`normalizeIemCurrent`, `normalizeNwsObservation`). This is the observed
  report: layer amounts and measured bases.
- **Forecast hours:** the NWS gridpoint forecast for the drop zone's own grid
  cell (`skyCover`, a percentage, and its derived ceiling), and beside it
  Open-Meteo's cloud cover.
- **10-day outlook:** Open-Meteo's daily weather code (its own reading of its
  model), or on the fallback the day's mean NWS gridpoint cover.

Compared 2026-10-10 over six months of past hours (2026-04-01 to
2026-10-09, 4,482 hours): the NWS forecast from NOAA's NDFD archive, which
served api.weather.gov's gridpoint values, and Open-Meteo's from its
Historical Forecast and Previous Runs APIs, each against KPMV's report at the
hour. The results are in [cloud-cover-sources.md](cloud-cover-sources.md).
In short, the two read differently rather than one tracking the other:

- The NWS figure is a graded amount, seldom 0 or 100. Its median rises with
  the reported cover (23% on CLR hours, 83% on OVC hours).
- Open-Meteo's is near yes-or-no, mostly 0 or 100.
- At the same hour they differed by a median of 19 points.
- Each was at or above 5/8 on about three quarters of the hours KPMV
  reported a ceiling, and on about a fifth of the hours it reported none.
  Some of that fifth may be cloud above the ceilometer's 12,000 ft.

Decided 2026-10-10 by the maintainer: the card keeps both, with a note on
how each compared with KPMV (`CeilingSkyPanel`, figures in
`src/config/cloudComparison.ts`).

The per-pressure-level cover (`cloud_cover_850hPa` and so on) is not used:
on the day it was looked at every level read 0%.

Found on the way, and not yet explained: **KPMV never reports FEW.** None of
its 71,889 reports from 2024-01-01 to 2026-10-10 in IEM's archive had a FEW
layer, against 2,896 at KLNK and 7,214 at KOFF over the same span. A KPMV
SCT may therefore cover amounts under 3/8, which the Ceiling & sky card,
showing the report's layers as written, does not say. What KPMV's sensor
does with small amounts is the open question. Looked into on 2026-10-10
(cloud-cover-sources.md, "Stations that never report FEW"):

- 19 of 46 Nebraska stations reported no FEW in September 2026. All were
  AWOS sharing one report shape; every ASOS reported FEW.
- The FAA's AWOS standard requires FMH-1 METAR coding, which has FEW, and
  does not publish the algorithms.
- The likely cause is one family's software, but that is not confirmed.
  The state aeronautics division or the manufacturer could settle it.
- Dated the same day ([cloud-cover-stations.md](cloud-cover-stations.md)):
  seven AWOS reported FEW until new equipment (their remarks changed from
  AO1 to AO2) arrived between 2002-08-27 and 2003-03-04, and none has
  since. Beside a nearby ASOS, a no-FEW AWOS reports SCT where an AWOS that
  reports FEW gives FEW, and agrees about ceilings as often.

Open-Meteo's figures at those stations, fetched 2026-10-11
([cloud-cover-stations.md](cloud-cover-stations.md), "The forecasts at each
station"): its start of run agreed with each station's ceiling call more
often than the NWS figure at all fourteen, and neither forecast reads much
differently at a station that reports no FEW.

Ceiling heights, compared 2026-10-13 ([ceiling-heights.md](ceiling-heights.md)):
the NWS ceiling the card shows was within 700 ft of KPMV's on half the
hours both had one; by the band the forecast gave, its median error was
one 100 ft step in each. It seldom forecast a ceiling under 500 ft (41
hours, against 149 reported). Open-Meteo has no ceiling figure here; its
low band marks a ceiling of 3,000 ft or lower on 92 to 93% of those hours
without placing it. Whether the card should say so is open.

## To do, eventually: add this app to Open-Meteo's list of users

Raised 2026-10-08. Open-Meteo's README
(<https://github.com/open-meteo/open-meteo>) asks: "Do you use Open-Meteo?
Please open a pull request and add your repository or app to the list!"
This app reads its winds aloft (pressure levels, with the 10 m and 2 m
samples) and the 10-day outlook from Open-Meteo, so it qualifies. Not started: the pull request goes to another
project's repository under the maintainer's name, so it waits on the
maintainer deciding to send it. Before writing the entry, read the README's
list as it then stands for the format it uses.

## Settled: the DZ's coordinates now sit on the landing area

Raised 2026-10-08 by the maintainer, from Mark Schulze's map: the app's
point (40.8675, −96.11) and Schulze's preset for the club (40.8675006,
−96.11001) were both in the field south-west of the runway, downhill from
it. Jumpers land north or east of a barbed-wire fence that runs just west
of the runway's north–south length and just south of its leg along the
north: on the runway, the alfalfa field east of it where students are
aimed, and the pea gravel near the north-east corner, by the buildings,
where many experienced jumpers land.

The same day the maintainer gave the middle of the landing area by the
pea gravel, 40°52'13.0"N 96°06'30.5"W, and `SITE.dz` moved there
(40.8703, −96.1085: four decimals, because api.weather.gov's points
endpoint refuses more). Checked that day: it is in the same Open-Meteo
forecast cell and the same NWS gridpoint (OAX 77,42), so no forecast
changes; Open-Meteo's ground there is 355 m (1,165 ft) against 349 m at
the old point, so the model's 10 m wind now stands above the field's
published 1,182 ft and the Surface row is that wind itself
(`isSurface`, `src/domain/types.ts`); KPMV is 61° rather than 60° from it.
The link to Schulze's page carries the new point, so it shows his table
measured from 1,165 ft, as the "As Schulze" view is; his own list's pin
for the club is still in the south-west field (1,132 ft on Open-Meteo's
terrain). Logs before 2026-10-08 were taken at the old point.

## To do: re-run the Surface rows against the measured wind

On 2026-10-08 both forecast Surface rows were set by hand against KPMV's
measured wind over the 156 hours the logs held (the 10 m row nearer in 104,
Schulze's in 23, tied in 29; `docs/markschulze-altitude-reference.md`,
"Which Surface row is nearer the measured wind", which also says how).
Almost all of those hours were at the old DZ point and in two weeks of early
October. Worth re-running once the logs hold a few weeks at the landing
area, and in other seasons, ideally as a script under `scripts/` rather than
by hand, so the figure on file is not a one-off.

## Which forecast run the winds-aloft request is served

Narrowed, not settled. Seen first on 2026-09-23: for the same hour the app's
table and Mark Schulze's tool, both reading Open-Meteo, were on different
forecast runs. Checked 2026-09-24 at one level in one hour: Schulze's raw
700 hPa level matched Open-Meteo's `best_match`, `gfs_seamless` and
`ncep_hrrr_conus` exactly and none of `ecmwf_ifs025`, `gfs_global`,
`icon_seamless` or `gem_seamless`, so different models are effectively ruled
out; and the app's response carries no `Cache-Control`, `Age`, `ETag` or
`Expires` header, so nothing asks for caching, though a cache behind the API
is not excluded.

The sampler to 2026-10-05 counted it (`docs/source-parity.md`, "What the
sampler found"): different runs in 114 of 1,611 same-hour comparisons, in
short stretches up to about half an hour, on the same run agreeing to a
median 0° and 0 kt. But the rate is 2.5% (20 of 788) when the comparison
reads Schulze's hour in progress and 11.4% (89 of 782) when it reads his
next hour, which it does after half past because this card snaps to the
nearest hour; within those, 15% from :30 to :49 and 4.5% from :50. (The
other 41 comparisons, 5 of them mismatched, are the earliest, logged before
the minute was.) Against a next-hour cause on its own: the longest stretch,
28 to 36 minutes on 2026-10-01 from 08:03Z, ran almost wholly in the first
half of the hour, on the hour-in-progress request. The
minute of the hour and the `hourOffset=1` request change together, so the
logs cannot tell a new run reaching Open-Meteo's servers at different
times from something about the tool's next-hour request (its own caching,
say). The "different run" flag is also the script's heuristic (two raw
levels within 150 ft more than 5° or 2 kt apart), not a run identifier.

To separate them: fetch Schulze's `hourOffset=0` and `=1` and the app's
request for the same hours several times across :30 to :59, recording each
raw profile, so the next-hour request can be compared with itself and with
the hour-in-progress one at the same minute. Open-Meteo's responses carry no
run time; its `generationtime_ms` and the raw values are what there is.
Until then the Winds aloft card states only what was seen: on the same hour
the two can show different runs for a while, most often between half past
and ten to the hour.

A lead from the surface-wind sample of 2026-10-09
(`docs/surface-wind-sources.md`), not yet tested against the winds-aloft
request: Open-Meteo's metadata API (`/data/<model>/static/meta.json`) does
give each model's last run and when it became available, and that evening
HRRR's hourly domain (`ncep_hrrr_conus`) became available at 00:48Z and
01:52Z, the window where the mismatches cluster. For about twelve minutes
after a new 15-minute run arrived, successive requests got the new run or
the old one in turn, and Open-Meteo's model-updates page says its redundant
servers can differ "while the data is being copied" and to "wait 10
minutes after the availability time" (read 2026-10-09). Two requests a
moment apart landing on different servers would look exactly like this.
Logging that metadata beside each Schulze comparison would test it.

## Surface wind: which forecast source

Open since 2026-10-09. Whether Open-Meteo's `minutely_15` or `current` 10 m
wind is a better forecast of KPMV's measured wind than the NWS gridpoint hour
or Open-Meteo's hourly value. One two-hour sample (41 runs, 7 METAR reports,
all 5 to 6 kt) settled how the sources are built and how often they change,
and could not settle accuracy: see `docs/surface-wind-sources.md`. It needs
weeks of reports across windy, gusty and calm conditions. A sampler
(`.github/workflows/surface-wind-sample.yml`, every five minutes) runs to
2026-10-30T02:00Z for that; its records then need archiving and summarising
(`docs/surface-wind-sources.md`, "The longer sample, running"). Also seen there and not acted on: the NWS gridpoint is
served from caches that keep a copy up to an hour, and the app's fetch does
not bypass them; and Open-Meteo's hourly gust at the DZ always equalled the
15-minute step on the hour, so it behaved as the last quarter hour's maximum
rather than the hour's its docs describe (below the hour's largest 15-minute
gust at one of four hours, by 2.5 kt).
Nothing on the dashboard changed.

## Forecasts kept for later

Started 2026-10-13, at the maintainer's request: where no archive holds a
forecast the dashboard shows, keep it now, so it can be set against what
happened later. What has an archive and what does not, as read that day:

- **NWS gridpoint, archived in NDFD** (noaa-ndfd-pds.s3.amazonaws.com,
  `wmo/`): sky cover (`sky`) and ceiling (`cig`), each checked value for
  value against the API (docs/cloud-cover-sources.md,
  docs/ceiling-heights.md); and visibility (`vis`), wind speed, gust and
  direction (`wspd`, `wgust`, `wdir`), temperature and dew point (`temp`,
  `td`) and rainfall (`qpf`), checked at the drop zone on 2026-10-13 below.
- **NWS gridpoint, not archived:** the hourly rain chance (NDFD has only a
  12-hour `pop12`, which in every standard period read on 2026-10-13 was
  the highest hourly chance in its 12 hours, so the hours cannot be got
  back from it) and the thunder chance (no NDFD
  element). These feed the precipitation card. Rainfall past day 3 is not
  archived either: the API's `quantitativePrecipitation` ran to day 8 on
  2026-10-13, and NDFD's `qpf` has only the three-day headers.
- **Open-Meteo:** its Historical Forecast and Previous Runs APIs hold
  hourly forecasts, the winds aloft among them (start of run, and up to a
  week before). The 10-day outlook's daily figures as the card asks for
  them, `precipitation_probability_max` in particular, are not held.

`.github/workflows/forecast-keep.yml` keeps, once an hour, every gridpoint
field the card reads and the outlook as the card asks for it, on the
`forecast-archive` branch (`data/YYYY/MM/DD/HHMMZ.json.gz`, about 4 KB
each). Keeping the card's own requests also gives the lead a reader saw,
which the NDFD rows only bracket. Since 2026-10-15 the ceiling-error
chart reads their `ceilingHeight` (docs/ceiling-heights.md, "The
forecasts the card read, kept hourly"), and since 2026-10-17 the same
page scores their hourly rain and thunder chances against KPMV's reports
(docs/forecast-chances.md).

**The keeper does not run hourly.** Its schedule is `23 * * * *`, but by
2026-10-15 15:07Z GitHub had started it 10 times in about 47 hours, 3 to
6 hours apart (one more run was dispatched by hand), so 11 snapshots
where hourly would be about 48. This is the throttling the comparison
sampler met (CLAUDE.md: GitHub ran an every-fifteen-minutes schedule
under ten percent of the time), and the sampler's fix would serve here: a
job that loops and keeps a snapshot each hour itself, restarted by a
schedule or dispatch, instead of a cron line per snapshot. The maintainer
chose the loop on 2026-10-16: `forecast-keep.yml` now runs
`scripts/forecastKeepLoop.sh` for up to 340 minutes, keeping a snapshot
at minute 23 of each hour and pushing each as it is taken (five or six a
run), and each run first queues its own successor with a
`workflow_dispatch`, so the chain does not wait on the schedule, which
the sampler's lesson below shows is late too; a three-hourly schedule
restarts it if a dispatch fails. A run that loses an hour (both sources
down, or a push refused) still runs to its end and then fails, so the
loss shows. Tried before merging against a throwaway copy of the
repository with 30-second spacing: two live snapshots fetched, committed
and pushed under distinct names, exit 0; with the copy's remote refusing
pushes, nothing pushed, the checkout untouched, exit 1. Started by hand
after the merge (run 38943086043, 17:53:02Z): it queued its successor
(38943109753) 12 seconds later, and its first snapshot, `1823Z.json.gz`,
was committed at 18:23:02Z with both sources fetched (the gridpoint's
`updateTime` 18:05:33Z, Open-Meteo's outlook without error). Whether the
chain keeps the hours covered is to be read from the branch after a few
days.

First handoff, read 2026-10-17 at about 00:45Z: every hour from 18:23Z
on October 16 to 00:23Z on the 17th has its snapshot (seven), against
four in the 17 hours before the loop. The 3-hourly schedule's 21:23Z
start took the place of the queued dispatch (38943109753 shows
"cancelled" at 21:23:18Z): with `cancel-in-progress: false` the group
keeps one run waiting and a newer one replaces it. So it waited instead,
started at 23:23 when the first run ended (38969012619), took the 00:23Z
snapshot, and queued its own successor (38981163510). A cancelled
dispatch in the run list is therefore the schedule taking its turn, not
a lost hour; a gap in the branch's file names is what would show one.

What that choice involves, as read 2026-10-16:

- **Cost.** The repository is public (`visibility: public` from the API
  that day), and GitHub's billing pages, as quoted in search results that
  day, say standard GitHub-hosted runners are free for public
  repositories; the 2026 pricing changes (hosted-runner prices cut from
  January 1, a self-hosted platform charge from March 1) left that alone.
  Private repositories draw on a monthly quota (2,000 minutes on Free, by
  a third-party listing; the official page was not read). A job looping
  around the clock is about 43,000 minutes a month: nothing while the
  repository is public, many times the quota if it ever went private.
  docs.github.com is not on the sandbox allowlist (the proxy refused it,
  and WebFetch could not resolve it), so none of this was read on
  GitHub's own pages.
- **Limits.** A job on a GitHub-hosted runner stops at 6 hours, so a loop
  is a chain of starts, as the surface-wind sampler is. A workflow run
  stops at 35 days. Scheduled workflows in a public repository are
  disabled after a stretch with no repository activity (60 days by common
  account; the search snippet cut off before the figure).
- **Terms.** GitHub's terms for Actions list, among uses not allowed,
  "any other activity unrelated to the production, testing, deployment,
  or publication of the software project" of the repository, and say
  misuse can end jobs or restrict Actions. That wording was read in
  copies of the terms (a mirror of the github/docs repository), not the
  live page. A keeper whose records check this project's own forecasts is
  arguably within the project; the surface-wind sampler already runs the
  same way.
- **Precedent.** The surface-wind sampler (`surface-wind-sample.yml`) is
  that loop: 27 runs to 2026-10-16, all successful, 4.6 to 5.8 hours
  each. But its own five-hourly starts were throttled too: it covered
  57% of the time from 2026-10-09 to 10-14, with gaps of up to 9 hours,
  and 96% since (docs/surface-wind-sources.md). A loop makes each start
  count for hours, which is why it does far better than a cron line per
  snapshot, but it does not make the starts arrive on time. Starting it
  more often than it runs (a queue of one waiting start, as the sampler
  has) is what closes the gaps.
- **What it buys.** NDFD archives every kept field but the hourly rain and
  thunder chances and the outlook (above). A snapshot every 3 to 6 hours
  still catches most of the office's updates, but not the forecast a
  reader saw in the hour before a jump, and an hour not kept cannot be
  fetched later.

### NDFD against the API, element by element (2026-10-13)

`scripts/ndfdApiCheck.py` read api.weather.gov's gridpoint for the drop
zone (OAX/77,42, `updateTime` 17:31:36Z) and, around 18:00Z, the CONUS
NDFD files for each element issued either side of that update, decoded at
the grid point nearest the drop zone (0.87 km away, the point the sky and
ceiling checks used). Its output, the gridpoint as served and every
decoded value, is `data/parity/ndfd-api-check-2026-10-13T1800Z.jsonl.gz`;
`--from` prints the comparison again from it. Each pair was compared in
the forecast office's unit, as a reader sees it: whole knots, whole °F,
visibility to 0.05 mile, rainfall per 6-hour period in mm. A second run at
18:09Z, the API not yet updated again, read the same files and printed the
same figures.

The issuance at 17:46Z, the first after the API's update, matched the
API at every hour it covers: visibility 30 of 30, wind speed, gust and
direction and temperature and dew point 42 of 42 each (to day 3),
rainfall 11 of 11 periods; the day 4 to 7 files (the 97 and 87 headers,
issued 17:33Z, which carry wind speed and direction, temperature and dew
point, gust on 97 only, and `pop12`, but no visibility or rainfall) 16
of 16 hours for each wind and temperature element (`pop12` below). The
issuance at 17:16Z (17:17Z for wind speed and gust), before the update,
differed by 1 °F at 16 hours of temperature (15Z tomorrow to 06Z the day
after) and by up to half a mile at 9 hours of visibility; its winds and
dew points already matched. So what the API served from 17:31Z was not
yet in the 17:16Z issuance and was in the next one, 15 minutes after the
update; the CONUS files come every half hour. One pair shows that much,
not how long an edit can take in general.

The 17:16Z visibility file's last two hours (22Z and 23Z tomorrow)
decoded as −16,091,830 m, which is −9999 miles to the metre: a no-data
fill. Read again with ecCodes the same day, every message in both
visibility files holds that one negative value and no other, at
1,465,586 of the grid's 2,953,665 points in the first hours (the Pacific
off California among them, so likely the grid's area outside any
office's forecast), rising toward the end of the 30-hour span: to
2,116,312 at 22Z and 23Z tomorrow in the 17:16Z file, the drop zone
among them, and to 2,006,478 at 00Z the day after in the 17:46Z file,
where the drop zone had values to the end. The files declare no bitmap
and no missing-value management (`bitmapPresent` and
`missingValueManagementUsed` both 0, `grid_complex` packing), so a
decoder hands the fill back as an ordinary number. Every element is
non-negative, so the script counts a negative value as missing; a reader
of the archive has to do the same.

What NDFD stores is not what the API prints, by a little: m/s, K and m are
packed to about a tenth, so 5 kt comes back as 5.05 kt and 57 °F as
56.9 °F. Read in the office's units they are the same figures.

`pop12` equalled the highest of the API's hourly chances inside its 12
hours in all 12 standard periods (00 to 12 and 12 to 00 UTC) from day 1
to day 7, values from 0 to 95%. A file's first `pop12` runs from its own
reference time and is not a standard period; at 17:46Z it read 10%
where the hourly chances in those 12 hours reached 24%.

The 88 and 87 headers are the same grids on a 5 km mesh and held the
same figures at this point. One moment at one point is a small sample,
and it does not say whether a past day's archive was ever edited after
the fact; it says the archive and the API were the same forecast that
hour.

## The ceiling chart's old artifact

The ceiling-error chart moved on 2026-10-16 from a private claude.ai
artifact (<https://claude.ai/artifact/MvreJBrMpSKfX5HsFACnGx>) to the
dashboard's site (`public/ceiling-errors/`, docs/ceiling-heights.md, "The
chart"). The artifact still opens, for the maintainer only, with the data
of 2026-10-16 and nothing saying it moved. Compared the same day: its
data file is the site's byte for byte (SHA-256 2ac6d9d6…), its page is
older than the site's (without the CSP, the 320 px fixes or the corrected
keeper text), and every version it was published at was a commit first,
so `git log --follow public/ceiling-errors/index.html` holds them all.
Nothing would be lost; its only extras are opening in Claude's side panel
and claude.ai comments, and it had no comments. Deleted 2026-10-17 at the
maintainer's word ("if it's fully superseded delete"); its link no
longer opens.

## The ceiling data refresh: its first run on GitHub

`.github/workflows/ceiling-data-refresh.yml` (added 2026-10-17;
docs/ceiling-heights.md, "The chart") was run step by step in a scratch
copy from the sandbox, but never on GitHub, so its commit, rebase, push
to `main` and deploy dispatch are untried. Once it is on `main`, the
first scheduled run is the next Monday at 07:41Z, or start one from the
Actions tab. Worth a look then: that the run made one commit, "Ceiling
data to <day>", holding a `ceiling-` and a `metar-` file and the data
file, that a Pages deploy followed, and that the page's `sources` name
the new files. Two choices for the maintainer to confirm or change:
Mondays at 07:41Z, and committing a ceiling and a METAR file every week
(about 15 KB) rather than merging them into fewer archives.

## Viewing the deployed site from the sandbox

Settled 2026-10-17, with nothing for the maintainer to do. Chromium here
rejects the egress proxy's certificate because its trust store,
`~/.pki/nssdb`, is empty (cert9.db has no rows), though the proxy's notes
say it was set up, and filling it needs NSS's `certutil`, which is not
installed. The fix proposed on 2026-10-13 was an `apt-get install
libnss3-tools` and a `certutil` loop in the environment's setup script.

It is not needed. Chromium's `--ignore-certificate-errors-spki-list`
takes the SHA-256 hashes of public keys to trust; given those of the
bundle's proxy CA certificates (`/root/.ccr/ca-bundle.crt`, subjects with
`O = Anthropic`: "CCR agent-proxy interception CA (production) 2026-08",
"sandbox-egress-gateway-production Egress Gateway CA" and
"sandbox-egress-production TLS Inspection CA"), and the session proxy as
its proxy, it loaded the live site; without the flag, the same launch
failed with ERR_CERT_AUTHORITY_INVALID. It trusts only those keys, as
the NSS store would have. The recipe is in CLAUDE.md, "The deployed site
in a browser". The hashes are taken from the bundle each time, so a
rotated proxy CA needs nothing changed. What the first load found is
under "Live-site smoke test" below.

## Issue #147: a timeout, not a disagreement

The sky-parity run of 2026-10-11 (run 38161231894) opened issue #147.
Its log, read 2026-10-17: the one failing test, "parses the METAR text
the way aviationweather.gov decodes it", failed on its first request
(`fetch failed`, connect ETIMEDOUT to 150.171.109.72, an
aviationweather.gov address), so it compared nothing. The same run's
other aviationweather.gov requests, made a moment later (flight
category, TAF), passed, and so did every check on uspa.org and the
Pilots tab links. Every daily run on `main` since, 2026-10-12 to 10-16,
passed. Nothing for the code to fix. Closed as not planned on
2026-10-17 at the maintainer's word, with a comment saying why.

## KOFF's TAF: no feed a browser can read carries it

Read 2026-10-13. Offutt's TAF is issued by the USAF, not the NWS:

- api.weather.gov: no product under any lookup (also 2026-09-27 and -30).
- IEM: no KOFF TAF since 2020, and none for Wright-Patterson (KFFO),
  Barksdale (KBAD) or Dover (KDOV) either, against about 60,000 rows for
  KOMA. IEM's TAF page says its archive is built by processing the NWS's
  text TAF products, which a USAF TAF is not, so this is not an outage.
- aviationweather.gov's API and NOAA's raw file
  (tgftp.nws.noaa.gov/data/forecasts/taf/stations/KOFF.TXT) carry it, but
  send no CORS header, so a browser cannot read them. How a USAF TAF
  reaches them was not traced.

Offutt does not issue around the clock. The TAF read that day was issued
Saturday 10 October 10Z, valid to Sunday 16Z, ending "LAST NO AMDS AFT
1013 NEXT 1310": no amendments after Saturday 13Z and the next issue
Tuesday 10Z. KOMA's TAF had no such gap.

Options, for the maintainer: a small relay (a free Cloudflare Worker in
their name) that fetches aviationweather.gov and adds a CORS header, which
would be current; or a workflow that copies the TAF onto the site on a
schedule, which needs no new account but would run late as often as this
repo has seen GitHub schedules run late. Keyed services (CheckWX and the
like) would put the key in the public page. Until one is chosen, the card
shows the next station, KOMA, and links Offutt's TAF.

## Live-site smoke test

Run against live data on 2026-09-22 (first time the app had ever been exercised
against anything but the fixtures in `src/api/fixtures/`). Every source
answered: NWS observation (KPMV), NWS gridpoint hourly (168 points), Open-Meteo
winds aloft and 10-day daily, the TAF chain, and the NOAA FD winds fallback.

Settled:

- **Winds-aloft valid time is right.** At 04:01Z the card showed 0400Z, one
  minute behind — the hourly snap working as documented. Cross-checked against
  Mark Schulze's tool at the same hour and coordinates: identical at 13,000 ft
  (303° / 20 kt / −4 °C).
- **TAF falls back as designed.** KOFF yielded no product, KOMA did — the
  behaviour `SITE.tafStations` predicts.
- **The FD fallback was wrong, and is fixed.** See the commit; it printed the
  bulletin's 3,000 ft MSL wind as the Surface row.
- **The sky decode was wrong on live data, and is fixed.** Seen in a screenshot
  of the deployed site on 2026-09-23: "Sky: Clear", "No ceiling", VFR and no
  flag while the raw METAR on the same card read `OVC027`. api.weather.gov's
  `cloudLayers` was `[]` for seven consecutive reports and stayed so when
  re-read; the usairnet KPMV page the card links to decoded the same METAR
  as "Solid Overcast at 2700 ft", MVFR (fetched 2026-09-23, once
  `www.usairnet.com` was allowlisted). The normaliser now reads the sky from
  the METAR text; see CLAUDE.md.
- **The Licensed profile reads correctly with no flag**: card header "Licensed —
  no published limit", no band, the standing note and BSR citation present, and
  the advisory list naming the gap.

Exercised since:

- **The deployed site, in a browser, on live data** (2026-10-17, about
  01:30Z; how, in "Viewing the deployed site from the sandbox" below).
  <https://amelia-m.github.io/lspc-weather/> loaded at 1280, 390 and
  320 px with no sideways scroll, and every source answered: IEM and
  NWS's latest KPMV observation, the gridpoint, the TAF chain (KOFF had
  no product, KOMA did, as on 2026-09-22), and the radar GIF fetched
  cross-origin from radar.weather.gov (200, drawn at 600 px wide).
  Open-Meteo's two requests failed on the first try, after about 11
  seconds, as "blocked by CORS policy", and succeeded on the app's retry;
  Open-Meteo answers with `access-control-allow-origin: *`, so the failed
  answer was most likely the sandbox proxy's on a slow request rather
  than Open-Meteo's. The console's one 404 was `/favicon.ico` at the
  domain root: the page named no icon. Both pages have named one since
  2026-10-17, `public/favicon.svg`, a canopy in the accent blue. The app
  links it as `/favicon.svg`, which the build writes as
  `/lspc-weather/favicon.svg` (read in `dist/index.html` from a build with
  `BASE_PATH=/lspc-weather/`, the base deploy.yml builds with by leaving
  it unset); the static ceiling-error page links `../favicon.svg`, since
  nothing rewrites it. Served from a folder named `lspc-weather`, both
  pages loaded in Chromium with no same-origin request under 200 and no
  404 in the console, and each page's icon href fetched with a 200 as
  `image/svg+xml` and drew as an image under the page's own policy (both
  allow it as `'self'`, unchanged). `npm run dev` serves the same href. Not
  yet seen on the deployed site; a headless load does not show whether a
  browser stops asking for `/favicon.ico` there, so the next live load is
  the check. It was: the live-site check's first run on a GitHub runner,
  after the icon deployed, logged no 404 on any page (below).
- **Every page, at every width, on live data** (2026-10-17, about 17:50Z,
  a Saturday with KPMV gusting 18 kt and the surface-wind caution
  raised). Jumpers, Pilots, `#citations`, `#parity` and the ceiling-error
  page, each at 1280, 390 and 320 px, logging console errors, failed
  requests, the page's width and every element past the viewport's edge.
  - **Fixed, `#citations` at 320 px:** the page was 348 px wide, so it
    scrolled sideways. A citation's "read" line carries unbroken
    URL-like words (`weather.gov/epz/wxcalc_densityaltitude,`) that could
    not wrap. `.panel-body` now breaks a word only when it cannot fit
    (`overflow-wrap: break-word`); 320 and 390 px then measured exactly
    the viewport.
  - **Fixed, the radar card before its image loads:** the loop is lazily
    loaded, so on a phone it waits until scrolled to (118 KB, about half a
    second through the proxy once asked for). Until then its box sat at
    the 60 px minimum and the drop-zone ring, placed in percentages of the
    box, floated in it. The image now carries its size (`RADAR_IMAGE_PX`,
    600 by 550, read from the live image), so the box keeps the map's
    shape and the ring sits where it will land: 328 by 301 px at 390.
  - **By design:** the wide tables (10-day outlook, winds aloft, TAF,
    exit weight, the parity and ceiling-page tables) run past a phone's
    edge inside their own scroll boxes, and the page does not; the
    sectional chart's tiles are clipped by their frame; the ceiling page's
    raincloud paths extend past the chart only under their clip path.
  - **Console:** Open-Meteo's first request failed as "blocked by CORS
    policy" on most loads and succeeded on the retry; once Open-Meteo
    itself answered 500 (`#parity` at 320 px), and once api.weather.gov's
    TAF list for KOMA failed the same "CORS" way (Pilots at 320 px). Each
    card filled on the retry. Both hosts send the CORS header when they
    answer, so these are most likely the sandbox proxy's own failures on
    slow or dropped requests, as on the first load; a check from a GitHub
    runner, outside the proxy, would tell them apart.
  - **Checked daily since:** `.github/workflows/live-site.yml` runs this
    walk on a GitHub runner, outside the proxy, daily and after every
    deploy (CLAUDE.md). Its first run, after the deploy of 2026-10-17
    (run 39057948085), passed every page at every width with no note at
    all: no failed request to any host and no console error. So the
    first-request failures above are the sandbox proxy's, not something a
    reader meets, and the `/favicon.ico` 404 is gone from the deployed
    site.

## The Student profile models no canopy type

BSR 2-1 H states two maximum ground winds for solo students: 14 mph on ram-air
canopies, 10 mph on round reserves. The app has one Student profile with one
band, set to the 14 mph figure, so a student on a round reserve gets no flag at
their own published limit. The Surface wind card now says so rather than leaving
the silence to be read as an all-clear, but saying so is not the same as
handling it.

Two ways to close it, both needing a decision this repo cannot make from code:

- **Model canopy type** — a second Student profile, or a toggle. Correct, and it
  costs a UI control on the most-read card.
- **Drop the round-reserve figure** from the guidance and scope the profile to
  ram-air explicitly. Cheaper, but it hides a published limit.

Worth asking an instructor first whether LSPC puts any student on a round
reserve. If nobody does, the second option is honest and the first is dead
weight — but that is a fact about the DZ, not about the BSRs, and nothing in
this repository establishes it.

A lead, 2026-10-08: the maintainer believes most of the club's student rigs
carry an Aerodyne Smart reserve
(<https://www.flyaerodyne.com/reserve-canopy-smart.html>). The Smart is a
ram-air reserve, by its maker's description as commonly known, not by a
reading: the page was not opened, because `www.flyaerodyne.com` is not on the
sandbox's allowlist. If an instructor confirms it for every student rig, no
student here jumps a round reserve, which is the fact the second option
waits on. "Most" is not "every": a rig with a round reserve would still need
the 10 mph figure.

The maintainer's call, 2026-10-10: leave both options until it is known
whether any of the student rigs has a round reserve. Do not pick one before
then.

## Winds aloft

The sub-surface question that sat here is settled and fixed: pressure levels
below the model's terrain are dropped in `normalizeOpenMeteo`. Evidence, the
measurements behind it, and — importantly — the sources that could *not* be read
are in [`subsurface-pressure-levels.md`](subsurface-pressure-levels.md). The share this
entry used to quote (~4%, rising to ~15%) was a property of the **fixture**,
which sets `elevation: 360`; live Open-Meteo returned 349 at the point used
until 2026-10-08 (355 at the landing area since), which put the 10 m
sample below the field elevation and the sub-surface share at 0% in all 384
hours. The fix is worth having anyway — see the commit and the comment in
`normalizeOpenMeteo` — because which side of that 10-metre line the DEM lands
on is not something this app controls, and an hour missing `wind_speed_10m`
would have built the Surface row 70% out of a wind stamped below ground.

## Radar card: a pin at the drop zone

**Done** — approach 2, on measured georeferencing. `RADAR_IMAGE_GEOREF` in
`src/config/site.ts` carries the constants and the method; `radarImageFraction`
in `src/domain/radarGeo.ts` derives the position from the DZ and radar
coordinates.

What was measured, on 2026-09-22: the RIDGE "standard" image is equirectangular
over a bbox that is square in degrees (4.287° a side), centred on the radar in
longitude and 0.060° north of it in latitude, rendered into 600×550 px. Fitted
by projecting ~11,000 county-boundary vertices from
`api.weather.gov/zones/county/…` into the image and minimising their distance to
the drawn lines: median residual 0 px, 90th percentile 1 px. Mercator and
azimuthal-equidistant models fitted an order of magnitude worse. Repeated on
KUEX and KDMX, which agree to ±0.002°, so the figures describe the product
rather than one image.

Worth knowing if this needs revisiting:

- NWS publishes **no** georeferencing for these files. `/ridge/standard/`
  contains GIFs and nothing else — no world file, no `.aux.xml` — and
  radar.weather.gov's own viewer uses the same file as an ungeoreferenced
  picture. Nothing upstream promises the extent will hold, so if NWS changes the
  product the marker moves silently. Re-measure with the method above.
- The obvious assumption, that a single-site image is centred on its radar, is
  **wrong** in latitude and was off by 8 px (~7 km) at the 90th percentile.
  `tests/radarGeo.test.ts` fails if someone simplifies that offset away.
- The header and footer bars are drawn over the map, so a point can be inside
  the bbox and still have nothing under it but NWS chrome. `radarImageFraction`
  returns null there.

Approach 3 (centring the interactive-radar link on the DZ) is still open, but
no longer opaque. The `?settings=v1_<base64>` parameter is base64 JSON, and
both the site's encoder and its reader were read from its bundles on
2026-09-23 — see [`radar-interactive-link.md`](radar-interactive-link.md).
The reading says a single-station view is re-centred on the radar once the
station list loads, so "centred on the DZ" and "KOAX's own product" cannot be
had in one link; only the national mosaic takes a centre. That is a code
reading, not an observation: no URL has been opened in a browser from here.
The doc lists six links (A–F) for a person to open on a phone and desktop, and
what to look for; B is the one that settles it. Until then the card keeps its
plain station link.

## Mark Schulze's Winds Aloft: AGL or MSL?

**Settled: AGL.** Evidence and a re-check recipe in
[`markschulze-altitude-reference.md`](markschulze-altitude-reference.md). The
winds-aloft card now says so, since it is the cross-check it sends jumpers to.
