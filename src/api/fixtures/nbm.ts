/** KPMV's NBH block of 2026-10-24 03Z (data/parity/nbm-kpmv-2026-10-24-03z.txt),
 *  re-dated to the hour before `now` so the fixture's hours overlap the
 *  card's strip, as the gridpoint fixture is anchored to the current hour.
 *  The figures are that night's. */
const BLOCK = `  KPMV   NBM V5.0 NBH GUIDANCE    10/24/2026  0300 UTC
 UTC  04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20 21 22 23 00 01 02 03 04 
 TMP  67 66 65 64 63 63 62 62 61 61 62 66 70 73 76 77 79 79 78 75 70 66 64 62 61
 SKY  44 55 62 57 69 64 68 72 51 36 35 27 19 26 26 34 55 63 66 62 62 80 71 76 93
 WDR  16 17 17 17 17 17 17 17 17 17 18 18 19 19 20 20 21 21 23 35 35 36  0 36 35
 WSP  10 10  9  9  9  9  9  9  9  9  9  9  9  8  8  7  6  5  4  2  3  4  5  5  5
 GST  20 19 18 17 17 17 17 17 17 17 16 15 15 15 14 13 12 11  9  6  6  7  9 10  8
 CIG -88-88140130130180170160-88-88-88-88-88-88-88-88-88130130210240220220210200
 LCB 200200140120130170160150140140120110100 80 60 50 60 60 90130150140140150150
 VIS 100100100100100100100100100100100100100100100100100100100100100100100100100`.replace(/^ {2}/, ' ');

export function nbhFixtureText(now: number): string {
  const cycle = new Date(Math.floor(now / 3_600_000) * 3_600_000 - 3_600_000);
  const mm = String(cycle.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(cycle.getUTCDate()).padStart(2, '0');
  const hh = String(cycle.getUTCHours()).padStart(2, '0');
  const utc = Array.from({ length: 25 }, (_, i) => String((cycle.getUTCHours() + 1 + i) % 24).padStart(2, '0')).join(' ');
  return BLOCK.replace(/10\/24\/2026 {2}0300 UTC/, `${mm}/${dd}/${cycle.getUTCFullYear()}  ${hh}00 UTC`).replace(
    /^ UTC .*$/m,
    ` UTC  ${utc} `,
  );
}
