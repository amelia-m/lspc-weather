# 🪂 LSPC Weather

A skydiving weather dashboard for the **Lincoln Sport Parachute Club** (Brown's
Airport, **NE69**) in Weeping Water, NE — tuned to the conditions that matter
for jumpers and the club's Cessna 182 jump plane.

It consolidates the manual three-site routine (NOAA hourly forecast + usairnet
cloud forecast + KPMV METAR) into one page, and adds **winds aloft** for
freefall drift and **density altitude** for jump-plane climb performance.

> **In development — not endorsed or approved by USPA, LSPC, or any licensed
> professional.**
>
> **Advisory only.** This dashboard *flags conditions and cites guidance* — it
> does **not** decide whether it's safe to jump. Every USPA, CFR and FAA
> citation here began as an AI recollection. Each has since been read at its
> source — the **USPA SIM** at uspa.org on 2026-09-22, the **CFR sections, AIM
> 7-1-7 and FAA-P-8740-2** on 2026-09-23 — and the claims corrected against
> them. The club's wind-limit tiers are different in kind: a transcription of an
> undated photo of the posted sign, not a document anyone opened. Neither is a
> licensed professional's sign-off — verify against the primary source before
> relying on it. Always confirm conditions with current official sources, the
> S&TA, and the pilot in command.

## 🌤️ What it shows

- ⚠️ **Conditions to note** — the flagged conditions, each with the source it
  relates to: surface wind, the LSPC waiver gust ceiling, visibility, FAA flight
  category, overcast sky, a thunderstorm reported in the METAR, and parachute
  ops after sunset. Every one fires either on a **published limit** (USPA / the
  CFRs / the FAA AIM / the club's posted waiver) or on a plain observed fact —
  overcast reported, `TS` in the METAR, the sun is down. Where nothing published
  sets a trigger, **no flag fires at all**; there is no "app heuristic" label to
  fall back on. No go/no-go verdict.
- 🌡️ **Current conditions** — decoded KPMV METAR (raw text included).
- 💨 **Surface wind** — sustained + gust on a scale, kt/mph toggle. A band is
  drawn only where a published source sets it — the USPA ground-wind figure for
  Student, the posted club policy for the LSPC waiver tiers — and is labelled
  with that source. The Licensed profile draws no band and says so: nobody
  publishes a surface-wind limit for licensed jumpers.
- 🌬️ **Winds aloft** — speed/direction/temperature at the surface, 500 ft (pattern
  altitude), then 1,000-ft steps to 13,000 ft AGL, interpolated from
  pressure-level model winds, with the
  spot/exit-separation note standing under the table at any wind speed.
- 🎯 **Freefall drift / spot** — Schulze-style drift estimate with editable exit,
  deploy, and fall-rate inputs.
- 📈 **Hourly wind** — wind/gust chart with precip-probability bars, over a
  selectable 18 / 36 / 72 h horizon (18 h by default).
- 📅 **10-day outlook** — daily sky, high/low, max wind/gust, precip chance; tap a
  day for its hourly detail.
- ☁️ **Ceiling & sky** — current ceiling + an hourly sky-cover/ceiling timeline.
- ⛈️ **Precipitation & storms** — max precip and thunderstorm chance over the next
  6 h, forecast rain amount, and an hourly precip-probability timeline.
- 📡 **Radar** — KOAX (Omaha) loop with a link to the interactive viewer.
- 📝 **TAF** — nearest available TAF (see cross-references below).
- 🏔️ **Density altitude** — DA, pressure altitude, ISA deviation (C-182 note).
- 🌅 **Daylight** — sunrise, sunset, and time remaining until sunset. Sunset is
  where the 14 CFR 105.19 night-ops flag fires; there is no earlier "last load"
  countdown, because no published source sets a minutes-before-sunset figure.
- 🩺 **Data health** — per-source freshness, staleness, and error state, plus which
  provider each source is served from. The METAR row says whether the NWS
  API's decode of the report agreed with the METAR text the app parses, amber
  when it did not.

## 🔗 Data sources (all free, no API key)

| Source | Used for |
|---|---|
| [NWS api.weather.gov](https://www.weather.gov/documentation/services-web-api) | gridded hourly ceiling/sky/visibility/wind/precip for the DZ, the current KPMV observation (raw METAR + decoded), and TAF text products |
| [Open-Meteo](https://open-meteo.com/) | winds aloft (pressure levels) and the 10-day daily outlook |
| [NWS radar](https://radar.weather.gov/) | KOAX radar loop (image embed, no API) |

KPMV (~12 mi from the DZ) is the nearest reporting station and issues METARs;
it does not issue a TAF. TAFs are fetched through a fallback chain —
**KOFF → KOMA → KLNK** — because Offutt's TAF is USAF-issued and not always
carried on the NWS text-product feed; the card labels whichever station
supplied the forecast. Current conditions come from the NWS observation
endpoint rather than AviationWeather.gov because `api.weather.gov` sends CORS
headers and is reliably reachable from a browser, while `aviationweather.gov`
is not.

## 🔁 Cross-references

This dashboard gathers a lot of sources in one place — it is **not a
replacement** for the tools jumpers already check. Several cards link out to
well-known external pages that show the *same underlying data*, so you can
sanity-check the dashboard against sources you already trust:

- **Ceiling & sky ↔ [usairnet KPMV aviation
  forecast](https://www.usairnet.com/cgi-bin/launch/code.cgi?state=NE&sta=KPMV)**
  — a page many jumpers use. usairnet has no public API and presents NWS
  forecast data; this dashboard pulls that data directly from the NWS gridpoint
  API instead. One difference: usairnet's page is for the KPMV station, while
  the dashboard's forecast grid is centered on the DZ itself (only the METAR
  observation comes from KPMV).
- **Winds aloft ↔ [Mark Schulze's Winds
  Aloft](https://www.markschulze.net/winds/)** — the popular skydiving winds
  tool; same Open-Meteo model source.
- **TAF ↔ [AWC TAF
  viewer](https://aviationweather.gov/data/taf/?ids=KOFF%2CKOMA%2CKLNK)** —
  shows all three chain stations, including KOFF's USAF-issued TAF on days it
  isn't in the NWS feed.

If a dashboard number and its cross-reference disagree meaningfully, trust
neither — check the primary source and ask the S&TA.

## 🛠️ Develop

```bash
npm install
npm run dev          # dev mode uses bundled sample data (sandbox-friendly)
npm test             # unit tests for the pure domain logic
npm run lint         # eslint
npm run typecheck    # tsc, no emit
npm run build        # production build (uses live APIs)
```

`VITE_USE_FIXTURES=true|false` overrides the data source. Dev defaults to
**sample data**; production builds default to **live APIs**. Live `.gov` calls
work from a normal browser; some sandboxed/CI networks block them.

## 📚 Citations

Advisory thresholds and their sources live in
[`src/config/thresholds.ts`](src/config/thresholds.ts).

**Every number that fires a flag comes from a published document** — the
student ground-wind limit and the opening altitudes from the USPA SIM/BSR, the
3 SM visibility floor and cloud clearance from 14 CFR 105.17, the flight
categories from FAA AIM 7-1-7, the sunset trigger from 14 CFR 105.19, and the
waivered wind and gust ceilings from the club's posted policy
([`docs/lspc-waivered-wind-limits.md`](docs/lspc-waivered-wind-limits.md)).
Density altitude cites FAA-P-8740-2 for the claim on its card, not for a
threshold.

**There is no "app heuristic" label.** There used to be: a citation reading
"LSPC Weather — app heuristic" that let a threshold this dashboard invented
still show a "Source:" line. It is gone, and so are the flags that needed it —
the ceiling bands, the fog dew-point spread, the precipitation and
forecast-thunderstorm chances, the licensed wind bands, the winds-aloft trigger
speed, the density-altitude bands, the last-load countdown, and every "watch"
band that sat a few knots under a real limit. They were removed rather than
relabelled, because a threshold nobody published is not something a reader can
check. Rule 3 in [`src/config/thresholds.ts`](src/config/thresholds.ts) now
forbids a citation pointing back into the app, and `tests/thresholds.test.ts`
enforces it.

(The **Watch** badge itself still appears, on the two flags that fire on a
reported condition rather than on a chosen number: MVFR flight category and an
overcast layer. What went was the watch *threshold*.)

Where a removed flag's **guidance** was itself sourced, the guidance stayed and
only the invented trigger went. "Strong upper winds lengthen the spot — plan
jump run and exit separation" now stands under the winds-aloft table at any wind
speed, and the climb-performance note stands on the density-altitude card, each
still carrying its citation. Neither waits on a speed or an altitude the app
picked.

One invented number is still on screen and it triggers nothing: 25 kt, which
sets where the Licensed surface-wind bar tops out.

The dashboard's own **Citations** page — the `#citations` route in the running
app — lists each claim, what the cited section says, and the questions an
instructor or S&TA is asked to settle, plus that one remaining number. Rulings
are entered on the page itself: a verdict per claim, an answer and a note per
question, kept in the browser until sent. The site has no backend, so "Send as
a GitHub issue" opens a prefilled issue in this repository, and "Copy answers"
gives the same text for anyone without a GitHub account.

A second page, **How different from other sources** (`#parity`), shows what
the scheduled comparison logs add up to: the winds-aloft table against Mark
Schulze's Winds Aloft at the same valid hour, row by row, and the dashboard's
decode of the latest KPMV observation against usairnet's, field by field. It
reports counts and spreads across runs — average, median, 90th percentile,
smallest and largest gap; how often any row was more than 10° apart; how often
the two pages showed different hours — and never a grade. A daily workflow
writes its data from the logs. The pipeline and how to read the page are in
[`docs/source-parity.md`](docs/source-parity.md).

Every USPA, CFR and FAA citation here began as an AI recollection; the club's
posted wind-limit tiers did not — they are a transcription of an undated photo
of the sign, and stay that. On 2026-09-22 the USPA SIM sections were fetched
from uspa.org and read: two claims were wrong and were
fixed (the C/D minimum opening altitude, and a USPA licence claim cited to a CFR
that does not mention licences), and two citations that pointed at the SIM
contents page now name sections (4-5 Weather, 4-7 Spotting). On 2026-09-23 the
rest followed: 14 CFR 105.17 and 105.19 through the eCFR, AIM 7-1-7 on faa.gov
and FAA-P-8740-2 from the linked PDF. All four say what the app claimed. Two
sentences said more than their section does and were tightened — the sky card
no longer says jumps "require VFR flight conditions", which 105.17 never
mentions, and the night flag now says whose light it is — and the 105.17 row
for exits at or above 10,000 ft MSL (5 SM, 1 mile from cloud) is printed where
only the lower row was. What was read is each source as served on one day, not
a printed edition, so **re-verify against the linked primary source** before
relying on any of it operationally.

## 🚀 Deploy

Pushing to `main` runs
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) (lint + tests +
build, then GitHub Pages publish); pull requests run the same checks via
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) without deploying.
Enable Pages → "GitHub Actions" in repo settings. The Vite `base` is
`/lspc-weather/`; override with `BASE_PATH` if hosting elsewhere. The
production build also injects a Content-Security-Policy meta tag scoped to the
data sources above.
