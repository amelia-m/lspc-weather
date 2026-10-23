# How old the NWS forecast is when the page gets it

Measured 2026-10-23, at the maintainer's request. The NWS gridpoint feeds
every hourly chart and the forecast wind flags. The surface-wind sample
(docs/surface-wind-sources.md) had seen it served through caches that keep
a copy up to an hour, and had inferred that the app's fetch did not get
past them. This measures how stale it was and what the app's own fetch
added, and changes the fetch.

## What the sample's log shows

The surface-wind sampler fetched the gridpoint and the hourly product
straight from api.weather.gov every five minutes for 13 days, with no
client cache. It logged each response's `updateTime`, `Expires` and
`max-age`: 3,096 runs, 2026-10-09 03:44Z to 2026-10-21 22:55Z
(`data/parity/surfacewind-2026-10-09-to-2026-10-21.jsonl.gz`;
`scripts/nwsGridpointAge.py` prints every figure here).

- **NWS updates the forecast about hourly, unevenly.** 215 distinct
  `updateTime`s, a median 69 minutes apart (10% under 25 minutes, 10%
  over 151, the longest gap almost 10 hours).
- **A new forecast reaches the API about 25 minutes after its
  `updateTime`.** That is the median from `updateTime` to the first run
  that was served it (p90 49 minutes, longest 127). The gridpoint and the
  hourly product showed a new forecast at the same run in most cases
  (median 0 minutes apart, p90 5), so this delay is NWS's own, upstream of
  the gridpoint's caches. Nothing a reader's browser does changes it.
- **So a forecast is typically an hour old when fetched:** a median 66
  minutes since its `updateTime` (p10 28, p90 134). That is the update
  cadence plus that delay.
- **The edges hold copies of different ages.** 83 of 3,096 runs were
  answered with an `updateTime` older than one the gridpoint had already
  served. Eleven updates were seen in the hourly product and never on the
  gridpoint, because a later one replaced them first. `max-age` ran a
  median 1,801 s (25 to 3,600 s), counted down to the copy's `Expires`.
- **A query parameter cannot get past them.** `…/gridpoints/OAX/77,42?_=<time>`
  answers 400 (2026-10-23): the API rejects a parameter it does not know.
  A conditional request is honoured: `If-Modified-Since` with the current
  `Last-Modified` answered 304.

## What the browser added

**Seen in Chromium, 2026-10-23.** In a page on the deployed site, a second
`fetch` of the gridpoint within its `max-age` was answered from the disk
cache and never reached NWS (`fromDiskCache: true`). The same fetch with
`cache: 'no-cache'` went to the network. The deployed dashboard did the
same: the first load fetched the gridpoint and the Refresh button's
refetch took it from the disk cache. Since the edges count `max-age`
down to their copy's expiry, a browser holds the one edge copy it got
until that copy expires, while other edges may already serve a newer
forecast.

**Replayed on the log**, every other run, as the app refreshes every ten
minutes ("newest known" is the latest `updateTime` either product had
served by then, a lower bound on what NWS held):

| client | refreshes behind the newest known | mean behind | when behind, median | stepped back to an older forecast |
|---|---|---|---|---|
| browser default (keeps its copy to `Expires`) | 223 of 1,548 (14.4%) | 10.5 min | 65 min | 0 |
| asks every time, shows what answered | 121 (7.8%) | 5.4 min | 55 min | 21 |
| asks every time, keeps the newer copy | 93 (6.0%) | 4.1 min | 57 min | 0 |

So the browser's cache more than doubled how often the dashboard showed
an older forecast than NWS was already serving. Asking every time without
the guard would step back to an older forecast about once or twice a day.

## The change

- `fetchJson` takes a `cache` mode (a request option, not a header, so the
  request stays CORS-simple and needs no preflight).
- The gridpoint is fetched with `cache: 'no-cache'` (`fetchFreshGrid`,
  `src/api/nws.ts`). The browser revalidates on every refresh, which costs
  a 304 when nothing changed.
- The newer of that answer and the copy already shown is kept, per URL
  (`newerGridpoint`, `src/domain/gridpointFreshness.ts`, tested in
  `tests/gridpointFreshness.test.ts`). The hourly chart and the daily
  fallback both go through it.

Checked in Chromium on a production build served locally against live
NWS (2026-10-23, at 1280, 390 and 320 px): the gridpoint went to the
network both on load and on Refresh, with no script error and no
sideways scroll. The same Refresh on the deployed site, before the
change, took it from the disk cache.

What it does not change: the 25 minutes NWS takes to publish, the update
cadence, and the 6% of refreshes the replay still had behind. In those,
the edge that answered held an older copy than another edge did, and the
API offers no way past that. The figure is from a replay of the log, not
from readers' browsers.

## Not changed, and why

- **The observation** (`/stations/KPMV/observations/latest`) comes with
  `max-age=300`, and the app asks every two minutes. IEM is read first and
  usually has the report 20 minutes sooner (CLAUDE.md), so NWS's copy
  rarely decides what is shown. It was left as it is.
- **The TAF product list** has `max-age=120`, and `/points` a day. Neither
  changes within the time it is kept.
