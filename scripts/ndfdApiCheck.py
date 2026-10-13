"""
Set the NDFD archive's grids beside api.weather.gov's gridpoint for the drop
zone, element by element, at one moment. The question it answers: does the
archive hold the forecast the dashboard showed, so that a past forecast can
be read from it rather than kept? docs/open-questions.md, "Forecasts kept
for later", has the answer as read 2026-10-13.

Run by hand, with the network, in a Python with ecCodes (`pip install
eccodes eccodeslib`); not part of any gate. It reads the gridpoint, then
the CONUS NDFD files for each element (about 600 MB): for each 2.5 km
three-day header (ending 98), the last issuance before the gridpoint's
`updateTime` and the first after it, if there is one yet; for every other
header, the newest. It decodes each message at the grid point nearest the
drop zone and prints, per file, how many hours agree with the API:

  python3 scripts/ndfdApiCheck.py out.jsonl.gz
  python3 scripts/ndfdApiCheck.py --from out.jsonl.gz   # print it again

The output keeps the gridpoint as served, then every decoded value, one
JSON line each, written file by file so a fetch that fails late keeps what
came before it.

How the two are put side by side:
- The API serves each value over a validTime/duration range, in SI units
  converted from the forecast office's own (wind in km/h from knots,
  temperature in °C from °F, visibility in m from miles). NDFD packs m/s, K
  and m to a tenth or so, so each pair is compared in the office's unit as
  a reader sees it: whole knots, whole °F, visibility to 0.05 mile, and
  direction in whole degrees, 360 and 0 the same.
- Instantaneous elements (wind, gust, direction, temperature, dew point,
  visibility) match on the hour; rainfall (`qpf`) on the same 6-hour
  period, in mm.
- `pop12` is a 12-hour chance; the API's is hourly. It is set beside the
  highest hourly chance the API gives inside the same 12 hours.
- A file's first `qpf` and `pop12` message can be a period running from
  the file's reference time rather than a standard one (`qpf` starts 00,
  06, 12, 18 UTC, `pop12` 00 and 12); only standard periods are compared,
  and the rest are counted as such.
- Every element is non-negative in NDFD's units, and a negative value is
  the office's missing value: −9999 in its own unit (−16,091,830 m is
  −9999 miles). Those are counted as missing, not compared.
"""

import datetime as dt
import gzip
import json
import os
import re
import sys
import tempfile
import urllib.parse
import xml.etree.ElementTree as ET

import eccodes

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cloudCoverFetch import BUCKET, DZ_LAT, DZ_LON, get, nearest  # noqa: E402

# Each element, by archive folder: the API property it is set against, and
# how both become the unit a reader sees (NDFD's value, the API's value).
KT_KMH = 1.852
ELEMENTS = {
    'vis': ('visibility', lambda n: round(n / 1609.344 / 0.05) * 0.05, lambda a: round(a / 1609.344 / 0.05) * 0.05),
    'wspd': ('windSpeed', lambda n: round(n * 3.6 / KT_KMH), lambda a: round(a / KT_KMH)),
    'wgust': ('windGust', lambda n: round(n * 3.6 / KT_KMH), lambda a: round(a / KT_KMH)),
    'wdir': ('windDirection', lambda n: round(n) % 360, lambda a: round(a) % 360),
    'temp': ('temperature', lambda n: round((n - 273.15) * 9 / 5 + 32), lambda a: round(a * 9 / 5 + 32)),
    'td': ('dewpoint', lambda n: round((n - 273.15) * 9 / 5 + 32), lambda a: round(a * 9 / 5 + 32)),
    'qpf': ('quantitativePrecipitation', None, None),
    'pop12': ('probabilityOfPrecipitation', None, None),
}


def issued(key: str) -> dt.datetime:
    return dt.datetime.strptime(key.rsplit('_', 1)[1], '%Y%m%d%H%M')


def keys_on(folder: str, day: dt.date) -> dict[str, list[str]]:
    """A day's CONUS keys in one folder, by header, oldest first. CONUS
    headers have U as their third letter (YMAZ98, with A, is Puerto Rico)."""
    ns = {'s': 'http://s3.amazonaws.com/doc/2006-03-01/'}
    keys: list[str] = []
    token = ''
    # A folder holds every region's headers, 174 keys in wspd partway
    # through 2026-10-13; a page holds 1,000, but a later one must not be
    # dropped without a word.
    while True:
        page = ET.fromstring(get(f'{BUCKET}/?list-type=2&prefix=wmo/{folder}/{day:%Y/%m/%d}/&max-keys=1000{token}'))
        keys += [e.text for e in page.findall('.//s:Key', ns)]
        if page.findtext('s:IsTruncated', namespaces=ns) != 'true':
            break
        token = '&continuation-token=' + urllib.parse.quote(page.findtext('s:NextContinuationToken', namespaces=ns))
    by: dict[str, list[str]] = {}
    for k in sorted(keys, key=issued):
        name = k.rsplit('/', 1)[1]
        if name[2] == 'U':
            by.setdefault(name[:6], []).append(k)
    return by


def chosen(folder: str, update: dt.datetime) -> list[tuple[str, str]]:
    """(key, which side of the API's update it was issued) for one folder.
    Yesterday's keys are read too, so a run just after 00Z still finds the
    issuance before the update."""
    by: dict[str, list[str]] = {}
    today = dt.datetime.now(dt.timezone.utc).date()
    for day in sorted({update.date() - dt.timedelta(days=1), update.date(), today}):
        for header, keys in keys_on(folder, day).items():
            by.setdefault(header, [])
            by[header] += [k for k in keys if k not in by[header]]
    out = []
    for header, keys in sorted(by.items()):
        if header.endswith('98'):
            before = [k for k in keys if issued(k) <= update]
            after = [k for k in keys if issued(k) > update]
            out += [(before[-1], 'before')] if before else []
            out += [(after[0], 'after')] if after else []
        elif keys:
            out.append((keys[-1], 'after' if issued(keys[-1]) > update else 'before'))
    return out


def decode(key: str, el: str, side: str) -> list[dict]:
    out = []
    with tempfile.NamedTemporaryFile(suffix='.grib2') as tmp:
        tmp.write(get(f'{BUCKET}/{key}'))
        tmp.flush()
        with open(tmp.name, 'rb') as f:
            while (h := eccodes.codes_grib_new_from_file(f)) is not None:
                try:
                    g = lambda k: eccodes.codes_get(h, k)
                    # The 88 and 87 headers are a 5 km grid, the rest 2.5 km;
                    # nearest() keeps one point per grid.
                    near = nearest(h, DZ_LAT, DZ_LON)
                    ref = dt.datetime.strptime(f"{g('dataDate')}{g('dataTime'):04d}", '%Y%m%d%H%M')
                    # Steps can be in minutes (a :30 reference time); read them so.
                    eccodes.codes_set_string(h, 'stepUnits', 'm')
                    start = ref + dt.timedelta(minutes=eccodes.codes_get_long(h, 'startStep'))
                    end = ref + dt.timedelta(minutes=eccodes.codes_get_long(h, 'endStep'))
                    out.append({
                        'el': el, 'header': key.rsplit('/', 1)[1][:6], 'issued': key.rsplit('_', 1)[1],
                        'side': side, 'ref': ref.isoformat(), 'start': start.isoformat(), 'end': end.isoformat(),
                        'gridKm': round(near['distance'], 2), 'dxM': round(g('DxInMetres')),
                        'value': eccodes.codes_get_double_element(h, 'values', near['index']),
                    })
                finally:
                    eccodes.codes_release(h)
    return out


def hours(iso_dur: str) -> int:
    m = re.fullmatch(r'P(?:(\d+)D)?T?(?:(\d+)H)?', iso_dur)
    return int(m[1] or 0) * 24 + int(m[2] or 0)


def api_series(prop: dict) -> tuple[dict, dict]:
    """The API's values by hour, and by (start, length in hours)."""
    hourly, ranged = {}, {}
    for v in prop['values']:
        t, d = v['validTime'].split('/')
        t0 = dt.datetime.fromisoformat(t).replace(tzinfo=None)
        ranged[(t0, hours(d))] = v['value']
        for i in range(hours(d)):
            hourly[t0 + dt.timedelta(hours=i)] = v['value']
    return hourly, ranged


def compare(rows: list[dict], prop: dict, el: str) -> str:
    hourly, ranged = api_series(prop)
    _, see_n, see_a = ELEMENTS[el]
    same, differ, missing, odd, no_api = 0, [], 0, 0, 0
    for r in rows:
        start, end = dt.datetime.fromisoformat(r['start']), dt.datetime.fromisoformat(r['end'])
        n = r['value']
        if n < 0:
            missing += 1
            continue
        if el == 'qpf':
            if start.minute or start.hour % 6 or end - start != dt.timedelta(hours=6):
                odd += 1
                continue
            a = ranged.get((start, 6))
            ok = a is not None and abs(a - n) < 0.01
        elif el == 'pop12':
            if start.minute or start.hour % 12 or end - start != dt.timedelta(hours=12):
                odd += 1
                continue
            inside = [hourly.get(start + dt.timedelta(hours=i)) for i in range(12)]
            inside = [x for x in inside if x is not None]
            a = max(inside) if inside else None
            ok = a == n
        else:
            a = hourly.get(end)
            if a is not None:
                n, a = see_n(n), see_a(a)
                ok = abs(n - a) < 1e-9
        if a is None:
            no_api += 1
        elif ok:
            same += 1
        else:
            differ.append(f"{start:%d/%H} {n:g} vs {a:g}")
    extra = ', '.join(f'{what} {count}' for what, count in
                      (('missing', missing), ('not a standard period', odd), ('no API value', no_api)) if count)
    return (f'same {same:2}, differ {len(differ):2}' + (f', {extra}' if extra else '')
            + (f"  ({'; '.join(differ[:4])})" if differ else ''))


def label(row: dict) -> str:
    return f"{row['el']:5} {row['header']} {row['issued']} {row.get('side', ''):6}"


def again(path: str) -> None:
    """Print a saved run's comparison again, by the rules above."""
    with gzip.open(path, 'rt') as f:
        grid = json.loads(f.readline())['properties']
        files: dict[tuple, list[dict]] = {}
        for line in f:
            r = json.loads(line)
            files.setdefault((r['el'], r['header'], r['issued']), []).append(r)
    print('updateTime', grid['updateTime'])
    for (el, _, _), rows in files.items():
        print(f'{label(rows[0])}  {compare(rows, grid[ELEMENTS[el][0]], el)}')


def main() -> None:
    if sys.argv[1] == '--from':
        return again(sys.argv[2])
    out_path = sys.argv[1]
    point = json.loads(get(f'https://api.weather.gov/points/{DZ_LAT},{DZ_LON}'))['properties']
    grid = json.loads(get(point['forecastGridData']))['properties']
    update = dt.datetime.fromisoformat(grid['updateTime']).astimezone(dt.timezone.utc).replace(tzinfo=None)
    print(point['forecastGridData'], 'updateTime', grid['updateTime'])
    failed = []
    with gzip.open(out_path, 'wt') as out:
        out.write(json.dumps({'gridpoint': point['forecastGridData'], 'properties': grid}) + '\n')
        for el, (prop, _, _) in ELEMENTS.items():
            for key, side in chosen(el, update):
                try:
                    rows = decode(key, el, side)
                except Exception as e:  # keep what came back; say what did not
                    failed.append(key)
                    print(f'{el:5} {key.rsplit("/", 1)[1]}  not read: {e.__class__.__name__}: {e}')
                    continue
                for r in rows:
                    out.write(json.dumps(r) + '\n')
                out.flush()
                if rows:
                    print(f'{label(rows[0])}  {compare(rows, grid[prop], el)}')
    if failed:
        sys.exit(f'{len(failed)} file(s) not read')


if __name__ == '__main__':
    main()
