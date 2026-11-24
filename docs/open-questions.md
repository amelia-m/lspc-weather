# Open questions and follow-ups

> Open-Meteo figures in this document are weather data by
> [Open-Meteo.com](https://open-meteo.com/), under
> [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), reworked as
> the document describes (set against other sources, counted,
> differenced or interpolated). See [open-meteo-terms.md](open-meteo-terms.md).

Live backlog. A closed item is kept for a while under a "Done" or "Settled"
heading, then deleted; the repository history is the record.

## Done 2026-11-24: say how old and how limited the data is, plainly (the maintainer, high priority)

Her word on reading AXIS's page (docs/axis-conditions-tool.md), then "fix" to each of three findings and "y" to five proposals. Found, read in the code: the cards printed a report's clock time and compared it with nothing; no flag read `observedAt`; Data health's "stale" was the time since the app's last fetch, so an old report fetched a minute ago read as fresh. Built (`src/domain/reportAge.ts`, CLAUDE.md's consequence of the same date): the report's age beside its time on the Surface wind, Winds aloft and Current conditions cards; "A report is the wind at KPMV when it was taken. It cannot show a wind that is changing now, or the wind at the DZ." in the Surface wind card's own type; each flag read from the report names it and its age; a line on the Surface wind card and above the flags, and a stale METAR row on Data health, once the newest report is more than two of KPMV's usual 20-minute intervals old; the station and its distance in the disclaimer's first paragraphs. KPMV's cadence, measured 2026-11-24 with `scripts/reportCadence.ts` over IEM's archive of 2026-10-10 to 11-22: 3,135 reports, the next one 20 minutes later in 3,110 of 3,134 gaps, later than that in 18, over 40 minutes in 4, the longest 6 h 5 min after 06:35Z on 2026-11-03. Checked: 1,453 tests, each new one failing with its behaviour broken (eleven breaks); the fixture build in Chromium at 1280, 390 and 320 px, fresh and 100 minutes on, both tabs, no page wider than the viewport. Not checked: the deployed site on live data, which waits for the merge.

Left for her: the card-wording review's word counts (docs/card-wording-review-2026-11-21.md) predate these lines, which add about 45 words to the Surface wind card and a sentence to the disclaimer; and when the NWS feed alone is serving (24 to 33 minutes behind the station, CLAUDE.md), the overdue line will show at times though KPMV is reporting, which is true of what the page has but worth her knowing.

## Needs a human with a document

The maintainer's word, 2026-10-27: the instructor's review of `#citations`
(every ask on the page, A1's round-reserve confirmation among them) is
held until Saturday 2026-10-31 at the earliest; do not raise it before.

These cannot be settled from the code.

1. **Which 105.17 visibility row the flag should use: answered.** The
   maintainer, 2026-10-31: both, because the rows are MSL, so a 10,000 ft
   AGL exit is above 10,000 ft MSL while hop-and-pops are well under.
   Done the same day ("Settled: the visibility flag holds the reading to
   both 105.17 rows", below). Left for the instructor, A8's two asks on
   `#citations`: whether holding the surface reading to both rows is the
   S&TA's and the pilot's reading too, and whether every low exit flown
   here is well below 10,000 ft MSL (`HOP_AND_POP_FACT`).

2. **The claims still need an instructor, not another reading.** Every
   USPA, CFR and FAA citation has been read at its source (the SIM at
   uspa.org on 2026-09-22; 14 CFR 105.17 and 105.19, AIM 7-1-7 and
   FAA-P-8740-2 on 2026-09-23) and corrected against it, so the section
   numbers are no longer guesses. The club's posted tiers are a
   transcription of an undated photo of the sign, which no reading can
   improve on. What a reading could not settle is each entry's "Please
   confirm" list on `#citations`: among them whether rounding the 14 mph
   student limit *down* to 12 kt is the right direction for a limit read
   off a card (A1), and whether the posted waiver tiers were filed as a
   SIM 2-2 waiver (A5). The page takes the answers in place (a verdict
   per claim, yes / no / not sure and a note per question, kept in the
   browser) and sends them as a prefilled GitHub issue or copied text.
   Next: an instructor or S&TA working through it, not before 2026-10-31.

3. **The app's own thresholds, for an instructor's judgement rather than
   a lookup.** Part B of the citations page: B1, the 25 kt licensed bar
   scale, which triggers nothing and only sets how long a bar is drawn;
   and since 2026-11-05 B2, the flag levels (`JUDGEMENTS`,
   `src/config/citationsChecklist.ts`): the flight-category flag's Watch
   under MVFR and Caution under IFR or LIFR, and the overcast flag's
   Watch, none graded by any source. B2 states what the app does and asks
   four questions (one level at every category; the neutral Note badge,
   which no flag uses, or Caution; the overcast flag taking the
   category's level at the same ceiling, so one sky shows one colour;
   whether Watch and Caution read as a weight and not a verdict). It
   cites nothing, so it offers no claim verdict (`kind: 'judgement'`);
   only its questions are answered, counted and reported. Waiting on the
   S&TA with Part A.

## Done 2026-11-18: day and night on the Ceiling & sky card (the maintainer, 2026-11-16)

The hourly wind chart has shaded its night hours since 2026-10-03; the
Ceiling & sky card's strip and day blocks had no such mark, and the
maintainer asked for the same. Built 2026-11-18: `spanIsNight`
(src/domain/sun.ts, pure, beside `nightIntervals`) calls a column or slot
night when the middle of its span falls between the drop zone's sunset
and sunrise, so a span that straddles one goes by its greater part and
none is both. The shade is the hourly chart's (`--hc-night`), each night
column's title ends "· night", the card's note says what the dark columns
are, and no figure or flag changed. Tests pin the rule at the straddles
and the columns to `nightIntervals`; the fixture build was checked at
20:00Z and 05:30Z at 1280, 390 and 320 px
(docs/img/ceiling-sky-night-2026-11-18.png). Since the same day's rebuild
the card is day tables and the shading is on their cells and the band's
slots by the same rule.

## Settled: the visibility flag holds the reading to both 105.17 rows

Asked since 2026-09-23 (item 1 above, A8): the section's rows are MSL and
Brown's is at 1,182 ft MSL, so a 10,000 ft AGL exit is in the 5 SM row,
while the flag fired on the 3 SM row, the one a surface reading could be
held to without claiming more. The maintainer, 2026-10-31: **both**,
since a 10,000 ft AGL jump is above 10,000 ft MSL but hop-and-pops are
well under.

Done the same day. `VISIBILITY_ROW` is `'both'` (`src/config/thresholds.ts`):
the flag fires below 5 SM and its value says which rows the reading is
under, a comparison of figures and nothing more ("4 SM, under the 5 SM
row, at or above the 3 SM row"; "2 SM, under both rows";
`visibilityRowsUnder`). The guidance names each row's jump and carries the
DZ fact the 3 SM row rests on, dated and attributed as the round-reserve
fact is (`HOP_AND_POP_FACT`: hop-and-pop exits at LSPC are well below
10,000 ft MSL, the maintainer, 2026-10-31; confirmation asked on
`#citations`). The Ceiling & sky note and Settings say the same. A8 stores
its answers under a new key (`A8@both`) and asks two things, the reading
and the fact; verdicts given to the 3 SM wording stay reported under that
figure. An edited figure names no row. The two single-row settings remain
in `VISIBILITY_ROWS` with their own wording, and every test passes with
any of the three (checked by flipping it). No threshold is the app's.

## Page counts: back on the amelia-m site (2026-11-03)

Counting went in on 2026-10-31 (docs/page-counts.md, #245) to the
`amelia-m` GoatCounter site, which also counts the maintainer's personal
site. On 2026-11-02 she asked for the two to be told apart, and the
endpoint moved to `lspc-weather.goatcounter.com` (#257); the site did not
exist on the account (her browser showed "error 400: no site at this
domain" on 2026-11-03), so about a day of views was counted nowhere.
Moved back the same day. The two sites are told apart on the one
dashboard by path (the dashboard's views all start `/lspc-weather/`, the
personal site's `/`; "Filter paths" shows either alone); a dashboard of
its own needs a site made on the account first, then one line to change.
Not made.

The lesson: a change of endpoint to a host the sandbox cannot reach
(gc.zgo.at and goatcounter.com are not allowlisted) should ship only
after the site exists, or the doc should say the first view is the check.
Seen in the dashboard on 2026-11-03: the week to 2026-11-02 listed
`/lspc-weather` with 4 visits and `/lspc-weather/#pilots` with 2, so the
path from a reader's browser to the dashboard is proven. Nothing waits
here.

## Done: the Lincoln AI meetup deck, a page of the site (2026-11-11)

Drafted at the maintainer's word of 2026-11-10 under
`docs/talks/lincoln-ai-meetup/` (the contract, `talk.qmd`, a draft render
with claim references, the claims table and a reviewer agent's report,
whose four wrong figures and one unreproducible count were fixed the same
day). Merged and deployed the next day at her word:
`scripts/renderTalk.sh` renders `public/talk/index.html`, one
self-contained file (pandoc's reveal.js writer, since Quarto cannot be
installed in the sandbox); the footer links it ("How this was built");
the live-site check loads it and counts its slides; `tests/talkPage.test.ts`
holds the link, the file and the contract's identifier rules. Added
after the review at her word: a mock-up of a generic weather app (a
prop, labelled as one) and her text thread with her instructor (C30,
C31), then seven more slides (C32 to C37), the mock redrawn partly cloudy
to sit beside the thread's "low" clouds, the thread's three screens as
fragments, and the title "Trust, but verify" (her word, after "Built to
be checked"). The deployed deck was loaded in the sandbox's browser that
night (26 slides, the fragments, the club's link, every image decoding,
no console error). The club's link, skydivelspc.com, came from an Omaha
Magazine article and the club's email domain; the maintainer gave the
same address. A fresh review of C30 to C37 on 2026-11-12 (review.md,
"Fresh review of C30 to C37") found three slips, fixed that day: the old
point's ground is 1,145 ft, not 1,132; the mock's Sunday high was 70°
under "highs in the sixties"; the comparison runs nine times a day, not
eight.

Still hers: Mark Schulze's page as a screenshot file for the slide "One
of them, as it looks"; and two things under the contract's "Not shown"
line, that chat-3 shows metar-taf.com, a hostname the live site does not
name, and chat-2's NOAA link carries coordinates that are not the DZ's,
both in the screenshots as her instructor sent them.

## Reach the NBM's three-day bulletin for the Ceiling & sky card? (2026-11-12)

The maintainer asked why usairnet's ceiling forecast runs further out
than the card's. Answered in docs/usairnet-parity.md, "Why usairnet's
ceiling runs further out": usairnet's table is the NBM's three-hourly NBS
bulletin, 6 to 72 hours; the card's ceiling was the NWS gridpoint's,
about a day and a half, and its base row the NBM's hourly NBH, 25 hours.
The NBS file is on the bucket the relay already reads
(`blend.YYYYMMDD/HH/text/blend_nbstx.tHHz`, 29.6 MB), with a KPMV block
of the same layout (`data/parity/nbm-kpmv-nbs-2026-11-12-01z.txt`).

**Built the same day at her word** ("add it but let's try out a couple
layouts"): the relay's `/nbm/KPMV/nbs` path, the app's `nbs` source, and
four trial layouts (`days`, `horizon`, `continue`, `strip`;
docs/nbm-lowest-cloud-base.md, "The three-hourly bulletin, three days
out", a phone screenshot of each under docs/img).

**2026-11-18, her word: "I think we need to do more work on the
layouts."** The four were screenshotted at three widths and two clocks
and read three ways: docs/ceiling-sky-layout-review.md (the problems in
order of weight, the heaviest that the band filled from the ground to the
base so a 26,000 ft base drew the darkest column; three mock-ups under
docs/design/ceiling-sky/), docs/data-viz-notes.md (twelve principles with
sources, applied to the card) and docs/cloud-forecast-layouts-elsewhere.md
(usairnet, NWS, aviationweather.gov, MDL and Mark Schulze's pages, loaded
at 390 and 1280 px; docs/img/survey-*). Where the three agree: one block
per local day with the same hour in the same column; a figure in every
height slot with a word for none; night behind the data; the band drawn
the right way up; larger figures (the strip's were about 9 px); the
source named on each row; no chip, colour, icon or sky word that grades
an hour. **Built the same day at her word** ("merge it and build your
recommendation"): the day table (A) with the cloud profile (B) as its
heights row and the hourly strip folded in; C's one-line day summary left
out for want of a wording held to figures. The four layouts, the strip,
its toggle and `VITE_THREE_DAY` went; `src/domain/skyDays.ts` and
`CeilingSkyDays.tsx` replace them; docs/nbm-lowest-cloud-base.md has the
shape.

**Read again the same day** (docs/ceiling-sky-rebuild-review.md): of the
eleven earlier problems, seven fixed and four partly; seven new, each
verified and fixed the same day (same doc and
docs/nbm-lowest-cloud-base.md, "Read again the same day"): one bulletin
per band column and base cell, a top-edge strip for a ceiling at or above
12,000 ft, "12a" under 360 px, rows only where a day has figures, one
"ends" line for the whole card read over the whole list (an end at local
midnight was unnamed), today as its hours alone from 6 PM, the NWS line
across the column and the base bar narrower.

Open, hers: the card's height (about 1,950 px at 390 px with today's
hourly open; the key under the tables is 650 px of it, the card's largest
single piece); the one-screen answer per day (C), which the tables still
do not give without scrolling where only the NWS forecasts a ceiling; and
what figure-only wording a day summary would carry ("lowest base 2,400 ft
at 3 AM; no ceiling" is figures; "clear" is not).

## Issue #297: Open-Meteo 503 under the live-site check, 2026-11-11

The run after the parity summary's deploy (20:07Z) failed Jumpers at 1280
and 320 px on both loads: the Winds aloft card's fetch got HTTP 503 from
api.open-meteo.com; every other page and the late-evening leg passed, and
Open-Meteo answered 200 again at 21:50Z. Nothing in the code; #297 is the
maintainer's to close (docs/live-checks-tally.md, "Since the tally").

Again 2026-11-24, the run after #317's deploy (run 45323219653, 03:59Z to 04:16Z): Jumpers at 1280 px failed on both loads, the winds request to api.open-meteo.com timing out from the runner (`net::ERR_TIMED_OUT`, four tries a load); the other 23 page and width combinations and the late-evening leg passed, a comparison run on a runner had its answer at 04:06Z, and Open-Meteo answered the sandbox in 0.15 s at 04:20Z. Nothing in the code: #317 changed the comparison script, not the app's request. Since 2026-11-23 the winds have no fallback, but the one they had could only fail, so the check reads an Open-Meteo outage as it did before. The check after the next deploy (#319, 2026-11-24, run 45344885971) passed on both legs.

## The outlook's daily gust maximum: one request, the address refused (2026-11-12)

Open since 2026-10-09 (docs/surface-wind-sources.md, "What changes, and
how often"): Open-Meteo's hourly gust at the DZ is the 15-minute step on
the hour, so it behaves as the last quarter hour's maximum, and over the
three-week sample sat below the hour's largest 15-minute gust at 285 of
466 hours, by up to 6.8 kt. The 10-day outlook's `wind_gusts_10m_max`
(the Daily forecast card's "g") is built from those hourly values, so a
day's figure may sit under the day's largest 15-minute gust. One request
would show it: the outlook's daily fields with `hourly=wind_gusts_10m`
and `minutely_15=wind_gusts_10m` in the DZ's time zone (five variables,
one call), and a count per local day of the daily maximum against the
largest of its 24 hourly values and 96 quarter-hour steps. Whatever it
finds changes no flag: the figure is Open-Meteo's own, under no limit,
and a finding would be a note beside it.

Tried from the sandbox on 2026-11-12 at 06:56Z, the session's first
Open-Meteo request: `429`, "Daily API request limit exceeded", with
`X-RateLimit-Limit: 10000.0`, `X-RateLimit-Remaining: 0.0`,
`X-RateLimit-Window: 86400` and `X-RateLimit-Reset: 1794528025`
(2026-11-13 00:00:25Z). So the shared address had spent its day on
requests that were not this repo's, the third such day (2026-09-23,
10-10, 11-12) and the first with the limiter's headers. The reset 25
seconds past midnight fits the reading that a client's day window rolls
from its first request ("Done: counting this browser's Open-Meteo
calls", below): an address busy around the clock has a first request
moments after its last window ends. Not retried (the convention). Still
to do, on a day the address has quota or as a step of a run on a runner.

**2026-11-13, refused again** (the maintainer asked why): one request at
17:02Z, the same 429, reset 1794614444 (2026-11-14T00:00:44Z), a window
opened when nothing of this repo was running. Four days in all. Runners
have their own addresses and have never met it; readers' browsers call
from their own. The one way to a quota of the sandbox's own is a key on
Open-Meteo's paid tier (counted per key), a cost and the maintainer's
call. Until then Open-Meteo work from here runs on a runner.

**2026-11-19, refused again** (the maintainer asked whether we hit the
limit): the rebuild review's live load at 1280 px got a 429 about 19:00Z,
the session's live-card captures at 21:00Z and 22:00Z drew the card with
no Open-Meteo row, and a one-variable request at 21:01Z answered 429 with
reset 1795132821 (2026-11-20T00:00:21Z), the same shape. Not us: this
repo's requests from the sandbox over the two days were a few Playwright
card loads, some tens of calls against 10,000. Five days in all (09-23,
10-10, 11-12, 11-13, 11-19).

**How the sandbox hits the limit, worked out 2026-11-19** (the maintainer
asked why and how). The sandbox leaves by a pool of addresses, not one.
Cloudflare's `/cdn-cgi/trace` on any host it fronts answers with the
client's address, and two allowlisted hosts are on it
(developers.cloudflare.com, the relay's workers.dev domain): thirty
requests a moment apart at 21:08Z left by eight addresses,
160.79.106.145, .147, .148, .149, .150, .151, .152 and .159. Open-Meteo's
limiter counts per IPv4 address (docs/open-meteo-terms.md,
`RateLimiter.swift`), so each address has its own 10,000 and its own
window, and six probes at 21:01Z and 21:09Z answered 429 with four
different reset seconds (00:00:01Z, :21, :24 and :32 on the 20th): at
least four addresses spent, each window reopened within half a minute of
the last ending, and no probe found an address with quota left (one was
cut off by the proxy, "Connection reset by peer"; a 429 costs nothing).
A pool of eight at 10,000 each is tens of thousands of Open-Meteo
requests a day from whoever else shares it. Whose the 160.79.106.0/24
range is was not read from here (no reverse record, no whois tool,
docs.anthropic.com not allowlisted); it is the egress every cloud session
on this platform shares, as far as the sandbox can see.

**Probed 2026-11-20 at 01:36Z**, the session being awake: three
one-variable requests all answered 200, cost 1.0, and the tightest window
reported was the minute's (600; remaining 599, 596, 595; two reset
seconds, so two addresses), so the day window on those addresses had more
than 99% left 96 minutes after the reset: the pool's day spend was under
about 70 calls. The quota is not burnt steadily; a window that reopens
seconds after midnight needs only one request then, and the 10,000 can go
in one bulk job later in the day. When it goes is unmeasured: a probe
every few hours on a day the session is awake would show it (a scheduled
wake for it was declined by the session's permission check on
2026-11-19). A runner cannot measure it. What would end it: the paid key
above; it goes in the query string (`apikey=`), which the session's
credential store cannot inject (it sets headers), so it would be an
environment variable the scripts read, never committed.

## The project profile: a draft, with lines to confirm (2026-11-23)

The maintainer, 2026-11-23: "Y to attribution trailers and draft a project profile". The draft is `.agents/project-profile.md`. Her yes on commit trailers is recorded there. Settled the same day: `CLAUDE.md`'s Copilot line now follows the global rule (hosted bots only when asked by name). Waiting on her, each marked in the file: whether the yes also covers the PR footer and the GitHub comment footer; that the repository is classed as holding no work data; whether pushing and merging are delegated after a clean local review; the README's "Built with AI" section, added 2026-11-23 at her word, where the description of her own part is the agent's wording; hard-wrapped or one-line Markdown paragraphs; adding a `.gitattributes`; `_scratch/` in `.gitignore`.

## Dropped: the FD winds fallback (2026-11-23)

The maintainer, 2026-11-23: "Drop the FD fallback". Done that day: the fetch, the bulletin parser, the `nws-fd` source, `SITE.fdWindsStation`, the cards' fallback branches and their tests are gone; the winds cards have one source and say "none loaded" without naming a second. The bulletin itself stopped: IEM's archive of NCEP's text products (`/api/1/nws/afos/list.json?cccc=KWNO&date=`, read 2026-11-23) holds FD1US1 four times on 11-02, twice on 11-03 (last entered 08:01Z) and none on 11-04 or 11-23, the Alaska, Hawaii and Canada bulletins stopping with it and only the Pacific ones (FBOC) going on; api.weather.gov lists the same. The code ran the fallback under Node that day: null after 11 requests. To restore it, the parser and fetch are in the history before this change.

The cause, read 2026-11-23: NWS Service Change Notice 26-47, "Termination of the NAM, SREF, HREF, HiresW, and NAM MOS: Effective Nov 3, 2026" (the updated issue of 2026-11-05, NOUS41 KWBC 051545 AAD; the PDF at weather.gov/media/notification/pdf_2026/SCN26-47_Retirement_of_NAM_SREF_HREF_HiresW_NAM_MOS_aad.pdf and the same text in IEM's archive, pil PNSWSH). NCEP discontinued the NAM at 12Z on 2026-11-03, replaced by the RRFS (SCN 26-48), and the notice lists under "WMO headers discontinued for NAM" `FB(US|AK|HW)3[135789] KWNO` and `FBCN3[135] KWNO`, the winds-aloft bulletins, and the older `FDUS`, `FDAK`, `FDUE`, `FDUM`, `FDUW` and `FDCN` headers from KWBC. It names no replacement bulletin and gives no reason particular to it: the bulletins are there only as headers "discontinued for NAM", the model they were made from. They were not in the notice's first three issues (2026-07-06, 09-09, 10-02); the fourth, of 2026-11-05, two days after the last bulletin, was "Updated to list additional WMO headers terminated with this implementation". Neither list the notice links for what the RRFS does not carry over (`www.emc.ncep.noaa.gov/rrfs_info/nam_retirements.txt`, `nam_sbn_removals.txt`, read 2026-11-24) mentions them. aviationweather.gov's own answer the same day: `api/data/windtemp` returns 400, "Wind/temp tables have been discontinued with the retirement of the NAM model", citing the notice. So no host has it, and the relay cannot help.

The same notice points to SCN 26-89 (2026-10-02) for the National Blend of Models: from the 12Z run of 2026-11-03 the NBM's NAM and HiresW inputs are replaced by the RRFS and REFS, over CONUS among others, and one dry-thunderstorm probability product is dropped; its text bulletins go on. That is the cycle at which the NBH header lost its version token (docs/nbm-lowest-cloud-base.md), and it means the NBM cloud base on the Ceiling & sky card, and the NDFD forecasts the error pages archive, straddle a change of input models on that date.

The Lincoln AI meetup deck was brought up to date the same day at the maintainer's word (below); the deck as given is in the history at 60e8b95.

## The RRFS: usable through Open-Meteo, not as a second source; logged beside the default (2026-11-24)

The maintainer, on the model that replaced the NAM: "can we use this?" Read 2026-11-24. NOAA runs the Rapid Refresh Forecast System hourly at 3 km and distributes it as GRIB2 on pressure levels and BUFR station soundings on NOMADS (`pub/data/nccf/com/rrfs/prod/`, listed that day; SCN 26-48), with no text bulletin, so a browser cannot read it and the relay would have to decode GRIB2 or BUFR: a project, not a fallback. Open-Meteo already serves it: its page for the endpoint this app calls is now "GFS & RRFS Forecast API" (open-meteo.com/en/docs/gfs-api), listing RRFS CONUS (3 km, hourly, 84 hours, updated every 6 hours) and RRFS North America (13 km) as selectable models (`ncep_rrfs_conus`, `ncep_rrfs_north_america`), and warning: "The HRRR weather model will be discontinued in the future with the release of RRFSv2. The NAM weather model will be discontinued at the end of November 2026 ... Please migrate to the RRFS models." So the RRFS can be asked for by name, but from the same host as the winds the app already reads: a second model to set beside the first, not a second source for when Open-Meteo is down.

What it touches here: the winds request names no model, so it takes Open-Meteo's default. Checked 2026-11-24 about 03:20Z, at her word, with the app's own request sent four ways from the sandbox (about 80 of the address's calls): the default was identical to `ncep_hrrr_conus` and to `gfs_seamless` at 960 of 960 hour-levels (48 hours, twenty pressure levels) and to `ncep_rrfs_conus` at none, so the default does not draw on the RRFS yet. The RRFS served all twenty pressure levels for all 48 hours and the 10, 80 and 120 m winds, not the 180 m one (the default has it; the HRRR by name has 10 and 80 m only). For that one hour the RRFS table was within 15° and 5 kt of the default from 500 ft up, 24° off at the surface in a 4 kt wind.

Logged from 2026-11-24, at her word: every comparison run also asks the RRFS for the same hour and records its table minus the default's, row by row, with the model's run (`rrfs` on the record, `RrfsLog`; `rrfsLogOf` in src/domain/modelCompare.ts, `levelDiffs`; scripts/schulzeCompare.live.ts), so the size of the change is on file before Open-Meteo drops the HRRR. One more winds request a run, on the runners' addresses. The first full record, 04:03Z that day: the RRFS run served was the 18Z one, available at 03:02Z, nine hours after its start, where the HRRR is hourly. The plan is docs/rrfs-comparison-plan.md (2026-11-24, at her word). Built the same day at her go-ahead: the RRFS's 10 m wind in the surface-wind sampler against KPMV (record version 3, a fifth row on `#wind-errors`), a daily check that opens one `model-switch` issue the day the default stops being the HRRR, and both models' cloud cover on the comparison's record. Not built: the figures on `#parity`, the reading of the 500 ft row, and the archive by lead on `#wind-errors`. Three decisions left for the maintainer in the plan: when the page shows the rows, whether to split the error pages at 2026-11-03, and what to do when the default does switch.

## The session's environment: hosts and wildcards restored (2026-11-23 and 11-24)

Read with `get_environment` that day: the session runs in the personal environment "sandbox" (107 hosts, shared with other projects), which had `api.weather.gov` and `radar.weather.gov` but not the `*.weather.gov` wildcard, and none of aviationweather.gov, NOAA's raw-file host, `gml.noaa.gov`, USPA, eCFR, the FAA's sites, usairnet, markschulze.net, the Naval Observatory or the NOAA S3 buckets, all of which CLAUDE.md lists. The maintainer: "I may have removed them by accident." Restored the same day on her approval, as exact hosts (`update_environment` takes no wildcard): `aviationweather.gov`, `www.weather.gov`, `forecast.weather.gov`, `tgftp.nws.noaa.gov`, `gml.noaa.gov`, `www.uspa.org`, `www.ecfr.gov`, `www.faa.gov`, `www.faasafety.gov`, `www.usairnet.com`, `www.markschulze.net`, `aa.usno.navy.mil`, `noaa-ndfd-pds.s3.amazonaws.com`, `noaa-nbm-grib2-pds.s3.amazonaws.com`; www.weather.gov and aviationweather.gov answered within a minute. The maintainer added `*.noaa.gov` in Settings the same evening; on 2026-11-24 01:08Z three NOAA hosts never listed by name (`www.emc.ncep.noaa.gov`, `www.nco.ncep.noaa.gov`, `www.ncei.noaa.gov`) answered. She then entered the rest in Settings, each wildcard with its bare domain: `*.weather.gov`, `*.aviationweather.gov`, `*.open-meteo.com`, `*.uspa.org`, `*.ecfr.gov`, `*.faa.gov`, `*.faasafety.gov`, `*.usairnet.com`, `*.markschulze.net` (read with `get_environment` 2026-11-24, 139 hosts; `digital.weather.gov`, `uspa.org`, `ecfr.gov`, `faa.gov` and `usairnet.com` answered). Open-Meteo is reachable again, so the rule against spending its shared quota from here matters again. Still hers to decide: a dedicated environment for this repository ("maybe we should have a dedicated cloud environment for this project?"). One named "LSPC" exists but holds another project's hosts, and a running session cannot be moved to another environment.

## AXIS Flight School's tools, beside this app (2026-11-24)

At the maintainer's word, docs/axis-conditions-tool.md: what AXIS's pages for Skydive Arizona read and show that this app does not, to inform decisions here and not to copy (her word the same day; the doc's "What it suggests for this app" is the reading), from twenty-five screenshots she sent (the site was not opened; the sandbox's proxy refuses `axis.tools` and the environment change to allow it was rejected). Sources this app lacks: NOAA's rucsoundings for the winds (not read, the host reset the connection twice), a weather station at the field through Weather Underground, and the DZ's manifest. Waiting on her, in the doc's order: an exit-separation calculator on the Winds aloft card from SIM 4-7 C's 1,000 ft and 1,500 ft (read at uspa.org 2026-11-24), the best candidate; a moon line, if LSPC runs night jumps; a station at the field; heat index and a "a report cannot show a changing wind" sentence. Also hers: the Canopy Risk Quotient, which AXIS says is USPA's paper; USPA's link answers with its 404 page and its search finds nothing (2026-11-24), and the Wayback Machine could not be tried from the sandbox (`web.archive.org` and `archive.org` refused, the environment change rejected), so whether a copy exists is unchecked. And whether to find and read the SIM's wing-loading table for advanced canopies, which AXIS quotes as 6-10 B (`uspa.org/sim/6-10` served no section text that day), for a note on the Wing loading card. Not taken: "insignificant" gusts (a threshold of AXIS's own), wind chill aloft, AXIS's canopy size recommendation, the repack date, the draw generator and ChronoPrism (competition tools).

## A template repository for any drop zone (2026-11-22, reviewed 2026-11-23 and 11-24)

The maintainer asked for a plan to make a repository, based on this one, that any DZ can use as a template for its own weather page. The plan is docs/dz-template-plan.md: what is generic and what is LSPC's (399 site-specific lines in 108 files, most in comments and tests; the behaviour sits in `site.ts`, the waiver tiers and two `dzFact` entries, the canopy list, the gust and cloud notes, the relay's station file, the page counter and the live scripts), a setup command that finds a DZ's stations from its coordinates (the NWS points endpoint, its gridpoint stations list, IEM's network files, the TAF locations list and the radar stations list, each read 2026-11-23), seven phases, and decisions for the maintainer (eleven then, sixteen since 2026-11-24). Two fresh agents reviewed it on 2026-11-23, the second after the first's edits were in; their checked findings are in the plan with their dates, and the claims that mattered most (the FD feed above, the stations list and its empty next page, the relay's three importers) were checked again here. The second also settled three things the first could not: IEM's id for a four-character ident is the ident without its K, the NBM bulletin lists AWOS stations, and IEM's currents API takes a WFO or state. Nothing built; waiting on the decisions.

A third agent reviewed it on 2026-11-24 for whether another DZ could actually stand one up, walking two stand-in points (an on-field AWOS at sea level, one at about 5,050 ft) through the plan with eight GETs. Its findings are folded into the plan that day; what changed: an unconfigured state and a setup that runs from the GitHub web interface; a new section, "What a blank config shows" (eight per-DZ facts, each with what a sparse config must print so the page is not untrue or an all-clear); exit altitudes as one config figure (Drift stops at 13,000 ft and the table folds at "LSPC's usual max" today); a wider tier schema (an empty tier list throws, `App.tsx`); a null relay drops the NBM rows for every DZ, not only a military TAF; a 24-hour liveness window in place of 90 minutes (two part-time Florida stations dropped at 05:39Z); the TAF check against aviationweather.gov from Node in place of a name list (it missed Buckley Space Force Base and Butts Army Airfield); phase 7's "merge is clean" replaced by three routes, since a template copy has unrelated history; and five new decisions (12 to 16: how instances are made and updated, commercial DZs under Open-Meteo's terms, whether the winds request names a model, the official or unofficial wording, tandems). Checked again here: every code line it cited that the plan now leans on (`WAIVER_TIERS[0]`, the Drift options, the C-182 subtitle, the crash screen's Offutt link, the relay header, the typed "last 30 min" and dates), its station findings against the JSON it saved, the sky-parity tally (12 of 45), and three GitHub behaviours it had from memory, read at docs.github.com and in `configure-pages`'s `action.yml` on 2026-11-24: scheduled workflows stop after 60 days without activity in a public repository; a template copy starts with one commit and unrelated history; `enablement` "requires a token other than `GITHUB_TOKEN`". Still unchecked, each named in the plan: whether a template's first commit starts the push workflow, a first deploy on a fresh account, NOAA's bucket answering a browser Range request, Open-Meteo's levels at a high field and under the RRFS, whether a published tandem wind limit exists, and whether a paid Open-Meteo key can sit in a static page. The review's fetches are in the session scratchpad only (not kept).

## Card wording: less wordy notes and explanations (2026-11-21)

At the maintainer's word, a review of every user-facing string
(docs/card-wording-review-2026-11-21.md: a table of note height against
data height per card at 390 px, then current and proposed wording for
every note over about 40 words, with word counts and the tests that pin
each string). On the Student Jumpers page the notes are 1,669 words,
proposed 1,308; the Ceiling & sky key is 606 px of prose under 1,101 px
of tables, Surface wind's notes 346 px over 209 px of data. Nothing in
the app changed. Hers to pick from; the doc's recommended order is the
forecast wind flag (which repeats the observed flag's guidance beneath
it, 161 to 76 words), the Ceiling & sky key as a list keyed by the row
labels, the Winds aloft "About these numbers", the non-VFR note's 91.155
rows into a `<details>`, then Density altitude. Flagged for her as the
app's own judgements: the outlook's "confidence drops fast past a few
days", the drift card's "deploy above your minimum, not at it" and
"rougher half of the estimate", Winds aloft's "treat them as guidance",
and "IFR: reduced ceiling/visibility". Flagged as stale: the `#citations`
intro's CFR reading date (2026-09-23; the log says 2026-11-03 and names
91.155), a "used to" history sentence on the outlook's fallback note, and
the disclaimer's "read on 2026-09-22 and 2026-09-23" (pinned by
tests/disclaimer.test.ts; "first read" proposed).

**Built 2026-11-22 at her word:** the Winds aloft card's four folded paragraphs are a page of their own, `#winds-method` ("How the winds aloft table is built", `src/components/WindsMethodPage.tsx`, linked from the card and the footer, on the live-site check's page list), and the card keeps one line per fact (W1 to W4; the ground figure for the hour stays on the card, since it changes); the Forecast wind flag carries the limit's own sentence and a pointer to the Surface wind card instead of repeating the observed flag (F2, 161 to about 70 words, the waiver citation gone with the waiver sentence); the Ceiling & sky non-VFR note folds 91.155's rows under a summary and drops "reduced ceiling/visibility" (C4). Fixture build: every page at every width passed `scripts/liveSite.ts` from the sandbox. Waiting on her: P3 (Density altitude's second note under "How the figures are worked") and the rest of the doc's proposals.

## Code review and docs audit of the whole project (2026-11-20)

Four agents at the maintainer's word, each in its own worktree with a
scope no other could edit, each fixing only verified, small, local bugs
with a test proved by breaking, and writing the rest down. Their
write-ups, each with what was looked at, each finding with file:line,
what changed and what was left:

- docs/code-review-2026-11-20-domain.md (src/domain and its tests): four
  fixed, among them usairnet's METAR dated a month ahead in the first
  minutes of a month (`metarObservedMs` used a TAF's day rule) and a
  blank NBM sky field read as 0% cover; six left.
- docs/code-review-2026-11-20-ui-api.md (components, hooks, api, config,
  styles): eight fixed, among them the 10-day outlook's "Today" taken by
  position, which after local midnight on the gridpoint fallback labelled
  yesterday "Today", and the daily fixture anchored at 12:00 UTC;
  duplicate React keys on the Ceiling & sky card's two NBM sources (one
  URL); a TAF error printing its whole URL; dead CSS and dead
  `ceilingCoverage`; seven stale comments; seven left.
- docs/code-review-2026-11-20-ops.md (scripts, workflows, relay): one
  fixed by the agent (the sky-parity issue step commented on any open
  issue when the label was refused) and three by the session the same
  day (parity-summary's checkout takes the whole history for its rebase,
  its artifact listing no longer swallows a failure, live-site's issue
  step guards its label); five left.
- docs/docs-audit-2026-11-20.md: 17 corrections in 11 documents, the
  undated present tense brought to the code as it is, dated readings left
  alone; one finding (the dead export above, since removed).

The four together, on one branch: the four gates green (95 files, 1,428
tests), `scripts/liveSite.ts` run from the sandbox against the combined
fixture build, both legs, every page passed at every width; CI green on
PR #307.

Left for the maintainer, the heaviest first (the docs have the rest):

- **parity-summary.yml downloads every unexpired surface-wind artifact
  daily**: about 1,100 zips in 14 minutes on 2026-11-18 and 1,165 the
  next day, heading for about 2,500 around 2026-12-10 (one artifact per
  sample since 11-10, 30-day retention), against GitHub's documented
  1,000 requests an hour for the workflow token (read 2026-11-20; the
  11-19 run made about 1,300 in 16 minutes without a 403, so whether zip
  downloads count is unclear). A `created_at` window of about seven days
  in the listing would hold it; a policy call beside the 2026-10-30 word
  not to time-box the sample.
- **`fmtLimitSpeed` prints a whole-knot limit without the decimal**
  CLAUDE.md says limits render with ("12 kt" beside "16.5 kt"); a wording
  call, and tests/advisories.test.ts pins "use 12 kt".
- **`comingHours` "next 12 hours" takes 13 points** (the hour under way
  and twelve more); the test pins it; a wording call.
- **`useWeatherData`: an older refresh's late timeout can mark a newer
  report stale** for up to two minutes (the observation's success does
  not record its refresh sequence); and `withStaleness`'s memo omits
  `now`, so the 30-minute age rule is latent. Both in the UI review doc
  with the shape of a fix.
- **`spot.ts` `integrate`** takes the mean of a layer's two bounding
  winds over a partly crossed layer, not the mean over the crossed part:
  inside the estimate's stated tolerance, and a change would move a
  figure readers compare with Schulze's.
- **Artifact names `parity-<run id>`** carry no run attempt (the
  surfacewind names do); upload-artifact v4 may reject a duplicate on a
  re-run; unverified from here, no re-run in the last 100 runs.
- The advisory list's empty state with no observation loaded, the gust
  readout's colour being the Watch badge's, `SourceLink`'s ⓘ label on a
  role-less span, the keeper's three retries of a 429 (runners only), the
  refresh's single push after its rebase, the sampler loop's 120 s grace:
  each a note in its doc.

## Issue #283: uspa.org behind a Cloudflare challenge for a day, as on 10-09

The sky-parity run of 2026-11-09 (22:45Z, run 42714634052) failed every
SIM-text test, 31, and opened #283: uspa.org answered each request `403`
with `cf-mitigated: challenge` ("Just a moment..."), from a runner in ORD
and, read from the sandbox at 01:08Z on the 10th, from IAD too. Every
other check passed; the run of 11-08 had passed, so the challenge began
between 18:07Z on the 8th and 22:45Z on the 9th. The same thing happened
on 2026-10-09 (#135). **Over, 2026-11-10:** at 14:40Z uspa.org answered
200 again and a dispatched run (42836524194) passed every test, the 32
SIM-text ones included. A one-day refusal; nothing changed in the code,
and nothing should: it is uspa.org's choice who reads its pages by
script, the check sends an honest User-Agent, and working around a bot
check is not something this project does. What the check loses while a
challenge stands is its daily fingerprint; the citations are unaffected.
#283 is the maintainer's to close. If a third day comes, the question is
whether a daily issue for a standing challenge is wanted or the check
should log the refusal as a note and fail only on a changed part; that
changes what the check promises (CLAUDE.md, "Citations"), so it is hers.

## The surface-wind sampler lost its runner once (2026-11-07)

The job of 2026-11-07 16:37Z (run 42392240606) failed in its fourth hour
("The hosted runner lost communication with the server"); the first three
hours' artifacts were uploaded, hours 4 and 5 were not run, and the
five-hourly schedule started the next job at 23:57Z.
About four hours of samples (19:38 to 23:57Z) are missing from
`surfacewind-2026-11`; nothing in the script failed. The first such loss in about 1,000 hours; noted so a
gap in the archive that day is not read as a fault of the sources.

**Done 2026-11-10, at the maintainer's word:** the job samples in
eighteen slices of one cadence, seventeen minutes, with an upload after
each, so a lost runner costs at most the sample in hand; and each run
queues its successor before it starts, as the forecast keeper does, so
the chain does not wait on the schedule. The loop's grid logic takes only
the latest tick within its grace when a slice starts a little late (the
old arithmetic took every tick in the window, which a 30-second cadence
under test showed and the 17-minute cadence never could). The archiver
reads any `surfacewind-*` artifact and paginates, so eighteen a run
changes nothing there; about 110 artifacts a day, kept thirty days. The
first run of the new workflow (42736056524, 2026-11-10) queued its
successor and uploaded one artifact per slice seventeen minutes apart;
the 00:41Z scheduled start that night never appeared, GitHub's throttling
of a cron line, which is what the queued successor is for.

## Done: how often each check cried wolf (2026-11-07)

Tallied at the maintainer's word in docs/live-checks-tally.md:
sky-parity failed 12 of 45 scheduled runs, four on the app's TAF decoder
(never shown to a reader), three on the check's own strictness, five on
one bad answer from another host, all but the 403 covered by the retry
rules since 2026-10-31 and 11-01; the live-site check failed 8 of 148,
one the site's (#249), six the runner image (#237), one unexplained
(#208). Nothing in either check's rules needs loosening. Take it again
after a month of the retry rules.

## Settled: the flight categories against 105.17 and BSR 2-1 I; 91.155 cited (2026-11-03)

The maintainer asked whether AIM 7-1-7's LIFR (ceiling under 500 ft
and/or visibility under 1 SM) and IFR (500 to under 1,000 ft and/or 1 to
under 3 SM) are incompatible with 105.17's minimum visibility by the
figures alone, nothing judged; and asked for 91.155 to be cited and
linked, since the flag's guidance named the pilot's VFR minimums with no
source.

Read on 2026-11-03 through the eCFR API (Title 14 current as of
2026-10-30): 105.17, 105.19 and 91.155 in full, each matching its claim;
the versions endpoint lists no change to 105.17 or 91.155 since its
earliest point, so the text is the one read on 2026-09-23 (law.cornell.edu,
the link the maintainer gave, is not allowlisted). SIM 2-1 the same day:
2-1 B says no skydive may violate FAA regulations, and 2-1 I's minimum
opening altitudes are as cited (tandem 5,000 ft AGL, students and A
3,000, B 2,500, C and D 2,500, waiverable to no lower than 2,000).

What the figures say:

- **By visibility: yes.** Every row of 105.17's table asks at least 3 SM
  (3, 3 and 5 SM) and the table has no airspace column, so Class G's
  1 SM in 91.155 does not loosen it; IFR's and LIFR's visibility bands end
  below 3 SM. The Visibility flag already prints that ("under both rows").
- **By ceiling alone** (visibility 3 SM or more): the visibility rows are
  met, so it is 105.17 (a), no parachute operation into or through a
  cloud, and (b), 500 ft below any cloud in the rows below 10,000 ft MSL,
  set against BSR 2-1 I: the lowest opening altitude anyone may use is
  2,000 ft AGL, so under a ceiling below 1,000 ft AGL every canopy opens
  above the layer and comes down through it or its gaps. An overcast has
  no gaps; a broken layer (5/8 to 7/8) has them, 105.17's 2,000 ft
  horizontal distance holds in them, and the METAR does not say where
  they are, so for a broken ceiling the figures say "through or within
  2,000 ft of cloud", not "through cloud".
- **MVFR** (ceiling 1,000 to 3,000 ft and/or visibility 3 to 5 SM) the
  figures do not settle: 3 SM meets the two lower rows and a 3,000 ft
  ceiling is above every opening altitude; what the reader compares it to
  is the exit.

The app still gives no verdict. At the maintainer's word later that day
the flag prints the comparison under IFR or LIFR
(`flightCategoryComparisonText`, `src/config/thresholds.ts`; built in
`src/domain/advisories.ts` from the half of the report that put the
category in those bands): the visibility against 3 SM, the lowest row of
105.17's table, which has no airspace column; and the ceiling against
2,000 ft AGL, the lowest minimum opening altitude in BSR 2-1 I, with
105.17's cloud rules and the gaps sentence when the layer is broken. Each
section named is linked (the advisory's `citations`, one ordered list).
2-1 I is not among A9's sources on `#citations`, since the daily SIM
check would then test A9's AIM quotation against 2-1 I's text; A9 says
the figure is A2's and asks whether the reading is right. MVFR gets no
comparison. The flag's level (MVFR a watch, IFR and LIFR a caution) is
still the app's and the maintainer's call. Two cleanups the same day, for
no change on screen: 2-1 I's altitudes are one table
(`OPENING_ALTITUDES_FT_AGL`, the C/D waiver floor beside it, the lowest
figure derived), from which the citation's label, A2's claim, the drift
card's note and defaults and the comparison's 2,000 ft are built; and the
advisory's three citation fields (`citation`, `secondaryCitation`,
`furtherCitations`) are one ordered list, `citations`, the
trigger's source first, held by a test to one link per authority.

Done the same day: `CITATIONS.far91155` (14 CFR 91.155, Basic VFR
weather minimums), its reading-log entry, the flag's guidance naming it
as its second link, the Ceiling & sky card's note giving every row of its
table (`FAR_91155_ROWS`: Class E and G, day and night, both altitude
bands, since the app reads neither the airspace nor the band) under
105.17's, and A9 citing and quoting it. The change's review found the
card saying "the same distances" after 105.17's higher row, printing only
the day rows and the lower Class E band, A9 stating 105.17 (b) as 500 ft
without its band, and the app's comparison filed among the source's
words; all fixed the same day. Which airspace is over the DZ the app does
not read; the sectional on the Pilots tab shows it, and A9 asks the pilot
which rows apply and whether any surface area of controlled airspace
(91.155 (c) and (d)) reaches the DZ.

## Review of the whole project (2026-11-03)

At the maintainer's ask, a review agent read the whole project for
correctness bugs with the no-verdict rule in its brief (`npm test` green
at 1,320). Nine findings, fixed the same day with a test each proved by
breaking the fix:

- **The source log dropped every NBM entry on reload:** `src/api/sourceLog.ts`
  kept its own list of sources, which lacked `nbm`. The list is now
  `SOURCE_KEYS` in `src/domain/types.ts`, from which `SourceKey` derives.
- **With the relay off, the Refresh button stayed disabled for the life
  of the page** (unreachable on the deployed site): the refresh marked
  every source pending and nothing fetched the NBM. It now marks only the
  sources it fetches (`sourcesFetched`); Data health lists the same.
- **A HEAD that threw aborted the relay's NBM lookup** instead of moving
  to the older file as a refused HEAD did (`relay/src/nbm.ts`). Caught
  now; `tests/nbmRelay.test.ts` throws one.
- **Two overlapping refreshes let an older answer overwrite a newer one:**
  each refresh is numbered and a source's answer applies only if no newer
  refresh's has (`src/domain/latest.ts`), for the winds, outlook, TAF and
  NBM.
- **The stored wind unit was used unvalidated** (`lspc:windUnit` set by
  hand printed "12 foo"): `toSpeedUnit` validates it.
- **The NWS path rounded visibility to a tenth** (1/4 SM read 0.3) where
  IEM kept 0.25; now to the sixteenth of a mile, which also turns NWS's
  16,090 m for 10 SM into 10.
- **The NWS path passed the decode's 0° for calm** while the type said
  calm has no direction; nulled now.
- **The hourly chart's `maxKt`/`gridKt` were in the display unit:**
  renamed; the arithmetic was right.

A second review of the fixes found seven more, fixed the same day: the
refresh guard covered only successes, so an older refresh's late failure
still marked a source stale and a late "no current TAF" blanked a newer
TAF (now a source applies only its newest refresh's result, success or
failure, and a superseded catch returns at once); the visibility fix had
stopped in the domain while the METAR card, the flag and the
nearby-stations table still rounded to a tenth (every print now goes
through `fmtVisibilitySm`, which writes the METAR's fractions); the
relay's catch swallowed a bucket that timed out on every HEAD into "has
no NBH file" (now "unreachable"); a stale `comparableDirection` comment;
and the surface-wind sample's record version is 2 (a calm NWS report now
carries no direction), with the `#wind-errors` direction error skipping a
calm report on either version. One Refresh-button test was dropped as
unable to fail against the old code. The relay change was deployed by
Workers Builds on merge (2026-11-03 01:29Z), which builds `relay/` from
`main`; this entry said it waited on the maintainer until 2026-11-04.

**The modules the first pass had not read**, reviewed the same day at the
maintainer's ask (the parity and wind-error summaries, the kept-forecast,
NDFD gust, chances, cloud-cover, usairnet, SIM-text and citation-answer
modules, the three report pages, the comparison and live scripts): eight
findings, fixed with a test each where the code is pure:

- `vsMetarOf` counted a direction error for a calm NWS report on a
  version-1 record, where the page already skipped it; it skips it now.
- `#wind-errors` said the sample was every five minutes; seventeen since
  2026-10-30.
- The hour's rain amount came from the first hourly report, so a
  corrected report after one reading `P////` left it unknown; null only
  when no report gave a figure.
- Spreads over standing archives (`Math.min(...leads)` and the like) that
  V8 refuses past about a hundred thousand values: a loop (`extent`) at
  every site in `src/domain` whose list grows with an archive.
- The Open-Meteo wind fetch passed the weekly refresh's "nothing newer"
  gate on either run alone; the gate is now per run.
- The Schulze comparison would have failed the daily run on a 200 whose
  body was not the forecast, thrown outside its try; caught now, counted
  under `unreadable`.
- Two more, changed 2026-11-07 at the maintainer's word: `arrivalLags`
  timed only the newest report a source gained between samples, and now
  times every one (docs/source-parity.md: four more reports timed, no
  median moved, usairnet's longest lag 28 to 48 minutes); and
  `scripts/cloudCoverFetch.py` wrote its records only after every
  download, so a failed one lost the rest of the part; it now writes
  each fetch as it comes back, and the by-hand workflow uploads the file
  on failure too (the weekly refresh still commits only after a clean
  exit). Checked 2026-11-07 with a one-day METAR fetch and an Open-Meteo
  site at an impossible latitude: the METAR records were kept, the run
  failed on the 400 and said so.
- **For the maintainer's judgement, not changed:** the flight-category
  flag's level is the app's (MVFR a watch, IFR/LIFR a caution,
  `src/domain/advisories.ts`), and so is the overcast flag's watch; AIM
  7-1-7 defines the categories, not a severity. Whether a level with no
  published source sits with the no-verdict rule, or the two flags should
  carry one neutral level, is the maintainer's call; put to the S&TA on
  2026-11-05 as B2 on `#citations` (item 3 at the top), unchanged until
  answered.

Reviewed and found sound: the advisories and thresholds, the METAR, TAF,
FD and Open-Meteo normalisers, the winds-aloft interpolation and the "As
Schulze" view, the sun, density-altitude and flight-category arithmetic,
the page count and usage counters, the live-site and live-issue rules,
`fetchJson`, the gridpoint dedupe, the TAF chain, the relay's origin rule
and range cut, the polling hooks' pause and resume, the cards' wording,
every workflow's shell, and the tests for self-asserting assertions.

## Watch: a change document for the 2026 SIM

USPA revises the online SIM within an edition through change documents,
listed on https://www.uspa.org/sim under "Available Change Documents". The
list loads by script, so a fetch cannot read it. In the maintainer's
browser on 2026-10-10 it held only an Archive folder (2021-2022 SIM Rev1
to Rev4, 2023-2024 SIM Rev1 to Rev3), none for the 2026 SIM. When one
appears, read it, read again any part it changes that this app cites or
quotes, and record it in `src/config/readingLog.ts`. The daily
fingerprint check catches a changed cited part either way; a change
document is what would name the revision.

## Done: the waiver sign's photo under the tier selector

Asked 2026-10-08, added 2026-10-09: under the LSPC waiver tier buttons
(`ProfileSelector`), "Photo of the posted sign (undated)" opens
`public/lspc-waiver-sign.jpg`, served with the site. It is a crop of
`docs/lspc-waivered-wind-limits.jpg` (the photo as taken, kept as the
record) to the framed sign, 1,400 px wide and about 210 KB against 3 MB;
a test checks the file is there.

## Open-Meteo's cloud cover: shown, and now compared

Added 2026-10-08 at the maintainer's request: the Ceiling & sky card
shows Open-Meteo's total cloud cover beside the NWS sky cover, with the
low/mid/high bands in the tooltip. It rides on the winds request
(`OPEN_METEO_CLOUD_VARIABLES`), is left out when Open-Meteo does not
answer, and is never shown as a ceiling: Open-Meteo serves cloud as a
share of the sky (total, and bands to 3 km, 3 to 8 km and above 8 km;
open-meteo.com/en/docs, read 2026-10-08), with no base height. It is one
colour whatever the amount; since 2026-10-09 the NWS bars are too (the
few/scattered/broken/overcast colours had no key and read as a verdict).

What the dashboard reads the sky from: now, the KPMV METAR (IEM first,
api.weather.gov second, sky groups parsed from the text:
`normalizeIemCurrent`, `normalizeNwsObservation`); forecast hours,
the NWS gridpoint's `skyCover` and derived ceiling with Open-Meteo's
cover beside it; the 10-day outlook, Open-Meteo's daily weather code, or
on the fallback the day's mean NWS cover.

Compared 2026-10-10 over six months (2026-04-01 to 10-09, 4,482 hours):
the NWS forecast from NOAA's NDFD archive and Open-Meteo's from its
Historical Forecast and Previous Runs APIs, each against KPMV's report
([cloud-cover-sources.md](cloud-cover-sources.md)). The two read
differently rather than one tracking the other: the NWS figure is graded,
seldom 0 or 100, its median rising with the reported cover (23% on CLR
hours, 83% on OVC); Open-Meteo's is near yes-or-no; at the same hour they
differed by a median 19 points; each was at or above 5/8 on about three
quarters of the hours KPMV reported a ceiling and about a fifth of the
hours it reported none (some of that fifth may be cloud above the
ceilometer's 12,000 ft). Decided 2026-10-10 by the maintainer: the card
keeps both, with a note on how each compared (`CeilingSkyPanel`, figures
in `src/config/cloudComparison.ts`). The per-pressure-level cover (`cloud_cover_850hPa` and so on) is not
used: every level read 0% the day it was looked at.

Found on the way, not explained: **KPMV never reports FEW.** None of its
71,889 reports from 2024-01-01 to 2026-10-10 had a FEW layer, against
2,896 at KLNK and 7,214 at KOFF, so a KPMV SCT may cover amounts under
3/8, which the card, showing the layers as written, does not say. Looked
into 2026-10-10 (cloud-cover-sources.md, "Stations that never report
FEW"): 19 of 46 Nebraska stations reported no FEW in September 2026, all
AWOS sharing one report shape, while every ASOS reported FEW; the FAA's
AWOS standard requires FMH-1 coding, which has FEW, and publishes no
algorithms; the likely cause is one family's software, unconfirmed, and
the state aeronautics division or the manufacturer could settle it. Dated
the same day ([cloud-cover-stations.md](cloud-cover-stations.md)): seven
AWOS reported FEW until new equipment (remarks AO1 to AO2) arrived
between 2002-08-27 and 2003-03-04, and none has since; beside a nearby
ASOS, a no-FEW AWOS reports SCT where a FEW-reporting AWOS gives FEW, and
agrees about ceilings as often. Open-Meteo's start of run agreed with each
station's ceiling call more often than the NWS at all fourteen stations
fetched 2026-10-11, and neither forecast reads much differently at a
no-FEW station.

Ceiling heights, compared 2026-10-13 ([ceiling-heights.md](ceiling-heights.md)):
the NWS ceiling was within 700 ft of KPMV's on half the hours both had
one, a median error of one 100 ft step by band; it seldom forecast a
ceiling under 500 ft (41 hours against 149 reported). Open-Meteo has no
ceiling figure; its low band marks a ceiling of 3,000 ft or lower on 92
to 93% of those hours without placing it. Whether the card should say so
is open.

## Done: counting this browser's Open-Meteo calls

The maintainer, 2026-10-31: first track the usage. Built the same day.
Each attempt at an Open-Meteo request (`fetchJson`'s `onAttempt`, so a
retry counts every try, as the server charges) is recorded with its
charge by Open-Meteo's formula (`openMeteoCallWeight`,
`src/domain/openMeteoUsage.ts`: variables over ten, times days over
fourteen above fourteen, never under 1) and by how it ended: the weight
when answered or timed out on this side (the server had the request); 1
on an HTTP error, the limiter's 429 included; nothing when it never
arrived. In memory and this browser's localStorage
(`src/api/openMeteoUsage.ts`, pruned to the last fourteen UTC days). Data
health shows today's and this hour's requests and calls beside the free
limits (10,000 a day, 5,000 an hour, per address), says other browsers on
the address share the limits unseen, and lists the fortnight by UTC day.
The summary's windows are the clock's; the limiter's roll from the second
of each client's first request (`RateLimiter.swift`, read again
2026-11-04, correcting the 10-31 reading), so the UTC day is an
approximation, close while the site is used around the clock. Two tabs of
one browser merge their records on each write; a restored fortnight shows
on the first render; an answered request whose body will not parse counts
once. It cannot see any other browser's requests or the server's tally;
to read typical usage, open Data health on a device that has been showing
the site and expand "By day".

**The headers appeared, and are exposed (read 2026-11-04 07:35Z).** The
API answered the app's winds request with `X-RateLimit-Cost: 9.6` (the
formula's figure exactly), `X-RateLimit-Limit: 600.0`,
`X-RateLimit-Remaining: 577.4`, `X-RateLimit-Reset` and
`X-RateLimit-Window: 60`, and names them all in
`access-control-expose-headers`, so a browser may read them. They carry
the window with the least remaining, ties to the later reset (`quota()`,
same reading): on a quiet address the minute's, and the hour's or the
day's only once its remaining falls under the minute's, that is, once the
day has about 9,400 calls on it, which is the signal the refresh-slowing
idea below asked for. Built the same day at the maintainer's word:
`fetchJson` hands the answer's headers to its caller, the Open-Meteo path
keeps the newest answer's figures (`parseRateLimitHeaders`, `ServerQuota`,
in memory only), and Data health prints them under the browser's count
("Open-Meteo's own count for this address, from its answer 3 min ago:
577.4 of 600 calls left this minute, every browser on the address
included; that request cost 9.6"). Checked in a production build without
fixtures through the proxy at 1280 and 320 px: the line showed, no
sideways scroll.

The maintainer, 2026-11-04: are we logging usage over time? The browser's
own count is, for fourteen days; the server's figures were not. Built
2026-11-05: each request record carries the server's reading from its
answer (`s`: remaining, limit, window), stored with the record, and the
By-day table has a fourth column, "Server's tightest" (`tightestOf`,
`UsageDay.tightest`: per UTC day the fewest calls the server reported
left, the later reading on a tie), the address's nearest approach to a
limit as this browser saw it, without a backend. Checked at 320 and 390 px.

## Maybe, later: slow the refresh when calls run high

The maintainer, 2026-10-31: could the refresh slow to every 15 minutes
when calls exceed a threshold? Not built; noted for after the counting
has shown typical use. It would take a threshold on the server's
`X-RateLimit-Remaining` (now readable), the winds timer (`REFRESH_MS`,
`src/hooks/useWeatherData.ts`) taking a longer interval while over it,
and a Data health line saying so. The cost is what the ten-minute refresh
buys: a new HRRR run reaches Open-Meteo between :20 and :59
(docs/run-split.md), and a fifteen-minute refresh sees it up to five
minutes later. A refresh rate, not a weather judgement; the line that
says it is slowed must still be a fact, not advice.

## Open-Meteo's call counting: the winds request counts as 9.6 calls

Found by the 2026-10-31 re-reading of Open-Meteo's pages
(docs/open-meteo-terms.md, "Read again 2026-10-31"): the pricing FAQ
defines an API call as more than 10 variables or more than 2 weeks, so
the winds-aloft request's 96 hourly variables for two days
(`openMeteoHourlyVariables`, `src/domain/normalize.ts`) are about 9.6
calls, and a browser refreshing every ten minutes makes about 1,400 a day
plus the outlook's 144. **Settled the same day, from the source:** the
free API's server is open source and its limiter charges every free
response the FAQ's weight (same doc, with the files and formula): 9.6 for
the winds request, 1 for the outlook. The limit is per address, each
reader's own, so the exhaustion test the maintainer proposed could never
reach a reader and would have cost the sandbox's shared address its day
and run against a service whose README asks for fair use; no test, no
warning.

The exposure: 10.6 calls a refresh, 144 refreshes a day for a tab left
open and visible (`usePolling` stops the timer while hidden), about 1,500
a day; a phone looked at for ten minutes costs 11 or 21. Seven jumpers on
the DZ's Wi-Fi for an afternoon are nowhere near 10,000; seven displays
showing the site all day behind one address would cross it, and the
winds card would fall back to NOAA's FD winds until midnight UTC. Every
one of the 96 variables is consumed (temperatures in the table, which
`interpolateWindsAloft` interpolates between levels, heights to place the
levels, cloud covers on the Ceiling & sky card), so nothing
drops for free. The levers, each with a cost: the seven extra pressure
levels beyond Schulze's (`OPEN_METEO_EXTRA_PRESSURE_LEVELS`, 28
variables, about 6.8 calls instead of 9.6) at the price of the rows they
decide; or a slower refresh (fifteen minutes about 1,000 calls a reader a
day, thirty about 500) at the price of catching a new HRRR run late. The
second forecast day (`forecast_days=2`) costs nothing (the weight scales
with days only above fourteen). The maintainer's call.

## Sent: this app on Open-Meteo's list of users (open-meteo/open-meteo#2300)

Open-Meteo's README asks users to add their app to its list, and this
app qualifies (winds aloft, cloud cover, the outlook). Its terms and
licence were read 2026-10-23 (docs/open-meteo-terms.md): the site met
them; the repository's comparison docs, two figures and `data/parity/`
archives lacked credits, and each now has one. The README's list was read
2026-11-04 (one line per entry, Apps alphabetical, a second link in
parentheses; one entry, not a second under Repositories, which holds
things used as code). The entry, in the maintainer's wording:

    - [LSPC Weather](https://amelia-m.github.io/lspc-weather/) Skydiving
      weather dashboard for one drop zone (Lincoln Sport Parachute Club,
      Nebraska): winds aloft by altitude for freefall drift, cloud cover
      and a 10-day outlook from Open-Meteo beside the NWS forecast and
      the nearest METAR. Free, open source, no account.
      ([source](https://github.com/amelia-m/lspc-weather))

Sent by the maintainer on 2026-11-04 as
<https://github.com/open-meteo/open-meteo/pull/2300>, one commit, no
conflicts; open with no review as of 2026-11-10 (from the sandbox only
the page renders; the API answers 403 for a repository outside the
session's scope).

## Settled: the DZ's coordinates now sit on the landing area

Raised 2026-10-08 by the maintainer, from Mark Schulze's map: the app's
point (40.8675, −96.11) and Schulze's preset for the club were both in the
field south-west of the runway, downhill from it. Jumpers land north or
east of a barbed-wire fence west and north of the runway: on the runway,
the alfalfa field east of it where students are aimed, and the pea gravel
near the north-east corner by the buildings. The same day she gave the
middle of the landing area by the pea gravel, 40°52'13.0"N 96°06'30.5"W,
and `SITE.dz` moved there (40.8703, −96.1085: four decimals, since
api.weather.gov's points endpoint refuses more). It is the same
Open-Meteo cell and the same NWS gridpoint (OAX 77,42), so no forecast
changes; Open-Meteo's ground there is 355 m (1,165 ft) against 349 m at
the old point, so the 10 m wind now stands above the field's published
1,182 ft and the Surface row is that wind itself (`isSurface`); KPMV is
61° from it rather than 60°. The link to Schulze's page carries the new
point; his own list's pin for the club is still in the south-west field
(1,132 ft on Open-Meteo's terrain). Logs before 2026-10-08 are at the old
point.

## Surface rows against the measured wind: scripted, run again

The comparison of both forecast Surface rows against KPMV's measured wind
(first by hand 2026-10-08 over 156 hours: the 10 m row nearer in 104,
Schulze's in 23, tied in 29; docs/markschulze-altitude-reference.md,
"Which Surface row is nearer the measured wind") is
`scripts/surfaceRows.ts` since 2026-10-18 (79 hours at the landing area,
the same result). Run again 2026-10-28 over 306 hours from 2026-09-24:
202, 41 and 63 ("Again, to 2026-10-27"); and 2026-11-05 over 369 hours
when the maintainer asked whether the week's changed weather was worth a
look: 249, 47 and 73, and over the eight new days alone (61 windier
hours, KPMV median 7.7 kt) 47, 6 and 8, both rows further above the
measured wind than before ("Again, to 2026-11-04"). The script takes
`--from` and `--to`; the logs it needs are archived daily as
`data/parity/parity-logs-<day>.jsonl.gz` (pass them to `--logs`), so a
re-run in another season is the KPMV fetch from IEM and the script. Still worth re-running in
other seasons.

## Which forecast run the winds-aloft request is served

**Settled 2026-10-27, as far as a sample can** (docs/run-split.md, "What
the sample found"): it is the clock, not Mark Schulze's next-hour
request. A new HRRR run reaches Open-Meteo's servers one copy at a time,
between about :20 and :59 (140 of 148 arrivals), and for some minutes
after each copy a request gets the new run or the old one, whichever
server answers. The sampler's two app requests a moment apart disagreed
in the same minutes (5.5% from :30, 0.2% to 1.5% before), with his tool
not involved; his hour in progress and his next hour mismatched at the
same rates in both halves of the hour. Counted, not explained: in 50 of
86 mismatched pairings his table differed from both of the app's answers
(his request on the other copy, or his cache), and 16 of 250 mismatched
with the newest run an hour or more old. Neither is worth another
sampler. The Winds aloft card (`WindsAloftPanel`) says why the two can
differ for a while.

How it got there. Seen 2026-09-23: the app and Schulze's tool, both
reading Open-Meteo, on different runs for the same hour. Checked
2026-09-24: his raw 700 hPa level matched `best_match`, `gfs_seamless`
and `ncep_hrrr_conus` exactly and none of `ecmwf_ifs025`, `gfs_global`,
`icon_seamless` or `gem_seamless`, so different models are ruled out; the
app's response carries no caching headers (`Cache-Control`, `Age`, `ETag`,
`Expires`), and no run time, only `generationtime_ms` and the values. The
sampler to 2026-10-05 (docs/source-parity.md) counted different runs in
114 of 1,611 same-hour comparisons, 2.5% on his hour in progress and
11.4% on his next hour (read after half past, since the card snaps to the
nearest hour), but the minute and the next-hour request change together,
so the logs could not tell a run's arrival from his tool's caching; the
"different run" flag is also the script's heuristic (two raw levels
within 150 ft more than 5° or 2 kt apart). A lead from the surface-wind
sample (2026-10-09): Open-Meteo's metadata API (`/data/<model>/static/meta.json`)
gives each model's last run and its availability time, and its
model-updates page says its redundant servers can differ "while the data
is being copied". **Logged since 2026-10-21:** each Schulze comparison
records the `ncep_hrrr_conus` and `ncep_gfs025` metadata, read three times
at once (`omRuns`, `RUN_DOMAINS`, `runsSeen`, scripts/schulzeCompare.live.ts); eight reads a
second apart on 2026-10-21 gave one run with two availability times, so
a run reaches the servers at different moments. `scripts/runAge.ts`
(src/domain/runAge.ts) counts the comparisons by minutes since the newest
run and by whether the reads disagreed:

    npx tsx scripts/runAge.ts --logs data/parity/parity-logs-*.jsonl.gz

The comparisons were too few (9 judged, 2 flagged, to 2026-10-22), so the
run-split sampler ran every four minutes from 2026-10-23 to 10-27, asking
the tool for both hours (`hourOffset=0` and `=1`) and the app twice; its
1,291 records are
`data/parity/runsplit-2026-10-23-to-2026-10-27.jsonl.gz`, the result is
at the top of this section, and the workflow is deleted.

## Surface wind: which forecast source

**The maintainer asked, 2026-11-10:** the Hourly wind card reads the NWS
and "Open-Meteo seems to have less error"; can the card take a toggle, or
was there a reason for keeping the NWS? Read that day from the figures on
file (`public/wind-errors/summary.json` as rebuilt 2026-11-09, and
docs/surface-wind-sources.md), forecast minus KPMV's report, in knots:

| series, against KPMV | hours | speed: median, mean | gust (where reported): mean |
|---|---|---|---|
| NWS from NOAA's archive, latest issuance, 2026-04-01 to 11-09 | 5,189 | 0, +0.1 | +1.7 (1,050 h) |
| Open-Meteo's archive, start of run, the same span | 5,189 | +1, +0.6 | +2.9 (1,051 h) |
| NWS hour, the standing sample, 2026-10-09 to 11-08 | 1,595 | −1, −0.6 | +2.6 (396) |
| Open-Meteo hourly, the same sample | 1,595 | +1.2, +1.2 | +5.2 (396) |

The median miss, sign aside, is about 2 kt for every series. What differs
is the lean: the NWS a little low or centred, Open-Meteo a knot high, and
on gusts Open-Meteo about twice as far above the report; on direction
Open-Meteo leans less (+5° against +9°). So the data do not say
Open-Meteo has less error; neither is clearly nearer, and Open-Meteo's
gust runs higher.

Why the card reads the NWS: the Hourly wind chart and the Forecast flag
read one series (`snapshot.hourly`), so what the flag says is what the
chart draws, the fault the flag was built to close (CLAUDE.md); the
maintainer's call of 2026-10-30 put Open-Meteo's 10 m wind on the Winds
aloft card's Surface row and nowhere else; and the card's standing gust
note (`FORECAST_GUST_NOTE`) is the NWS gust's record. A toggle that
switched the chart alone would split chart and flag; one that switched
both would move when the flag fires (Open-Meteo's gust is about 2.5 kt
higher) on a reader's setting. The app's Open-Meteo request carries two
days of 10 m wind and no gust; the card's horizons run to seven days.

Options, for the maintainer: (a) leave it, with the comparison above as a
standing note beside the NWS series, the gust note's pattern; (b) draw
Open-Meteo's 10 m wind as a second, labelled line on the chart, the flag
staying on the NWS; (c) a toggle switching chart and flag together, the
flag naming its source. Recommended: (a) or (b), since neither changes
when a flag fires on a reader's setting, and the figures do not favour a
switch.

**A first reading, 2026-10-30; the sampler runs on** (docs/surface-wind-sources.md,
"The first three weeks"): over 1,217 reports from 2026-10-09 to 10-30
every source missed by a median 2 kt; the NWS hour ran a little low
(signed mean −0.64 kt) and Open-Meteo's hourly, 15-minute and current
values a knot high (+1.0 to +1.1), being one 15-minute series read three
ways, so `minutely_15` and `current` add nothing over the hourly value
here. On 294 reported gusts the NWS ran +2.3 kt and Open-Meteo +4.3. The
maintainer, 2026-10-30: one season is a brief window; keep logging over
seasons, times of day and kinds of weather. So the sampler runs on
without an end date, every seventeen minutes, archived monthly and the
`#wind-errors` page rebuilt weekly; a reading in another season is
`scripts/surfaceWindSummary.ts` over every `data/parity/surfacewind-*`
archive. The other schedules were checked the same day for the same
minute-of-hour lock: `comparisons.yml` runs on eight fixed minutes, but
the question its minute figures fed is settled and `#parity` counts runs;
`forecast-keep.yml` snapshots at :23 on purpose; the daily runs read one
report a day. Nothing else samples at a cadence.

The question as first put, 2026-10-09: whether Open-Meteo's `minutely_15`
or `current` 10 m wind forecasts KPMV better than the NWS hour or
Open-Meteo's hourly value; a two-hour sample settled how the sources are
built, not accuracy. Also seen: the NWS gridpoint is served from caches
up to an hour old (docs/nws-gridpoint-age.md, 2026-10-23), and
Open-Meteo's hourly gust equals the 15-minute step on the hour (above,
"The outlook's daily gust maximum"). Since 2026-10-23 Open-Meteo's own
archive gives six months beside it ("Open-Meteo's archive"): start of run
a knot high by day and centred at night, its gust high in 64% of KPMV's
gusting hours. Over the sample's own days the archive's start of run was
centred where the sample's hourly read +0.8; worked out 2026-11-12
(`scripts/omArchiveVsSample.ts`; same doc, "Worked out 2026-11-12"): the
value the live API served sat +0.65 kt over what the archive later held
for the same hour (246 hours), +1.15 at night and +0.16 by day; +0.61
over 534 hours to 11-08. **Why, worked out 2026-11-13** (lead time;
`scripts/omArchiveLead.ts`, `src/domain/liveVsArchive.ts`; "Addendum
2026-11-13"): the archive's "start of run" value equals the live API's
value at lead 0, the run's own hour, in 5,451 of 5,554 values, against
256 of 5,570 at lead 1; the hour under way is always at lead 1 or 2 (a
run arrives about ninety minutes after its hour), so the gap is the
forecast's first hours against the run's own hour (+0.50 kt at lead 1,
+0.69 at 2, +0.74 at 3; at night +0.72 to +1.12, by day +0.27 to +0.38).
Asking later in the hour moves the live value only about 0.15 kt nearer.
The archive is at a lead no live forecast has. Open, for the maintainer:
the `#wind-errors` page's archive section is labelled "start of run"
(`omArchiveSection`); "the run's own hour" would say what it is.

## Done: the observation beside the forecast; not the forecast beside the observation

Asked 2026-10-30, after the surface-wind sample's first reading: (1)
KPMV's observed wind under the Winds aloft card's Surface row, so the
comparison happens where the forecast is read, recommended since the
observation is the fact and belongs beside the forecast, labelled; (2)
Open-Meteo's forecast 10 m wind beside the observation on the Surface
wind card, not recommended, since the card's bar, limit lines and flags
are the report's and a forecast figure beside them invites reading the
limits against it. **The maintainer's answers, 2026-10-30:** yes to the
first, no to the second. Since 2026-10-31 the Winds aloft card shows
KPMV's latest report under its table ("Observed at KPMV (11 mi ENE of
the DZ), <time>: S 190° 12 kt, gust 22 kt. A report, not a row of the
forecast above."), with a test; the Surface wind card shows no forecast
figure.

## Done: a note on the card about the forecast gust

The kept forecasts' gust ran above KPMV's reported gust in 45 of 53
gusting hours (docs/kept-forecasts-vs-kpmv.md, "Gust, closer"), so a
forecast flag may name afternoons the station does not report as gusty;
changing the flag would be a threshold of the app's own, so the option
was a standing note. The maintainer, 2026-10-23: "depends how consistent
the difference is"; 53 hours would not settle it. NOAA's NDFD archive
holds the wind grids beside the sky and ceiling (`wmo/wspd/`,
`wmo/wgust/`, `wmo/wdir/`; `wmo/wgust/2026/04/01/` holds hourly files,
`YWAZ88_KWBN_…`, at :47), already matched to the API's `windGust` 42
of 42 hours on 2026-10-13 ("Forecasts kept for later", below), so six
months were read the same day (docs/nws-gust-archive.md): 964 gusting
hours at the latest issuance, above in 605, the same in 93, below in 266,
+1.5 kt on average; of 111 gusty days, 54 within 2 kt, 42 more than 2 kt
high, 15 more than 2 kt low; low (−0.6 kt) on reported gusts of 23 kt or
more; at the Student profile's 12 kt, the forecast at or over it in 2,477
hours and KPMV in 1,055, 41 of those under in the forecast. Run again
2026-10-27 to 10-25 ("Read again 2026-10-27"): 978 hours, 615, 93, 270,
+1.51 kt; the three added days changed nothing. The forecast gust was
never under the forecast wind, so those counts are the flag's own; the
speed was centred over six months (+0.13 kt).

**Built 2026-10-28**, the maintainer's call ("yes, with a note about the
typical range of the magnitude of the difference"): `FORECAST_GUST_NOTE`
(`src/config/forecastGustNote.ts`) on the Surface wind card gives the
side (above in 63% of 978 gusting hours, the same in 10%, below in 28%),
the typical size (half the differences 3 kt or less, nine in ten 8 kt or
less, mean +1.5 kt), that it ran a little low on reported gusts of 23 kt
or more, and the 6 kt it sat over the steady wind when no gust was
reported, dated and linked to docs/nws-gust-archive.md; a test holds the
figures to the doc. No colour, no threshold; the flag reads the forecast
as issued.

## Done: a forecast lowest cloud base from the NBM

Asked 2026-10-24: does the dashboard have both the ceiling and the lowest
cloud base? For the latest report, yes (the Sky line lists every layer);
for the forecast only the ceiling, since the NWS gridpoint has no
lowest-base element. usairnet's "Lowest cloud base" row is the NBM's
`LCB`, readable from NOAA's open data bucket (CORS header sent; 28 MB
files, so the relay cuts out KPMV's block); MDL's key, read 2026-10-26:
hundreds of feet, -88 for unlimited, the base "whether or not a ceiling
is present (could be FEW or SCT layer)" (docs/usairnet-parity.md, "Where
usairnet's rows come from"). **Built 2026-10-27**, the maintainer's call
that morning: a "base" row on the Ceiling & sky card through the relay's
second path (docs/nbm-lowest-cloud-base.md).

## Done: the #wind-errors page refreshes weekly

Since 2026-10-23 the weekly ceiling data refresh
(`.github/workflows/ceiling-data-refresh.yml`) also rebuilds the
`#wind-errors` page's data file from the kept snapshots, the week's KPMV
reports and the surface-wind archives, at the maintainer's request, and
fetches Open-Meteo's archived 10 m wind and NOAA's NDFD wind, gust and
direction each week, so the page's archive sections run from 2026-04-01
and keep growing. A rebuild holding less than the published file is not
copied in; a wind-side failure leaves the wind file as it was, commits
the ceiling data, and fails the run so it is seen. The docs' wind figures
are dated readings the weekly run does not redraw. Its first run on a
runner, 2026-10-26 (run 40340551073, started 14:32Z, nearly seven hours
after its 07:41Z cron, as the week before's was): every step passed, the
four archives committed as "Ceiling and wind data to 2026-10-25"
(2f67fd3), the deploy and live-site check passed, the kept section's
latest-issuance row went from 223 to 296 hours and the archives' from
about 4,790 to 4,862. Nothing to fix.

## Forecasts kept for later

Started 2026-10-13 at the maintainer's request: where no archive holds a
forecast the dashboard shows, keep it now. As read that day: the NWS
gridpoint's sky cover and ceiling are archived in NDFD
(noaa-ndfd-pds.s3.amazonaws.com, `wmo/sky/` and `cig/`; each checked value
for value, docs/cloud-cover-sources.md, docs/ceiling-heights.md), as are
visibility, wind speed, gust and direction, temperature, dew point and
rainfall (`vis`, `wspd`, `wgust`, `wdir`, `temp`, `td`, `qpf`; checked at
the drop zone, below); not archived are the hourly rain
chance (NDFD has only a 12-hour `pop12`, the highest hourly chance in its
12 hours, from which the hours cannot be got back), the thunder chance
(no element) and rainfall past day 3 (the API's `quantitativePrecipitation`
ran to day 8; NDFD's `qpf` has only the three-day headers). Open-Meteo's Historical Forecast
and Previous Runs APIs hold hourly forecasts, the winds aloft among them;
the 10-day outlook's daily figures as the card asks for them
(`precipitation_probability_max` in particular) are not held.

`.github/workflows/forecast-keep.yml` keeps, once an hour, every
gridpoint field the card reads and the outlook as the card asks for it,
on the `forecast-archive` branch (`data/YYYY/MM/DD/HHMMZ.json.gz`, about
4 KB each), which also gives the lead a reader saw. Since 2026-10-15 the
ceiling-error chart reads their `ceilingHeight`; since 10-17 the same
page scores their rain and thunder chances against KPMV
(docs/forecast-chances.md); since 10-22 their wind, gust, direction,
temperature, visibility and rainfall have a first reading
(docs/kept-forecasts-vs-kpmv.md, by hand).

**The keeper does not run hourly on a cron line.** By 2026-10-15 GitHub
had started its `23 * * * *` schedule 10 times in 47 hours, the
throttling the comparison sampler met. The maintainer chose the loop on
2026-10-16: `scripts/forecastKeepLoop.sh` runs up to 340 minutes, keeps a
snapshot at minute 23 of each hour and pushes each as taken, and each run
first queues its successor with a `workflow_dispatch`; a three-hourly
schedule restarts it if a dispatch fails; a run that loses an hour runs
to its end and then fails, so the loss shows. Tried before merging
against a throwaway copy with 30-second spacing (two snapshots pushed
under distinct names, exit 0; with pushes refused, nothing pushed, exit
1). First handoff read 2026-10-17: every hour from 18:23Z on the 16th to
00:23Z on the 17th had its snapshot, against four in the 17 hours before.
A "cancelled" dispatch in the run list is the schedule taking the queued
run's place under `cancel-in-progress: false`, not a lost hour; a gap in
the branch's file names is what would show one.

What the loop involves, read 2026-10-16 and on GitHub's own pages
2026-10-20 ("KOFF's TAF", below): Actions is free for standard hosted
runners in public repositories (a job looping around the clock is about
43,000 minutes a month, many times the Free plan's private-repository
quota); a hosted job stops at 6 hours and a run at 35 days, so a loop is
a chain of starts; scheduled workflows in a public repository are
disabled after a stretch of inactivity; the terms bar "any other activity
unrelated to the production, testing, deployment, or publication of the
software project", and a keeper whose records check this project's own
forecasts is arguably within it, as the surface-wind sampler is. A loop
makes each start count for hours, but not arrive on time: the sampler's
five-hourly starts covered 57% of the time from 2026-10-09 to 10-14 and
96% since; a queue of one waiting start is what closes the gaps. What it
buys: the forecast a reader saw in the hour before a jump, which a
snapshot every 3 to 6 hours misses and cannot be fetched later.

### NDFD against the API, element by element (2026-10-13)

`scripts/ndfdApiCheck.py` read api.weather.gov's gridpoint for the drop
zone (OAX/77,42, `updateTime` 17:31:36Z) and, around 18:00Z, the CONUS
NDFD files for each element issued either side of that update, decoded
at the nearest grid point (0.87 km away); its output is
`data/parity/ndfd-api-check-2026-10-13T1800Z.jsonl.gz` (`--from` prints
the comparison again). Compared in the office's unit (whole knots, whole
°F, visibility to 0.05 mile, rainfall per 6-hour period in mm). The
issuance at 17:46Z, the first after the API's update, matched the API at
every hour: visibility 30 of 30, wind speed, gust and direction and
temperature and dew point 42 of 42 each, rainfall 11 of 11 periods; the
day 4 to 7 files (the 97 and 87 headers, which carry wind, temperature,
dew point, gust on 97 only, and `pop12`, no visibility or rainfall) 16 of
16 hours each. The issuance at 17:16Z, before the update, differed by 1
°F at 16 hours and by up to half a mile at 9 hours of visibility: what
the API served from 17:31Z was in the next issuance, 15 minutes after
the update. One pair shows that much, not how long an edit can take.

The 17:16Z visibility file's last two hours decoded as −16,091,830 m,
−9999 miles to the metre: a no-data fill. Every message in both files
holds that one negative value and no other, at about 1.5 million of the
grid's 2.95 million points in the first hours (the Pacific off
California among them) rising toward the end of the 30-hour span, the
drop zone among them at 22Z and 23Z in the 17:16Z file; the files declare
no bitmap and no missing-value management (`bitmapPresent` and
`missingValueManagementUsed` both 0, `grid_complex` packing), so a decoder
hands the fill back as a number. Every element is non-negative, so the script counts a
negative value as missing; a reader of the archive has to do the same.
NDFD packs m/s, K and m to about a tenth (5 kt comes back 5.05); in the
office's units the figures are the same. `pop12` equalled the highest of
the API's hourly chances in all 12 standard periods from day 1 to 7; a
file's first `pop12`, from its own reference time, is not a standard
period. The 88 and 87 headers are the same grids on a 5 km mesh and held
the same figures here. One moment at one point says the archive and the
API were the same forecast that hour, not whether a past day's archive
was ever edited after the fact.

## The ceiling chart's old artifact

The ceiling-error chart moved on 2026-10-16 from a private claude.ai
artifact to the site (`public/ceiling-errors/`, docs/ceiling-heights.md,
"The chart"). Compared the same day: the artifact's data file was the
site's byte for byte, its page older, and every published version was a
commit first (`git log --follow public/ceiling-errors/index.html`), so
nothing would be lost. Deleted 2026-10-17 at the
maintainer's word; its link no longer opens.

## Settled: the ceiling data refresh's first runs on GitHub

`.github/workflows/ceiling-data-refresh.yml` (added 2026-10-17) had been
run step by step in a scratch copy but never on GitHub. On 2026-10-19 no
run had appeared by 14:01Z, 6 h 20 min after its 07:41Z slot, as this
repository's other scheduled jobs started late the same days (the 13:00Z
sky-parity run at 16:10Z on 10-18, the live-site check three hours
late); it was not dispatched by hand (`gh workflow run ceiling-data-refresh.yml
--ref main` would cover the same days), since a run commits to `main`. It
ran at 14:57Z (run 39273713027, every step green, a minute long): one
commit, "Ceiling data to 2026-10-18" (`b46f05d`), a `ceiling-` and a
`metar-` file and the data file (KPMV's reports to 10-18 23:55Z, the
drop-zone rows from 4,643 to 4,691 hours, 86 kept snapshots from 25); the
deploy it dispatched succeeded. The live-site check did not follow that
deploy, since deploys dispatched by a workflow's token raise no
`workflow_run` event; the check now starts from `deploy.yml`. Ran again
2026-10-26 (2f67fd3). Settled by the maintainer on 2026-10-20: a ceiling
and a METAR file every week (about 15 KB) rather than merged archives,
since the repository's growth (docs/ceiling-heights.md, "Repository
growth") is nowhere near a risk; the schedule stays unless they change
it.

## Viewing the deployed site from the sandbox

Settled 2026-10-17, nothing for the maintainer to do. Chromium here
rejects the egress proxy's certificate because its trust store
(`~/.pki/nssdb`) is empty and filling it needs NSS's `certutil`, not
installed. Not needed: `--ignore-certificate-errors-spki-list` takes the
SHA-256 hashes of public keys to trust; given those of the bundle's
proxy CA certificates (`/root/.ccr/ca-bundle.crt`, subjects with
`O = Anthropic`) and the session proxy as its proxy, it loaded the live site,
and without the flag failed with ERR_CERT_AUTHORITY_INVALID. The recipe
is in CLAUDE.md, "The deployed site in a browser"; the hashes are taken
from the bundle each time, so a rotated CA needs nothing changed. What
the first load found is under "Live-site smoke test" below.

## Issue #208: a 3 px sideways scroll at 320 px, seen once

The live-site check of 2026-10-24 at 04:43Z (run 40063461188, head
632789c) found Jumpers and Pilots 323 px wide at 320 px on both loads.
The run 19 minutes before, on the same app code (632789c was docs only),
passed, and so did every run since, so it was the data of that quarter
hour, and which element was past the edge is not known, because the
check recorded only the width. PR #210 (2026-10-25) positioned the 10-day
and TAF scrollers so their screen-reader labels cannot widen the page, a
candidate, not a finding. Since 2026-10-26 the check names the innermost
elements past the edge (`overflowReport`, `scripts/liveSiteDom.ts`). The
issue is the maintainer's to close.

## Issue #209: aviationweather.gov dated a TN a day early; and a timeout

The sky-parity run of 2026-10-24 (run 40110944332) failed one test on
Offutt's temperatures alone: `TX26/2420Z TN12/2510Z` in a TAF issued
241000Z, which the app put on the 25th at 10Z as written and
aviationweather.gov's decode put on the 24th, a day early. Read again
2026-10-26, their decoder dated 12 of 12 TX/TN groups across 374 CONUS
TAFs as written, so the fault is not constant or reproducible. The check
now asks whether each of the app's groups sits on the day and hour its
own text gives (`temperatureAsWritten`, `src/domain/taf.ts`) and, when
every one does and the sides differ only in time, prints a note instead
of failing. The run of 2026-10-25 failed the same test on a 20-second
timeout fetching the TAFs, as #147 did on the METAR; it opened no second
issue. Nothing for the code to fix; #209 is the maintainer's to close.

## Done: the NBM bulletin's header lost its version token (2026-11-03 12Z)

Found 2026-11-04 about 00:30Z: the relay answered `/nbm/KPMV` 502, "no
KPMV block in blend.20261103/23/text/blend_nbhtx.t23z", and the file had
the block; its header read " KPMV   NBM  NBH GUIDANCE" where every file
through the 11Z cycle read " KPMV   NBM V5.0 NBH GUIDANCE", and both
patterns required the token. Both take it as optional now, the relay
answers a block it cannot find in a file it read with 500 rather than the
bucket's 502, and the live-site check counts that.
docs/nbm-lowest-cloud-base.md, "The header lost its version", has the
files read. Deployed by Workers Builds on merge.

## Done: the sky-parity run of 2026-11-03, a 1 hPa QNH and a label too long

The daily run of 2026-11-03 (19:52Z) failed twice over and opened no
issue; found by reading the run list.

**The failure:** KOFF period 4's `QNH2972INS`, the app's 29.72 inHg
against aviationweather's `altim` 1007 hPa, where 29.72 × 33.8639 is
1006.43 and the check required the rounded figures to agree. Read the
same day through aviationweather.gov's TAF API for twenty USAF stations
(`https://aviationweather.gov/api/data/taf?ids=KOFF,KTIK,KBLV,KWRI,KDOV,KLSV,KSUU,KSKA,KRND,KFFO,KGUS,KMUO,KEDW,KBAB,KMCF,KCHS,KLFI,KSSC,KPOB,KDYS&format=json`):
70 pairs, 68 the rounded
33.8639 conversion; the two that were not were both 29.72 inHg (KOFF,
KBLV), both 1007, and no single factor fits all 70. The check now takes
the app's figure within 1 hPa of theirs (`scripts/skyParity.live.ts`),
which loses nothing: a misread is tens of hectopascals off.

**The missing issue:** the step that opens one issue per failed check
first creates the label with `gh label create --force`, and GitHub
answered 422: the sky-parity label's description was 113 characters
against a limit of 100, so the step died before the issue. The
descriptions are now under 100 (`LABEL_DESCRIPTION_MAX`, `CHECK_LABELS`,
tested), and the workflow goes on to the issue when the label command
fails, with a warning. The keeper's "cancelled" runs in the same list are
the known pattern ("Forecasts kept for later").

## Issue #256: aviationweather.gov answered the GFA link 502, once

The daily check of 2026-11-01 (18:09Z) failed "opens the GFA and the
SIGMET map" on a 502; the next run passed, and nothing in
`src/config/sources.ts` changed. The third one-off in this check (#147
and #238 were one timeout each). Done the same day at the maintainer's
word: `fetchWithRetry` tries once more on a 502, 503 or 504 as on a
timeout; a second in a row still fails, and any other status is the
finding (`RETRIED_STATUSES`, `tests/liveFetch.test.ts`). The issue is the
maintainer's to close.

## Issue #238: a timeout again, on the day the Chart Supplement edition changed

The sky-parity run of 2026-10-29 (run 40933195884) failed "parses the
METAR text the way aviationweather.gov decodes it" on a 20-second
timeout, as #147 did with a connect timeout; every other check passed,
among them the one that mattered that day: 2026-10-29 was the first Chart
Supplement edition on which the inferred AIRAC numbering and the
year-month form differed, and the link opened cycle 2611 with FAA's
search answering 200 (src/domain/chartSupplement.ts). The next day's run
passed. The maintainer closed #238 on 2026-10-31 (with PR #244 linked),
and #237 the same day. Nothing waits here.

## Done: the sky-parity issue's body, narrower, from the failed test names

Asked by the maintainer, 2026-10-31, reading #238's body: is it too
broad, and would more but narrower checks burn workflow runs? Proposed
and agreed: narrower issues, not more workflows, since Vitest already
knows which test failed. Done 2026-10-31: the workflow runs Vitest with
the JSON reporter beside the console one, and `scripts/liveIssue.ts`
(`src/domain/liveIssue.ts`, pure and tested) turns the report into one
issue per failed check, labelled `sky-parity`, `pilot-links` or
`sim-text` (`live-checks` when the run failed before the checks started),
titled by the failed test, with the failure's own message in the body and
a note when it was a timeout; the three checks' fetches go through
`scripts/liveFetch.ts`, which tries once more on a timeout (both issues
so far were a single 20-second timeout). Checked on a sample report, by
running the script on one, and by running the checks from here with the
JSON reporter; the checks' test timeout went from 60 to 180 s so a
second attempt is never cut off by Vitest.

## Issue #249: the hour stepper past the edge at 320 px, after 11:30 PM

The live-site check failed on the docs-only deploy of 2026-10-31 at
04:44Z: Jumpers and Pilots were 323 px wide at 320 px, the elements past
the edge the forecast hour stepper's `+1 h` buttons (`ForecastHourNav`).
The same build had passed at 04:19Z; what changed was the clock. The
readout prints the weekday only when the valid hour is on another local
day ("Sat 12:00 AM local"; `validWeekday`), and at 11:44 PM Central the nearest forecast
hour was Saturday's midnight; the whole readout sat in one nowrap span,
so the row overflowed its box, by 11 px in the sandbox's font and more in
the runner's. The daily run, in the morning, never met it. Fixed the
same night: the weekday is a word of its own before the span
(`tests/windsHour.test.ts` pins the markup). Measured 2026-10-31 05:20Z
in the runner's font (DejaVu Sans, wider than the sandbox's Inter): the
old markup ran to 298 px in Inter and 339 in DejaVu in a box ending at
289; with the weekday freed, 280 and 303, the page at 320 in both; with
"local" freed as well, 280 in both fonts. The maintainer closed #249 on
2026-10-31.

**Built 2026-11-05:** the live-site workflow's second leg (`late-evening`)
builds the fixture site, serves it on the runner and runs the same script
with the browser's clock at 2026-10-31T04:45Z in the DZ's zone
(`LIVE_CLOCK`), and the script measures each stepper row against its box
(`hourNavs`, `measureHourNavs`), a fault before the page widens. Run from
here: the fixed site passed every page; with the weekday put back inside
the span, Jumpers and Pilots failed at 320 px on the stepper rule alone.
Dispatched on the branch (run 42112228274) and on `main` after the merge:
both legs passed. Against live data a pinned clock would pick a forecast
hour the data does not hold, so the live leg never sets one.

## Issue #147: a timeout, not a disagreement

The sky-parity run of 2026-10-11 (run 38161231894) failed "parses the
METAR text the way aviationweather.gov decodes it" on its first request
(connect ETIMEDOUT to an aviationweather.gov address), so it compared
nothing; the same run's other requests and every daily run since passed.
Closed as not planned on 2026-10-17 at the maintainer's word.

## KOFF's TAF: no feed a browser can read carries it

**Done, 2026-10-27:** the relay is deployed at
`lspc-taf-relay.amelia-m.workers.dev` and the card reads Offutt's TAF
through it (docs/taf-relay.md, "Checked after deploying").

Why it was needed, read 2026-10-13: Offutt's TAF is issued by the USAF,
not the NWS. api.weather.gov has no product under any lookup; IEM has no
KOFF TAF since 2020 (nor KFFO, KBAD or KDOV), since its archive is built
from NWS text products; aviationweather.gov's API and NOAA's raw file
(tgftp.nws.noaa.gov/data/forecasts/taf/stations/KOFF.TXT) carry it but
send no CORS header. Offutt does not issue around the clock: the TAF of
Saturday 10 October 10Z ended "LAST NO AMDS AFT 1013 NEXT 1310", a gap
over the weekend and the Columbus Day holiday (Monday 12 October); read again 2026-10-20, a
weekday issue as expected. Offutt is about 20 mi from the DZ, KOMA 32,
KLNK 34. Until the relay, the card showed KOMA and linked Offutt's TAF.
Options put to the maintainer: a free Cloudflare Worker in their name
adding a CORS header; a workflow copying the TAF to the site or, via
`raw.githubusercontent.com` (which sends `access-control-allow-origin: *`
with `max-age=300`), to a data branch, 5 to 15 minutes behind; keyed services would put the key in the public
page.

On 2026-10-20 the maintainer judged the relay a small cost and
allowlisted `docs.github.com` and `developers.cloudflare.com`. Read that
day: GitHub's Actions limits (a hosted job stops at 6 hours, a run at 35
days, 20 concurrent jobs on Free, GITHUB_TOKEN 1,000 API requests an hour
per repository; Actions free for standard hosted runners in public
repositories) and its terms, which bar using Actions "as a content
delivery network or as part of a serverless application" and "any other
activity unrelated to the production, testing, deployment, or publication
of the software project": a workflow polling for a TAF to serve a page is
the serverless case, so that route is out on the terms, not the limits
(the keeper and the samplers gather data the pages are built from, which
reads as publication; not settled here). Cloudflare's Workers Free plan
allows 100,000 requests a day, resetting at midnight UTC, and 10 ms of
CPU per request, network waits not counted; the card's two relay requests
every 10 minutes per open page (288 a day) let the free plan cover about
347 pages open all day; the paid plan is $5 a month.

The relay was written 2026-10-20 (`relay/`, checked in Cloudflare's
runtime locally and end to end in a browser; docs/taf-relay.md) and
deployed 2026-10-27 once the maintainer created the account and connected
the repository (`TAF_RELAY_URL`, src/config/tafRelay.ts). Since
2026-10-20 the chain passes over a TAF past its valid time:
`fetchTafChain` (src/api/tafChain.ts) moves to the next station when the
latest TAF has ended or carries no forecast (`tafStanding`,
src/domain/taf.ts: `CNL` or `NIL`), the card names each station passed
over and why, a TAF whose end cannot be read is kept, and a TAF that ends
on screen says so until a newer one is fetched.

## Live-site smoke test

**Broken by the runner image, 2026-10-28 to 10-30.** Every run from
2026-10-28 16:52Z (the deploy of PR #236) to 2026-10-30 03:32Z (PR #239)
failed before the check started:
`ubuntu-latest` had become `ubuntu-26.04`, on which Playwright 1.56.1
would not install Chromium. The workflow opened #237 and commented at
each failure, which nobody read for two days (one deploy was docs only
and not waited for; two PRs waited but their summaries were written
before reading why). Fixed 2026-10-30 by pinning the job to
`ubuntu-24.04`, with a comment saying when to unpin. A failed live-site
run is not always a site fault; the issue body says so when `live.log` is
missing.

Run against live data on 2026-09-22, the first time the app had been
exercised against anything but the fixtures. Every source answered.
Settled: the winds-aloft valid time is right (0400Z shown at 04:01Z,
identical to Mark Schulze's tool at 13,000 ft); the TAF falls back as
designed (KOFF no product, KOMA yes, as `SITE.tafStations` predicts); the FD fallback was wrong and is
fixed (it printed the bulletin's 3,000 ft MSL wind as the Surface row);
the sky decode was wrong on live data and is fixed (a 2026-09-23
screenshot showed "Clear", "No ceiling", VFR and no flag under `OVC027`,
since api.weather.gov's `cloudLayers` was `[]` for seven reports; usairnet
decoded the same METAR as overcast at 2,700 ft; the normaliser now reads
the sky from the METAR text, CLAUDE.md); the Licensed profile reads
correctly with no flag and the gap named.

Exercised since: the deployed site in a browser on 2026-10-17 (how, in
"Viewing the deployed site from the sandbox"), at 1280, 390 and 320 px
with no sideways scroll and every source answering; Open-Meteo's two
requests failed on the first try as "blocked by CORS policy" and
succeeded on the retry, most likely the sandbox proxy's own failure on a
slow request, since Open-Meteo sends the header; the one 404 was
`/favicon.ico`, and since 2026-10-17 both pages name `public/favicon.svg`
(checked in a base-path build served locally: a 200 from both, no 404).
Then every page at every width on live data the same day, a Saturday
with KPMV gusting 18 kt: `#citations` at 320 px was 348 px wide on
unbroken URL-like words in a "read" line
(`weather.gov/epz/wxcalc_densityaltitude,`), fixed with `overflow-wrap:
break-word` on `.panel-body`; the radar card before its lazily loaded image sat at its
60 px minimum with the drop-zone ring floating, fixed by giving the
image its size (`RADAR_IMAGE_PX`, 600 by 550); the wide tables run past a
phone's edge inside their own scroll boxes by design. The live-site
workflow's first run on a GitHub runner (39057948085, after the
2026-10-17 deploy) passed every page with no note at all, so the
first-request failures are the proxy's, not something a reader meets.

## Settled: the Student profile models no canopy type, and needs none

BSR 2-1 H states two maximum ground winds for solo students: 14 mph on
ram-air canopies, 10 mph on round reserves. The app has one Student
profile with one band at the 14 mph figure, and the Surface wind card
says so. Two ways to close it, both needing a decision the code cannot
make: model canopy type (a second profile or a toggle, at the cost of a
control on the most-read card), or drop the round-reserve figure and
scope the profile to ram-air (cheaper, but it hides a published limit).
The maintainer's call, 2026-10-10: leave both until it is known whether
any student rig has a round reserve. A lead: most of the club's student
rigs carry an Aerodyne Smart reserve, whose maker's page (read
2026-10-26) describes a 7-cell canopy with glide and flare, a ram-air
reserve though the words are not used.

**Known, 2026-10-26, the maintainer's word: no student canopy at LSPC has
a round reserve.** So neither option is taken as written: no canopy model
is built (dead weight here), and the published figure is not dropped
(BSR 2-1 H still states it). The Surface wind card, the hourly chart's
legend and the Student flag name the 10 mph figure as before and, where
each says what it leaves unchecked, add that no student rig at LSPC
carries a round reserve, with the source and date
(`STUDENT_ROUND_RESERVE_FACT`, `windBandCaveat.notHere`,
`src/config/thresholds.ts`). A fact about the DZ from its maintainer, not
an instructor's sign-off, so A1 on `#citations` still asks an instructor
to confirm it for every student rig, and A5's question about the waiver
reaching the figure is marked moot while it holds.

## Winds aloft

The sub-surface question that sat here is settled and fixed: pressure
levels below the model's terrain are dropped in `normalizeOpenMeteo`.
Evidence, the measurements and the sources that could *not* be read are
in [`subsurface-pressure-levels.md`](subsurface-pressure-levels.md). The
share this entry used to quote (~4%, rising to ~15%) was a property of
the **fixture**, which sets `elevation: 360`; live Open-Meteo returned
349 at the point used until 2026-10-08 (355 at the landing area since),
which put the sub-surface share at 0% in all 384 hours. The fix is worth
having anyway: which side of that 10-metre line the DEM lands on is not
something this app controls, and an hour missing `wind_speed_10m` would
have built the Surface row 70% out of a wind stamped below ground.

## Radar card: a pin at the drop zone

**Done**, approach 2, on measured georeferencing: `RADAR_IMAGE_GEOREF` in
`src/config/site.ts` carries the constants and the method, and
`radarImageFraction` in `src/domain/radarGeo.ts` derives the position.
Measured 2026-09-22: the RIDGE "standard" image is equirectangular over a
bbox square in degrees (4.287° a side), centred on the radar in longitude
and 0.060° north of it in latitude, rendered into 600×550 px; fitted by
projecting ~11,000 county-boundary vertices into the image, median
residual 0 px, 90th percentile 1 px, and repeated on KUEX and KDMX to
±0.002°. NWS publishes **no** georeferencing for these files (`/ridge/standard/`
holds GIFs and nothing else, no world file, no `.aux.xml`), so if NWS
changes the product the marker moves silently: re-measure with the same
method. The obvious assumption that the image is centred on its radar is
wrong in latitude by 8 px (~7 km); `tests/radarGeo.test.ts` fails if the
offset is simplified away. The header and footer bars are drawn over the
map, so `radarImageFraction` returns null under them.

Approach 3 (centring the interactive-radar link on the DZ): the
`?settings=v1_<base64>` parameter is base64 JSON, read from the site's
bundles on 2026-09-23 ([`radar-interactive-link.md`](radar-interactive-link.md)),
and the reading said a single-station view is re-centred on the radar
once the station list loads. **Settled 2026-10-28 in a browser** (same
doc, "Settled in a browser"), once the maintainer allowlisted the
viewer's basemap, tile and geocoder hosts: a KOAX station link with its
centre on the DZ (B) settles centred on KOAX; the mosaic (C), the
"weather for a location" view (D) and the `/location` quickset (E) settle
centred on the DZ. So approach 3 as asked is not possible. **The
maintainer's call:** keep the plain station link (KOAX's own product,
the DZ off screen until zoomed out), or link the DZ-centred mosaic (C) or
the location view with a marker (D), which show the national composite.
`scripts/radarLinks.mjs` opens any of them again.

## Mark Schulze's Winds Aloft: AGL or MSL?

**Settled: AGL.** Evidence and a re-check recipe in
[`markschulze-altitude-reference.md`](markschulze-altitude-reference.md).
The winds-aloft card says so, since it is the cross-check it sends
jumpers to.
