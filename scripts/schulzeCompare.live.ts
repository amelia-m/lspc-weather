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
    say([...out, `Open-Meteo could not be read: ${(e as Error).message}`]);
    return;
  }
  const { samples, validMs } = normalizeOpenMeteo(coerceOpenMeteoTimes(raw), now);
  const levels = interpolateWindsAloft(samples, dz.elevationFt, WINDS_ALOFT_LEVELS_AGL);
  if (validMs == null || levels.length === 0) {
    say([...out, 'Open-Meteo answered with no usable hour.']);
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
  if (ms == null) {
    say([...out, 'No Schulze table for the same hour; nothing compared.']);
    return;
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
  for (const l of levels) {
    const k = String(l.altitudeFtAgl);
    if (!(k in ms.direction)) continue;
    const dDir = ((l.directionDeg - ms.direction[k] + 540) % 360) - 180;
    const dSpd = l.speedKt - ms.speed[k];
    const dT = l.tempC != null ? l.tempC - ms.temp[k] : null;
    maxDir = Math.max(maxDir, Math.abs(dDir));
    maxSpd = Math.max(maxSpd, Math.abs(dSpd));
    out.push(
      `${k.padStart(6)}   ${`${l.directionDeg}/${l.speedKt}/${l.tempC ?? '-'}`.padEnd(15)} ` +
        `${`${ms.direction[k]}/${ms.speed[k]}/${ms.temp[k]}`.padEnd(19)} ` +
        `${String(dDir).padStart(4)} ${String(dSpd).padStart(4)}  ${dT == null ? '-' : dT.toFixed(0)}`,
    );
  }
  out.push(`largest difference: ${maxDir}° direction, ${maxSpd} kt speed`);
  say(out);
});
