# usairnet parity evaluation

Reference comparison of the [usairnet KPMV aviation
forecast](https://www.usairnet.com/cgi-bin/launch/code.cgi?state=NE&sta=KPMV)
plot rows against the LSPC Weather dashboard, to track which forecast
components are covered and which remain candidates.

Legend: ✅ have · ⚠️ partial · ❌ missing · ⏭️ intentionally skipped.

| usairnet row | Dashboard status |
|---|---|
| Sky / Cloud coverage % | ✅ Ceiling & sky card + per-day hourly detail |
| Temp (°F) | ✅ hourly detail, daily hi/lo |
| Wind direction / avg speed / max gust | ✅ surface, winds aloft, hourly |
| Cloud base @ 60% / ceiling | ✅ ceiling (lowest BKN/OVC) |
| Chance of precip % | ✅ precip card + hourly |
| Visibility | ⚠️ current only — not shown per-hour |
| Flight Rule (VFR / MVFR / IFR / LIFR) | ❌ missing |
| Dew point + temp/dew-point spread | ⚠️ current METAR only, no forecast; spread not shown |
| Relative humidity | ❌ missing |
| Precip amount (QPF, inches) | ❌ missing (we have probability, not amount) |
| Chance of thunder % | ✅ NWS gridpoint `probabilityOfThunder` (Precip & storms card, hourly Storm column, advisory) |
| Probability precip is rain % | ⏭️ skip — low value for summer jumping |
| Lowest cloud base (any layer) | ⚠️ partial (we show ceiling, not lowest FEW/SCT) |
| Nebraska State Summary sidebar | ⏭️ skip — regional roundup, not DZ-specific |

## Prioritized backlog

1. **Flight category (VFR/MVFR/IFR/LIFR)** — highest value; derivable from
   ceiling + visibility we already have (no new source). Cite 14 CFR 91.155 /
   AIM flight-category definitions. *(implemented — see PR history)*
2. **Humidity + temp/dew-point spread** — tightening spread is the classic
   morning-fog / low-ceiling early warning; RH enables a humidity-corrected
   density altitude. Source: NWS gridpoint (dewpoint + RH), no new source.
3. **Per-hour visibility** — add a visibility column to the hourly detail
   table; already fetched hourly via the gridpoint.
4. **Precip amount (QPF, inches)** — NWS gridpoint `quantitativePrecipitation`,
   alongside the existing chance-of-precip %.

Resolved:

- **Chance of thunder %** — *implemented.* Investigation found the NWS
  gridpoint (`api.weather.gov`, which works even when Open-Meteo is blocked)
  exposes a numeric `probabilityOfThunder` property — the same data usairnet
  shows. We already fetch that gridpoint, so no new network dependency was
  needed. See the [NWS gridpoint properties
  doc](https://github.com/weather-gov/api/blob/master/gridpoints.md).

Skipped:
- **Probability precip is rain %** and **Nebraska State Summary** — low value
  for a single-DZ summer skydiving tool.

Design rule reminder: every added metric flags a condition and cites a source;
none of them render a go/no-go verdict.
