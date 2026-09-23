# Winds at pressure levels below the ground

**Not model output.** Researched 2026-09-22. `normalizeOpenMeteo` drops them.

A pressure surface can lie underneath the terrain. At NE69 the 1000 hPa level
runs 85–738 ft MSL against a model surface of 1,145 ft — underground in every
hour of a 384-hour window. Open-Meteo returns a wind and a temperature for it
anyway, unmarked, and the app used to feed them into the same interpolation as
every other level.

This matters because the fill is invisible: it is a plausible low-altitude wind
with a plausible altitude label, and nothing in the payload says it was
manufactured.

## What the value actually is

**Wind:** the wind from the lowest model level *above* ground, copied downward
unchanged. **Temperature:** manufactured from a fixed lapse rate. Neither has
observational content at the height it is labelled with.

NOAA's Unified Post Processor — the code that writes GFS isobaric GRIB2 fields —
says so in a source comment, `sorc/ncep_post.fd/MDL2P.f`:

```
! FOR UNDERGROUND PRESSURE LEVELS, ASSUME TEMPERATURE TO CHANGE
! ADIABATICLY, RH TO BE THE SAME AS THE AVERAGE OF THE 2ND AND 3RD
! LAYERS FROM THE GOUND, WIND TO BE THE SAME AS THE LOWEST LEVEL ABOVE
! GOUND
```

<https://github.com/NOAA-EMC/UPP/blob/develop/sorc/ncep_post.fd/MDL2P.f>

The lapse rate is the standard one — `GAMMA=6.5E-3` in `sorc/ncep_post.fd/params.F`.

**Open-Meteo publishes the rule itself**, though only on its GEM model page:

> "If geopotential height is below ground, data should not be used."

<https://open-meteo.com/en/docs/gem-api>

Note it appears *only* there. The GFS and DWD pages — the models that actually
serve NE69 — carry only "Be careful not to mistake it with altitude above
ground", so a reader of the relevant page would never see it.

**NCAR's geocat-comp** confirms the same split independently: temperature and
geopotential height get special extrapolation formulae, and *"all other
variables"* — wind among them — take "the value of `data` at the lowest model
level" as the below-ground fill.
<https://github.com/NCAR/geocat-comp/blob/main/geocat/comp/interpolation.py>

## Measured, not just read

Deep-underground test points (Altiplano −16.5/−68.15, surface 3767 m; Lhasa
29.65/91.10, surface 3649 m), all 8 levels 1000→700 hPa below ground, 24 h each:

| | GFS | ICON |
|---|---|---|
| wind-speed spread across 8 levels spanning ~3 km | mean **0.25 kt** | mean **0.19 kt** |
| implied temperature lapse rate | **6.50 K/km** | 3.6–4.0 K/km |

Wind is flat — one value copied down three kilometres, exactly as the UPP
comment describes. GFS's temperature matches `GAMMA` to two decimals.

Two further observations: Open-Meteo does not mask, null or flag these levels,
and the underground wind is *not* the surface wind. At Lhasa the underground
1000 hPa wind was 0.4 kt @ 270° while the 10 m wind was 1.7 kt @ 27° — 243°
apart. At a low-elevation DZ the two look similar only because "the lowest level
above ground" is about 20 m up.

## What this changed here

Nothing on screen, and the commit says so rather than implying a save: the 10 m
sample already outranked the 1000 hPa level, so no displayed row drew on it.
Measured over the full 384-hour window, the sub-surface share of every displayed
row was 0.0%.

The ~4% figure quoted before the fix was a property of the **fixture**, which
sets `elevation: 360`; live returns `349`. That 11-metre difference is what puts
the 10 m sample above or below the field elevation, and therefore whether the
sub-surface level contributes at all.

It is worth having for three reasons:

1. **It removes a knife-edge.** Whether the sub-surface sample contributes
   depends on a DEM lookup landing within 10 m of the field elevation. A DEM
   refresh flips it silently, and invisibly to the tests, because the fixture is
   already on the other side.
2. **An hour missing `wind_speed_10m`** would have built the Surface row ~70%
   out of a wind stamped 600 ft underground — printed where a jumper reads
   ground wind. Same class as the NOAA FD 3,000 ft defect.
3. It makes `RawWindSample.isSurface` mean what its comment says.

The filter compares geopotential height against the **model's** surface
(`data.elevation`), not the DZ's published field elevation, because below-ground
is a fact about the model's terrain. They differ by ~37 ft here and agree today.

## What was not established

- **No modelling centre says "discard these" in a document anyone here opened.**
  The closest authoritative *and read* statement is NCEP's source comment, which
  describes what it does without judging it. The explicit instruction is
  Open-Meteo's, on one model page.
- **ECMWF's statements are unread.** `confluence.ecmwf.int` is egress-blocked
  from the development sandbox. Search-index text attributed to it ("wind
  components and humidity are kept constant from the lowest model level";
  "extrapolating into the data voids can contaminate the 'real' atmosphere")
  corroborates NCEP neatly, but **nobody has read the page**. Do not cite it as
  verified.
- **ICON's documented rule is unconfirmed and contradicted by measurement.** The
  ICON Database Reference Manual (dwd.de) is blocked; the index summary says
  6.5 K/km, the measurement says 2.65–4.89. One is wrong and we cannot tell which
  from here.
- **NCAR/TN-396** (Trenberth, Berry & Buja 1993), the canonical reference for the
  "ECMWF formulation", is cited by geocat-comp but its host is blocked. We have
  the citation, not the text.
- **No WMO/GRIB2 convention** was found requiring sub-surface isobaric points to
  be bitmapped as missing. Absence of evidence from a shallow search.

## Re-checking this

```
curl -sS 'https://api.open-meteo.com/v1/forecast?latitude=40.8675&longitude=-96.11\
&hourly=wind_speed_1000hPa,geopotential_height_1000hPa&forecast_days=1&timezone=UTC'
```

Compare `geopotential_height_1000hPa` (m MSL) against the `elevation` field in
the same response. Where the first is smaller, the level is underground.
