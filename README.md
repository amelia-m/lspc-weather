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
  **USPA / FAA source** it relates to. No go/no-go verdict.
- **Current conditions** — decoded KPMV METAR.
- **Surface wind** — sustained + gust with sourced limit bands.
- **Winds aloft** — speed/direction at surface → 12,000 ft AGL (drift/spot).
- **Ceiling & sky** — current ceiling + an hourly sky-cover timeline.
- **Density altitude** — DA, pressure altitude, ISA deviation.
- **Daylight** — sunrise/sunset and time to sunset for last-load planning.

## Data sources (all free, no API key)

| Source | Used for |
|---|---|
| [NWS api.weather.gov](https://www.weather.gov/documentation/services-web-api) | gridded hourly ceiling/sky/visibility/wind/precip **and** the current KPMV observation (raw METAR + decoded) |
| [Open-Meteo](https://open-meteo.com/) | winds aloft (pressure levels) |

KPMV (~12 mi from the DZ) is the nearest reporting station and issues METARs;
it does not issue its own TAF (the nearest TAFs are KOFF/KOMA). Current
conditions come from the NWS observation endpoint, not AviationWeather.gov,
because `api.weather.gov` is reliably reachable from the browser.

## Develop

```bash
npm install
npm run dev          # dev mode uses bundled sample data (sandbox-friendly)
npm test             # unit tests for the pure domain logic
npm run build        # production build (uses live APIs)
```

`VITE_USE_FIXTURES=true|false` overrides the data source. Dev defaults to
**sample data**; production builds default to **live APIs**. Live `.gov` calls
work from a normal browser; some sandboxed/CI networks block them.

## Citations

Advisory thresholds and their sources live in
[`src/config/thresholds.ts`](src/config/thresholds.ts). The numbers reflect
well-established USPA (SIM/BSR) and FAA (14 CFR 105.17 / 91.155, density
altitude) guidance; **re-verify each against the linked primary source** before
relying on it operationally.

## Deploy

Pushing to `main` (or the feature branch) runs
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which builds and
publishes to GitHub Pages. Enable Pages → "GitHub Actions" in repo settings.
The Vite `base` is `/lspc-weather/`; override with `BASE_PATH` if hosting
elsewhere.
