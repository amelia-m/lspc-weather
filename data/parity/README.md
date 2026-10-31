# Archived comparison data

The files here are what the comparison scripts fetched or logged, kept so
the docs' figures can be worked out again. Each doc names the files it was
worked from and the script that made them.

## Open-Meteo's data in these files

Open-Meteo's terms ask for a credit next to wherever its data are shown
(docs/open-meteo-terms.md). These files hold some:

- `cloud-cover-*.jsonl.gz` and `cloud-cover-stations-*.jsonl.gz`: the
  records with `"src":"om"`, Open-Meteo's cloud cover as served by its
  Historical Forecast and Previous Runs APIs (`scripts/cloudCoverFetch.py`).
- `om-wind-*.jsonl.gz`: its 10 m wind, gust and direction from the same
  two archives, as served (`PARTS=omwind`).
- `runsplit-*` (the run-split sampler, docs/run-split.md): its raw
  pressure-level winds set against Mark Schulze's and against a second
  request of the app's own, as gaps, with the run metadata of its HRRR
  and GFS domains.
- `surface-rows-*.md` (`scripts/surfaceRows.ts`): this app's 10 m row and
  Mark Schulze's Surface row, both worked from Open-Meteo's forecast, set
  against KPMV's measured wind.
- `surfacewind-*` (the surface-wind sampler: two dated files for its
  first three weeks, then one a month, `surfacewind-<YYYY-MM>`, written
  daily by the parity summary workflow) and `schulze-logs-*`,
  `logs-to-*` and `parity-logs-*` (the comparison logs): Open-Meteo's
  values as the app requested them, some as served, some interpolated to
  heights above the drop zone, set beside other sources'.

Weather data by [Open-Meteo.com](https://open-meteo.com/), under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Changes are as
each file's script and doc describe. The NOAA, NWS and Iowa Environmental
Mesonet records beside them are not Open-Meteo's.

Open-Meteo asks researchers who use its data to cite it:
Zippenfenig, P. (2023). Open-Meteo.com Weather API [Computer software].
Zenodo. https://doi.org/10.5281/ZENODO.7970649
