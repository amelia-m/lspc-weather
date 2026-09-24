/**
 * Live winds-aloft comparison against Mark Schulze's Winds Aloft.
 *
 * Runs with the other live checks (`npx vitest run --config
 * vitest.live.config.ts`, daily by .github/workflows/sky-parity.yml) and by
 * hand from the sandbox with the proxy env (see CLAUDE.md). Never by
 * `npm test`: it needs the network.
 *
 * Why it exists: on 2026-09-23 the two tables — both Open-Meteo for the same
 * coordinates — were 38° apart at 6,000 ft because this app sampled six
 * pressure levels to the tool's twenty and drew a straight line across a
 * 5,300 ft gap (docs/markschulze-altitude-reference.md has the table). The app
 * now asks for the intermediate levels; this prints the two profiles side by
 * side at the SAME valid hour so a re-check is one command rather than an
 * afternoon.
 *
 * It is a report, not a gate. It never fails the run: a disagreement is
 * something to read, not a broken parser, and the tool's endpoint is a
 * scrape-shaped dependency (referer-checked, User-Agent-checked) that must not
 * be able to fail the sky-parity workflow it runs beside. Only the table is
 * printed, so a person judges it.
 */
import { it } from 'vitest';
import { SITE, WINDS_ALOFT_LEVELS_AGL } from '../src/config/site';
import {
  coerceOpenMeteoTimes,
  normalizeOpenMeteo,
  openMeteoWindsUrl,
  type RawOpenMeteo,
} from '../src/domain/normalize';
import { interpolateWindsAloft } from '../src/domain/windsAloft';

interface Schulze {
  validtime: string;
  altFtRaw: number[];
  directionRaw: Record<string, number>;
  speedRaw: Record<string, number>;
  direction: Record<string, number>;
  speed: Record<string, number>;
  temp: Record<string, number>;
  groundElev: number;
  groundDir: number;
  groundSpd: number;
}

/** The tool's own endpoint, as its page calls it. `hourOffset` counts hours
 *  from the hour in progress; the site refuses a bare request. */
async function schulze(hourOffset: number): Promise<Schulze | null> {
  const dz = SITE.dz;
  const url =
    `https://www.markschulze.net/winds/winds_openmeteo.php?lat=${dz.lat}&lon=${dz.lon}` +
    `&hourOffset=${hourOffset}&referrer=MSWA2024`;
  try {
    const res = await fetch(url, {
      headers: { Referer: 'https://www.markschulze.net/winds/', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.trimStart().startsWith('{') ? (JSON.parse(text) as Schulze) : null;
  } catch {
    return null;
  }
}

const say = (lines: string[]): void => {
  process.stdout.write(lines.join('\n') + '\n');
};

/** One machine-readable line per run, for the parity-summary workflow
 *  (domain/paritySummary.ts parses it). Printed last, after the table. */
const record = (obj: Record<string, unknown>): string => `@@parity ${JSON.stringify(obj)}`;

it('prints this app’s winds-aloft profile beside Mark Schulze’s at the same valid hour', async () => {
  const dz = SITE.dz;
  const now = Date.now();
  const out: string[] = ['', '=== Winds aloft vs Mark Schulze ==='];

  // The app's own request and normaliser, with a plain fetch in place of the
  // app's (which would read the fixture under vitest's DEV flag).
  let raw: RawOpenMeteo;
  try {
    const res = await fetch(openMeteoWindsUrl(dz.lat, dz.lon), { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = (await res.json()) as RawOpenMeteo;
  } catch (e) {
    say([...out, `Open-Meteo could not be read: ${(e as Error).message}`, record({ kind: 'schulze', at: new Date(now).toISOString(), error: `open-meteo: ${(e as Error).message}` })]);
    return;
  }
  const { samples, validMs } = normalizeOpenMeteo(coerceOpenMeteoTimes(raw), now);
  const levels = interpolateWindsAloft(samples, dz.elevationFt, WINDS_ALOFT_LEVELS_AGL);
  if (validMs == null || levels.length === 0) {
    say([...out, 'Open-Meteo answered with no usable hour.', record({ kind: 'schulze', at: new Date(now).toISOString(), error: 'open-meteo: no usable hour' })]);
    return;
  }
  const appHour = new Date(validMs).getUTCHours();

  // The app snaps to the nearest hour; the tool's offset 0 is the hour in
  // progress. Fetch both candidates and use the one that matches.
  const [m0, m1] = await Promise.all([schulze(0), schulze(1)]);
  const ms = [m0, m1].find((m) => m != null && Number(m.validtime) === appHour) ?? null;
  out.push(
    `app valid ${new Date(validMs).toISOString()} (now ${new Date(now).toISOString()});` +
      ` Schulze offsets 0→${m0?.validtime ?? 'unreachable'}Z 1→${m1?.validtime ?? 'unreachable'}Z`,
  );
  // What a jumper comparing the two right now would see, before any hour
  // alignment: Schulze's page shows the hour in progress (offset 0) and this
  // card the nearest hour, so in the second half of every hour the two show
  // different forecasts. Reported as its own line so the log can say how
  // large that difference is at this minute, separately from the data
  // question below.
  const appHourLabel = `${String(appHour).padStart(2, '0')}Z`;
  let unaligned: { hoursDiffer: boolean; maxDir: number | null } | undefined;
  if (m0 != null && Number(m0.validtime) !== appHour) {
    let worst = 0;
    for (const l of levels) {
      const k = String(l.altitudeFtAgl);
      if (!(k in m0.direction)) continue;
      worst = Math.max(worst, Math.abs(((l.directionDeg - m0.direction[k] + 540) % 360) - 180));
    }
    out.push(
      `unaligned at this minute: Schulze's page shows ${m0.validtime}Z, this card ${appHourLabel};` +
        ` largest row difference between those two tables ${worst}°`,
    );
    unaligned = { hoursDiffer: true, maxDir: worst };
  } else if (m0 != null) {
    out.push(`unaligned at this minute: both show ${m0.validtime}Z`);
    unaligned = { hoursDiffer: false, maxDir: null };
  }
  const base = {
    kind: 'schulze',
    at: new Date(now).toISOString(),
    appHour: appHourLabel,
    pageHour: m0 ? `${m0.validtime}Z` : null,
    unaligned,
  };
  if (ms == null) {
    say([...out, 'No Schulze table for the same hour; nothing compared.', record({ ...base, aligned: null })]);
    return;
  }

  // The ground rows side by side, with ours in km/h as well: over four
  // readings his ground speed has run close to twice ours in knots, which is
  // what a km/h figure read as knots would give. Logged so the summary can
  // say whether that holds (docs/markschulze-altitude-reference.md).
  const surface = samples.find((x) => x.isSurface) ?? null;
  const ourKt = surface ? Math.round(surface.speedKt * 10) / 10 : null;
  out.push(
    `ground row: this dashboard ${surface ? `${surface.directionDeg}° / ${ourKt} kt (${Math.round(surface.speedKt * 1.852 * 10) / 10} km/h)` : '—'}` +
      ` · Schulze's groundDir/groundSpd ${ms.groundDir}° / ${ms.groundSpd} kt`,
  );

  // Raw profiles at a shared height: the stale-run signal. Pair each of his
  // raw levels with our nearest raw sample within 150 ft; a pair more than 5°
  // or 2 kt apart means the two were served different forecasts.
  let rawMismatch: boolean | null = null;
  {
    let pairs = 0;
    let bad = 0;
    for (const a of ms.altFtRaw) {
      if (a < 0 || a > 14_000) continue;
      const mine = samples
        .map((x) => ({ x, d: Math.abs(x.heightFtMsl - dz.elevationFt - a) }))
        .filter((p) => p.d <= 150)
        .sort((p, q) => p.d - q.d)[0];
      if (!mine) continue;
      pairs += 1;
      const dDir = Math.abs(((mine.x.directionDeg - ms.directionRaw[a] + 540) % 360) - 180);
      const dSpd = Math.abs(mine.x.speedKt - ms.speedRaw[a]);
      if (dDir > 5 || dSpd > 2) bad += 1;
    }
    if (pairs >= 3) rawMismatch = bad >= 2;
  }

  // Both raw profiles, so a run-boundary case — one tool served a newer
  // forecast than the other for the same hour — is visible as the raw
  // samples disagreeing, not just the interpolated rows.
  out.push(
    'app raw samples (ft AGL: dir/kt): ' +
      samples
        .map((x) => `${Math.round(x.heightFtMsl - dz.elevationFt)}: ${x.directionDeg}/${x.speedKt}`)
        .join('  '),
  );
  out.push(
    'Schulze raw levels (ft AGL: dir/kt): ' +
      ms.altFtRaw
        .filter((a) => a <= 14_000)
        .map((a) => `${a}: ${ms.directionRaw[a]}/${ms.speedRaw[a]}`)
        .join('  '),
  );
  out.push('ft AGL   app dir/kt/°C   Schulze dir/kt/°C   Δdir  Δkt  Δ°C');
  let maxDir = 0;
  let maxSpd = 0;
  const rows: { ft: number; dDir: number; dSpd: number; dT: number | null }[] = [];
  for (const l of levels) {
    const k = String(l.altitudeFtAgl);
    if (!(k in ms.direction)) continue;
    const dDir = ((l.directionDeg - ms.direction[k] + 540) % 360) - 180;
    const dSpd = l.speedKt - ms.speed[k];
    const dT = l.tempC != null ? l.tempC - ms.temp[k] : null;
    rows.push({ ft: l.altitudeFtAgl, dDir, dSpd, dT });
    maxDir = Math.max(maxDir, Math.abs(dDir));
    maxSpd = Math.max(maxSpd, Math.abs(dSpd));
    out.push(
      `${k.padStart(6)}   ${`${l.directionDeg}/${l.speedKt}/${l.tempC ?? '-'}`.padEnd(15)} ` +
        `${`${ms.direction[k]}/${ms.speed[k]}/${ms.temp[k]}`.padEnd(19)} ` +
        `${String(dDir).padStart(4)} ${String(dSpd).padStart(4)}  ${dT == null ? '-' : dT.toFixed(0)}`,
    );
  }
  out.push(`largest difference: ${maxDir}° direction, ${maxSpd} kt speed`);
  out.push(record({ ...base, aligned: { rows }, rawMismatch, ground: { ourKt, theirKt: ms.groundSpd } }));
  say(out);
});
