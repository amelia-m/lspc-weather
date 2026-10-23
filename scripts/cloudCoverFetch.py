"""
Gather the records docs/cloud-cover-sources.md is worked from: KPMV's METARs,
the NWS's forecast sky cover for the drop zone, and Open-Meteo's cloud cover
for the same point, over a past window, into one gzipped JSON-lines file.
scripts/cloudCoverSummary.ts reads that file; this one only fetches.

Why Python: the NWS forecast is read from the NDFD archive, GRIB2 files,
and the one decoder at hand is ECMWF's ecCodes (`pip install eccodes
eccodeslib`). Run once, by hand, with the network; it is not part of any
gate and nothing in the app imports it.

  python3 scripts/cloudCoverFetch.py 2026-04-01 2026-10-09 out.jsonl.gz

With SITES set ("PMV:40.9484:-95.9174,OMA:41.3119:-95.9018"), the forecasts
are read at each of those points instead of the drop zone, the METARs are
each named station's, and every record carries `site`, the station's id.
That is the station comparison in docs/cloud-cover-stations.md.

Sources, each as read 2026-10-10:

  ndfd    NOAA's NDFD sky-cover grids, the CONUS 2.5 km grid (WMO header
          YAUZ98), from the public archive at noaa-ndfd-pds.s3.amazonaws.com
          (wmo/sky/YYYY/MM/DD/). api.weather.gov's gridpoint `skyCover`,
          which the dashboard reads, served the same value at the nearest
          grid point in 46 of 46 hours at the drop zone and at three other
          sites on 2026-10-10; at a fourth the API's grid was a day old.
          Four issuances a day (the last file in each of 00, 06, 12 and 18 Z),
          every step in the file.
  cig     NOAA's NDFD ceiling grids, the same archive and grid (WMO header
          YMUZ98, wmo/cig/), read 2026-10-13: api.weather.gov's gridpoint
          `ceilingHeight`, which the Ceiling & sky card reads, served the
          same values, in metres, as the latest file at the drop zone's grid
          point for every hour of its next day. -29 is "no ceiling" (the
          API's null), 9999 the grid's missing value; both are kept as
          given. The files come twice an hour; as for sky cover, the last
          in each of 00, 06, 12 and 18 Z, every step in the file.
  wgust   NOAA's NDFD wind gust grids, the same archive and grid (WMO header
          YWUZ98, wmo/wgust/, GRIB2 0/2/22, m/s), read 2026-10-23 for
          docs/nws-gust-archive.md. The API's `windGust` matched the archive
          at 42 of 42 hours at the drop zone on 2026-10-13
          (scripts/ndfdApiCheck.py). About 50 MB a file, 48 a day; as for
          sky cover, the last in each of 00, 06, 12 and 18 Z. Never in the
          default; its records ('ndfd-wgust') go to their own archive,
          data/parity/ndfd-wgust-*.
  wspd    NOAA's NDFD wind speed (YCUZ98, wmo/wspd/, GRIB2 0/2/1, m/s) and
  wdir    direction (YBUZ98, wmo/wdir/, 0/2/0, degrees true), read
          2026-10-23 for the #wind-errors page's NWS archive section; the
          API's `windSpeed` and `windDirection` matched the archive at 42
          of 42 hours on 2026-10-13. Speed files about 57 MB, direction 33.
          Not in the default; with wgust they go to data/parity/ndfd-wind-*.
  om      Open-Meteo's cloud cover (total, low, mid, high) for the point the
          dashboard asks for, default model, from the Historical Forecast API
          (the start of each model run, stitched) and the Previous Runs API's
          `_previous_day1` (the forecast made a day earlier).
  metar   KPMV's reports from the Iowa Environmental Mesonet's ASOS archive,
          routine and special, as the METAR text.
  omwind  Open-Meteo's 10 m wind, gust and direction, in knots, from the same
          two archives as `om` (read 2026-10-23), for the #wind-errors page
          (src/domain/windErrors.ts). Never in the default, like `cig`: its
          records ('om-wind') go to their own archive, data/parity/om-wind-*.
"""
import datetime as dt
import gzip
import http.client
import json
import os
import ssl
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor

try:
    import eccodes
except ImportError:
    # Only the NDFD parts decode GRIB2; PARTS=metar,om,omwind run without it.
    eccodes = None

# src/config/site.ts: the drop zone, as the dashboard asks every forecast for
# it, and KPMV's reports against it. Each site is (id, lat, lon); `TAGGED`
# says whether records name their site (only when SITES is given, so the
# drop zone's archive keeps its shape).
DZ_LAT, DZ_LON = 40.8703, -96.1085


def parse_sites(spec: str) -> list[tuple[str, float, float]]:
    out = []
    for part in spec.split(','):
        sid, lat, lon = part.split(':')
        out.append((sid, float(lat), float(lon)))
    return out


SITES = parse_sites(os.environ['SITES']) if os.environ.get('SITES') else [('PMV', DZ_LAT, DZ_LON)]
TAGGED = bool(os.environ.get('SITES'))


def tag(record: dict, site: str) -> dict:
    return {**record, 'site': site} if TAGGED else record
BUCKET = 'https://noaa-ndfd-pds.s3.amazonaws.com'
UA = {'User-Agent': 'lspc-weather cloud-cover comparison (github.com/amelia-m/lspc-weather)'}
ISSUE_HOURS = (0, 6, 12, 18)
# Each NDFD part: its archive folder, its CONUS 2.5 km file header, its GRIB2
# (discipline, category, number), and the record's `src` and value field.
NDFD_PARTS = {
    'ndfd': ('sky', 'YAUZ98', (0, 6, 1), 'ndfd', 'sky'),
    'cig': ('cig', 'YMUZ98', (0, 6, 13), 'ndfd-cig', 'cig'),
    'wgust': ('wgust', 'YWUZ98', (0, 2, 22), 'ndfd-wgust', 'gust'),
    'wspd': ('wspd', 'YCUZ98', (0, 2, 1), 'ndfd-wspd', 'spd'),
    'wdir': ('wdir', 'YBUZ98', (0, 2, 0), 'ndfd-wdir', 'dir'),
}


ATTEMPTS = 14


def get(url: str) -> bytes:
    # A 30 MB file through the proxy is now and then cut short, and on
    # 2026-10-10 Open-Meteo's archive host dropped about one TLS handshake
    # in three, and in runs, for minutes at a time; try again, for up to
    # about ten minutes.
    for attempt in range(ATTEMPTS):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            # A refusal that waiting minutes will not change: any 4xx but a
            # 429, and Open-Meteo's daily-limit 429 ("Daily API request limit
            # exceeded"). Retry 5xx and an ordinary 429.
            body = e.read().decode(errors='replace') if e.fp else ''
            if (400 <= e.code < 500 and e.code != 429) or 'Daily API request limit' in body or attempt == ATTEMPTS - 1:
                raise
        except (http.client.IncompleteRead, urllib.error.URLError, ssl.SSLError, TimeoutError, ConnectionError):
            if attempt == ATTEMPTS - 1:
                raise
        time.sleep(min(2 ** attempt, 60))
    raise AssertionError('unreachable')


# The grid point nearest each site, per grid geometry: finding it decodes
# the grid's coordinates (about a second), reading one value by index does not.
_nearest: dict[tuple, dict] = {}


def nearest(h, lat: float, lon: float) -> dict:
    geom = tuple(eccodes.codes_get(h, k) for k in (
        'gridType', 'Nx', 'Ny', 'latitudeOfFirstGridPointInDegrees', 'longitudeOfFirstGridPointInDegrees', 'DxInMetres'))
    if (geom, lat, lon) not in _nearest:
        _nearest[(geom, lat, lon)] = eccodes.codes_grib_find_nearest(h, lat, lon + 360)[0]
    return _nearest[(geom, lat, lon)]


def iso(t: dt.datetime) -> str:
    return t.strftime('%Y-%m-%dT%H:%MZ')


def ndfd_keys(job: tuple[dt.date, str]) -> list[tuple[str, str]]:
    """The day's CONUS files for one NDFD part, one per issue hour: the last
    key written in it, with the part's name."""
    day, part = job
    folder, header = NDFD_PARTS[part][:2]
    prefix = f'wmo/{folder}/{day:%Y/%m/%d}/{header}_KWBN_'
    ns = {'s': 'http://s3.amazonaws.com/doc/2006-03-01/'}
    keys: list[str] = []
    token = ''
    # A listing returns at most 1,000 keys a page; a day has about 48, but a
    # later page must not be dropped without a word if that ever changes.
    while True:
        page = ET.fromstring(get(f'{BUCKET}/?list-type=2&prefix={prefix}&max-keys=1000{token}'))
        keys += [k.text for k in page.findall('.//s:Key', ns)]
        if page.findtext('s:IsTruncated', namespaces=ns) != 'true':
            break
        token = '&continuation-token=' + urllib.parse.quote(page.findtext('s:NextContinuationToken', namespaces=ns))
    keys.sort()
    chosen = []
    for h in ISSUE_HOURS:
        in_hour = [k for k in keys if k.rsplit('_', 1)[1][8:10] == f'{h:02d}']
        if in_hour:
            chosen.append((in_hour[-1], part))
    return chosen


def ndfd_records(job: tuple[str, str]) -> list[dict]:
    key, part = job
    param, src, field = NDFD_PARTS[part][2:]
    issued = dt.datetime.strptime(key.rsplit('_', 1)[1], '%Y%m%d%H%M').replace(tzinfo=dt.timezone.utc)
    with tempfile.NamedTemporaryFile(suffix='.grib2') as tmp:
        tmp.write(get(f'{BUCKET}/{key}'))
        tmp.flush()
        out = []
        with open(tmp.name, 'rb') as f:
            while True:
                try:
                    h = eccodes.codes_grib_new_from_file(f)
                except eccodes.PrematureEndOfFileError:
                    # A file cut short in the archive itself: the gust's
                    # 2026-09-28 00:47Z issuance ends inside its 48th
                    # message, every time it is read, so failing would
                    # stop every later fetch on a gap no rerun can fill.
                    # Keep the messages before the break (the hours it
                    # loses fall to the issuance before, as for a missing
                    # file), and say so twice: a `::warning::` line, which
                    # GitHub shows on the run's page, and a record in the
                    # archive itself, which the readers skip (they keep
                    # only their own `src`).
                    print(f'::warning::{key} ends inside a message; kept {len(out)} records before it')
                    out.append(tag({'src': 'ndfd-truncated', 'key': key.rsplit('/', 1)[1], 'issued': iso(issued), 'kept': len(out)}, SITES[0][0]))
                    break
                if h is None:
                    break
                try:
                    g = lambda k: eccodes.codes_get(h, k)
                    if (g('discipline'), g('parameterCategory'), g('parameterNumber')) != param:
                        continue
                    ref = dt.datetime.strptime(f"{g('dataDate')}{g('dataTime'):04d}", '%Y%m%d%H%M').replace(tzinfo=dt.timezone.utc)
                    valid = dt.datetime.strptime(f"{g('validityDate')}{g('validityTime'):04d}", '%Y%m%d%H%M').replace(tzinfo=dt.timezone.utc)
                    for sid, lat, lon in SITES:
                        near = nearest(h, lat, lon)
                        out.append(tag({
                            'src': src, 'key': key.rsplit('/', 1)[1], 'issued': iso(issued), 'ref': iso(ref),
                            'valid': iso(valid), field: eccodes.codes_get_double_element(h, 'values', near['index']),
                            'gridKm': round(near['distance'], 2),
                        }, sid))
                finally:
                    eccodes.codes_release(h)
        return out


def om_archive(start: dt.date, end: dt.date, lat: float, lon: float, names: list[str], extra: str = '') -> list[tuple]:
    """Both Open-Meteo archives' hourly values for `names`: (run, valid time,
    values in `names`' order, the cell served) for every hour with any value.
    `extra` adds query parameters, such as the wind's unit."""
    loc = f'latitude={lat}&longitude={lon}&start_date={start}&end_date={end}&timezone=UTC{extra}'
    hist = json.loads(get(f'https://historical-forecast-api.open-meteo.com/v1/forecast?{loc}&hourly={",".join(names)}'))
    prev_vars = [f'{n}_previous_day1' for n in names]
    prev = json.loads(get(f'https://previous-runs-api.open-meteo.com/v1/forecast?{loc}&hourly={",".join(prev_vars)}'))
    out = []
    for run, data, keys in (('historical', hist, names), ('previous_day1', prev, prev_vars)):
        hourly = data['hourly']
        for i, t in enumerate(hourly['time']):
            vals = [hourly[k][i] for k in keys]
            if all(v is None for v in vals):
                continue
            out.append((run, t + 'Z', vals, f"{data['latitude']},{data['longitude']}"))
    return out


def om_records(start: dt.date, end: dt.date, sid: str, lat: float, lon: float) -> list[dict]:
    bands = ['cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high']
    return [
        tag({'src': 'om', 'run': run, 'valid': t, 'total': v[0], 'low': v[1], 'mid': v[2], 'high': v[3], 'grid': grid}, sid)
        for run, t, v, grid in om_archive(start, end, lat, lon, bands)
    ]


def om_wind_records(start: dt.date, end: dt.date, sid: str, lat: float, lon: float) -> list[dict]:
    # Knots to the tenth, as the dashboard asks for its own 10 m wind
    # (openMeteoWindsUrl), so the archive and the card read the same units.
    names = ['wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m']
    return [
        tag({'src': 'om-wind', 'run': run, 'valid': t, 'spd': v[0], 'gust': v[1], 'dir': v[2], 'grid': grid}, sid)
        for run, t, v, grid in om_archive(start, end, lat, lon, names, '&wind_speed_unit=kn')
    ]


def metar_records(start: dt.date, end: dt.date) -> list[dict]:
    last = end + dt.timedelta(days=1)
    url = (
        'https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?'
        + '&'.join(f'station={sid}' for sid, _, _ in SITES)
        + '&data=metar'
        f'&year1={start.year}&month1={start.month}&day1={start.day}'
        f'&year2={last.year}&month2={last.month}&day2={last.day}'
        '&tz=Etc/UTC&format=onlycomma&latlon=no&report_type=3&report_type=4'
    )
    out = []
    for line in get(url).decode().splitlines()[1:]:
        station, valid, raw = line.split(',', 2)
        out.append(tag({'src': 'metar', 'obsAt': valid.replace(' ', 'T') + 'Z', 'raw': raw}, station))
    return out


def main() -> None:
    start, end = (dt.date.fromisoformat(a) for a in sys.argv[1:3])
    path = sys.argv[3]
    days = [start + dt.timedelta(days=i) for i in range((end - start).days + 1)]
    # PARTS=metar,ndfd or PARTS=om fetches only those, to merge after: on
    # 2026-10-10 Open-Meteo's archive answered 429 for an hour at a stretch.
    # PARTS=cig, the ceiling, is never in the default; its records
    # ('ndfd-cig') go to their own archive, data/parity/ceiling-*, and
    # parseCloudCoverLines skips them if they share a file with sky cover.
    parts = set(os.environ.get('PARTS', 'metar,om,ndfd').split(','))
    if eccodes is None and parts & set(NDFD_PARTS):
        sys.exit('the NDFD parts need ecCodes: pip install eccodes eccodeslib')
    records = metar_records(start, end) if 'metar' in parts else []
    for sid, lat, lon in (SITES if 'om' in parts else []):
        # Spaced, so a run of fourteen sites does not meet the archive host's
        # dropped handshakes back to back.
        records += om_records(start, end, sid, lat, lon)
        time.sleep(3)
    for sid, lat, lon in (SITES if 'omwind' in parts else []):
        records += om_wind_records(start, end, sid, lat, lon)
        time.sleep(3)
    jobs = [(d, p) for p in NDFD_PARTS if p in parts for d in days]
    with ThreadPoolExecutor(8) as pool:
        keys = [k for ks in pool.map(ndfd_keys, jobs) for k in ks]
    print(f'{len(keys)} NDFD files', file=sys.stderr)
    # Processes, not threads: one ecCodes handle per process is the safe use.
    with ProcessPoolExecutor(int(os.environ.get('WORKERS', '6'))) as pool:
        for i, recs in enumerate(pool.map(ndfd_records, keys)):
            records.extend(recs)
            if i % 50 == 0:
                print(f'  {i}/{len(keys)}', file=sys.stderr)
    with gzip.open(path, 'wt') as f:
        for r in records:
            f.write(json.dumps(r, separators=(',', ':')) + '\n')
    print(f'{len(records)} records to {path}', file=sys.stderr)


if __name__ == '__main__':
    main()
