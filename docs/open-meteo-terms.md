# Open-Meteo's terms, and what this app does about them

Asked 2026-10-23 by the maintainer: is there anything in Open-Meteo's
guidelines this app does not yet meet, and is it credited properly?

Read 2026-10-23 with curl, as served that day: the terms of use
(<https://open-meteo.com/en/terms>) and the licence page
(<https://open-meteo.com/en/licence>). Open-Meteo says it may change its
terms "at any time", effective on posting, and tracks the changes on
GitHub. Nothing here watches for that, unlike the daily SIM check, so
read them again before relying on this page.

## What they ask, and where this app stands

| What the pages say | Where this app stands |
|---|---|
| The free API is for non-commercial use only. Their examples of non-commercial: "Private or non-profit websites or apps that do not have subscriptions or advertising", personal home automation, public research, educational content; "Voluntary donations, including contributions through a tip jar, are permitted." Commercial: "Websites or apps that have subscriptions or display advertisements", commercial products or promotion, undisclosed research at commercial entities. | Met, as far as the code shows: a public club dashboard on GitHub Pages, with no subscriptions, advertising, sign-in or paid feature. Whether LSPC is itself a non-profit was not checked; the examples turn on subscriptions and advertising. Adding either would need one of Open-Meteo's paid plans. |
| Under 10,000 calls a day, 5,000 an hour and 600 a minute; the free column of the plan table adds 300,000 a month. "Rate limits are applied by IP addresses and application." | Met. Each reader's browser calls Open-Meteo from its own address: the winds-aloft request and the 10-day outlook, each refreshed on the dashboard's timers. The repository's workflows run on GitHub's runners. Counted from the scripts on 2026-10-23, at most about 1,900 calls a day while both temporary samplers ran (the surface-wind sampler about four a run every five minutes, the run-split sampler two a run every four minutes), about 57,000 a month; the run-split sampler ended 2026-10-27, and since 2026-10-30 the surface-wind sampler runs on at seventeen minutes (two calls a sample, about 170 a day), so about 230 a day in all with the hourly forecast keeper's outlook, eight comparison runs, the daily sky-parity run and the weekly refresh; the sampler and the comparisons also fetch two of Open-Meteo's static `meta.json` files a run, whether those count is not stated. The sandbox's shared address was refused for a day twice by requests not this repo's (CLAUDE.md). |
| Data under CC BY 4.0: "give appropriate credit, provide a link to the licence, and indicate if changes were made", in any reasonable manner but "not in any way that suggests the licensor endorses you or your use". | Met on the site: the footer credits Open-Meteo, links the licence and says what the dashboard changes (`OpenMeteoCredit`), and so do `#parity` and `#wind-errors`. Nothing suggests endorsement. |
| "You must include a link next to any location Open-Meteo data are displayed", for example `<a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a>`. | Met on the site: each card that shows Open-Meteo data (Winds aloft, Drift, the 10-day outlook, Ceiling & sky when its Open-Meteo figure is there) links Open-Meteo and the licence in its own "Data:" line (`SourceLinks`). Data health's rows link Open-Meteo by name with no licence link; they show whether and when a fetch answered, not its data. The ceiling-error page shows none (its data file holds the NWS rows and KPMV's reports only). **In the repository it was not met until 2026-10-23**: the comparison docs quoting Open-Meteo figures, the two `#wind-errors` figures drawn from its wind, and the archives under `data/parity/` carried no credit. Each now does: a credit under the title of the nine docs with Open-Meteo figures (`open-questions.md` among them), a credit line on the figures (redrawn with only that line added; their counts did not change), `data/parity/README.md`, and the README's data-sources row, which also now names everything Open-Meteo feeds. |
| Researchers are encouraged to cite Open-Meteo (Zippenfenig, P. (2023). Open-Meteo.com Weather API. Zenodo. doi:10.5281/ZENODO.7970649). | Encouraged, not required. The comparison docs are notes, not publications; the citation is in `data/parity/README.md` for anyone who uses the archives. |
| No warranty: Open-Meteo "assumes no responsibility for any inaccuracies or omissions in the data, their availability, or any losses". | In keeping with the app's own rule: it gives no go/no-go verdict, and every card names its source. |

The licence page also lists the national weather services Open-Meteo's
data come from, each under its own licence. At the drop zone the default
model is NOAA's HRRR (docs/surface-wind-sources.md), and NOAA's data are
in the public domain. What the app has to meet is Open-Meteo's CC BY 4.0.

## Read again 2026-10-31

The maintainer asked for the terms and any recommendations to be read
again and the repository checked against them. Read that day with curl:
the terms, the licence page (`/en/license` redirects to `/en/licence`),
the features and docs pages, the pricing page and the README of
open-meteo/open-meteo on GitHub. Nothing in the table above contradicts
the pages. Not in it until now:

- **How a call is counted.** The pricing page's FAQ: "Typically, one API
  call corresponds to one HTTP API request. However ... Requests for data
  covering more than 10 weather variables or extending over a period of
  more than 2 weeks for a single location are considered multiple API
  calls ... a request for 2 weeks of data with 15 weather variables will
  be calculated as 1.5 API calls". The winds-aloft request asks 96 hourly
  variables for two days, so by that rule it is about 9.6 calls, and one
  reader is about 1,500 calls a day, not 290. **The free endpoint does
  count this way**, read in Open-Meteo's own server source the same day
  (github.com/open-meteo/open-meteo, commit 2060d80 of 2026-10-30,
  cloned from here): `withFreeApiRateLimiter`
  (`Sources/App/Helper/Vapor/ApiKeyManager.swift`) charges each free
  response its `calculateQueryWeight()`
  (`Sources/App/Helper/Writer/ForecastApiResult.swift`), which is
  `max(variables / 10, variables / 10 × days / 14)` per location, never
  under 1, against the limiter's 600 a minute, 5,000 an hour and 10,000 a
  day per IPv4 address (`RateLimiter.swift`; the defaults, overridable by
  environment); an error charges 1. The weighted charge is older than
  the 400 commits of history fetched (to 2025-09-26). Since a change of
  2026-10-26 the server also answers every free request with
  `X-RateLimit-Cost` and `X-RateLimit-Remaining` headers, but the deployed
  API did not send them on 2026-10-31 at 04:35Z (the app's two requests
  made from here answered with Date, Content-Type, Transfer-Encoding and
  Connection only), so the cost cannot yet be read off a response. By the
  formula the winds request costs 9.6 and the outlook 1 (seven daily
  variables, rounded up to the minimum), 10.6 a refresh. The day count
  changes nothing below fourteen days, so `forecast_days=2` is free; only
  the variable count and the refresh rate move it. Raised in
  docs/open-questions.md, "Open-Meteo's call counting". The repository's
  workflows stay under 400 a day either way.
- **"Monthly limits are not enforced"** until Open-Meteo's usage portal
  exists (the pricing page).
- **The README's fair-use line:** "We do not restrict access, but ask for
  fair use. If your application exceeds 10'000 requests per day, please
  contact us."
- **Non-commercial** is defined on the terms page by a link to Creative
  Commons' NonCommercial interpretation page
  (<https://wiki.creativecommons.org/wiki/NonCommercial_interpretation>).

The repository, checked again:

- The site met the credit rule on every card and page that shows
  Open-Meteo data (the bundle carries the credit and both links); Data
  health links the name only, as a status, and the ceiling-error page
  shows no Open-Meteo data.
- **Two gaps, fixed the same day.** The `forecast-archive` branch held
  Open-Meteo's 10-day outlook as served, 362 files since 2026-10-13, with
  no README and no credit (`scripts/forecastKeepLoop.sh` now writes one on
  the branch with its next snapshot; checked after the next run). And `data/parity/surface-rows-*.md` quoted figures
  worked from Open-Meteo's forecast (both Surface rows are its) with no
  credit and no entry in `data/parity/README.md`; the script's header and
  both files now carry it, and the README lists them.
- The users-list request and the non-profit question below are as they
  were.

## Still open

- **The list of users** in Open-Meteo's README ("Do you use Open-Meteo?
  Please open a pull request and add your repository or app to the
  list!"): a request, not a term. Not sent: a pull request to another
  project under the maintainer's name is theirs to send
  (docs/open-questions.md).
- **Whether LSPC is a non-profit** does not change the reading above, but
  the maintainer may want it on record.
