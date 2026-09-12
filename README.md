# LSPC Weather

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
> does **not** decide whether it's safe to jump. The citations to the USPA SIM,
> the CFRs, and other sources are **AI-derived and may be inaccurate** — verify
> every value against the primary source and with a licensed professional before
> relying on it. Always confirm conditions with current official sources, the
> S&TA, and the pilot in command.

## What it shows

- **Conditions to note** — flagged values (wind, gusts, ceiling, visibility,
  overcast, precip, density altitude, winds aloft, daylight), each with the
  source it relates to — a **USPA / FAA / LSPC-waiver** source where one exists,
  and otherwise an explicit **"app heuristic"** marker, because several flags
  fire on thresholds this dashboard chose rather than on a published limit. No
  go/no-go verdict.
- **Current conditions** — decoded KPMV METAR (raw text included).
- **Surface wind** — sustained + gust with flag bands per profile (Student /
  Licensed / LSPC waiver tiers), each band labelled with where its number comes
  from, kt/mph toggle.
- **Winds aloft** — speed/direction/temperature at surface → 13,000 ft AGL in
  1,000-ft steps, interpolated from pressure-level model winds.
- **Freefall drift / spot** — Schulze-style drift estimate with editable exit,
  deploy, and fall-rate inputs.
- **Hourly wind** — next ~18 h wind/gust chart with precip-probability bars.
- **10-day outlook** — daily sky, high/low, max wind/gust, precip chance.
- **Ceiling & sky** — current ceiling + an hourly sky-cover/ceiling timeline.
- **Precipitation** — hourly precip-probability timeline.
- **Radar** — KOAX (Omaha) loop with a link to the interactive viewer.
- **TAF** — nearest available TAF (see cross-references below).
- **Density altitude** — DA, pressure altitude, ISA deviation (C-182 note).
- **Daylight** — sunrise/sunset and time to sunset for last-load planning.
- **Data health** — per-source freshness, staleness, and error state.

## Data sources (all free, no API key)

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

## Cross-references

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

## Develop

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

## Citations

Advisory thresholds and their sources live in
[`src/config/thresholds.ts`](src/config/thresholds.ts).

**Not all of these numbers are sourced, and the app says which are.** Some come
from a published document — the student ground-wind limit and the opening
altitudes from the USPA SIM/BSR, the 3 SM visibility floor and cloud clearance
from 14 CFR 105.17, the flight categories from FAA AIM 7-1-7, density altitude
from FAA-P-8740-2, and the waivered wind and gust ceilings from the club's
posted policy
([`docs/lspc-waivered-wind-limits.md`](docs/lspc-waivered-wind-limits.md)).

**Most of the rest are house heuristics** — thresholds this dashboard chose so a
card would say something useful before a condition became a problem. The ceiling
bands, the fog dew-point spread, the precipitation and forecast-thunderstorm
chances, the licensed wind bands, and every "watch" level sitting under a real
limit are in that group. None is a USPA or FAA figure, and each is cited as
**"LSPC Weather — app heuristic"** rather than being dressed in a source that
never set it.

One flag is mixed: **winds aloft** fires at a speed the app chose, but what it
tells you (strong upper winds lengthen the spot — plan jump run and exit
separation) is skydiving practice a SIM section very likely governs. It keeps
the section-less SIM citation for that claim and states in the flag text that
the trigger speed is the dashboard's.

The dashboard's own **Citations** page — the `#citations` route in the running
app — lists exactly those unsourced numbers, for an instructor or S&TA to rule
on.

Every citation here is **AI-derived and unverified** — nothing in this repo has
been checked against a current SIM or CFR — so **re-verify each against the
linked primary source** before relying on it operationally.

## Deploy

Pushing to `main` runs
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) (lint + tests +
build, then GitHub Pages publish); pull requests run the same checks via
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) without deploying.
Enable Pages → "GitHub Actions" in repo settings. The Vite `base` is
`/lspc-weather/`; override with `BASE_PATH` if hosting elsewhere. The
production build also injects a Content-Security-Policy meta tag scoped to the
data sources above.
