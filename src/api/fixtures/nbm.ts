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

/** KPMV's NBS block of 2026-11-12 01Z (data/parity/nbm-kpmv-nbs-2026-11-12-01z.txt),
 *  re-dated to the hour before `now` as the NBH fixture is: the `FHR` row
 *  dates its columns, so only the header's cycle moves and the `UTC` row
 *  is recomputed from it. The figures are that day's. */
const NBS_BLOCK = ` KPMV    NBM  NBS GUIDANCE    11/12/2026  0100 UTC
 DT /NOV  12            /NOV  13                /NOV  14                / 
 UTC  06 09 12 15 18 21 00 03 06 09 12 15 18 21 00 03 06 09 12 15 18 21 00 
 FHR  05 08 11 14 17 20 23 26 29 32 35 38 41 44 47 50 53 56 59 62 65 68 71 
 TXN                    46          27          44          22          45
 XND                     2           5           2           6           2
 TMP  45 42 39 39 44 46 41 36 32 29 27 31 41 44 36 30 27 25 23 29 42 45 39
 TSD   2  2  2  2  1  2  1  2  3  4  5  4  2  2  2  4  4  5  6  6  2  2  3
 DPT  39 36 32 30 27 25 25 25 25 25 24 24 22 21 21 21 21 20 20 22 23 22 23
 DSD   1  2  3  2  2  2  2  2  2  3  3  3  2  3  3  3  3  4  5  4  3  3  4
 WBG  43 40 36 37 42 41 36 34 30 29 28 30 40 39 32 29 28 26 26 27 39 40 35
 SKY  22 26 45 62 26 20 14 14 22 33 46 37 18  3  2  8 10 24 26 29 23 39 48
 SSD  36 38 37 28 31 21 19 25 29 33 37 35 27  3  3 23 19 29 33 38 34 36 37
 WDR  33 35 36  1  1  0  0 36 35 35 36  1  1  3  6 10 12 14 14 15 15 14 13
 WSP   5  6  7  8  8  7  4  3  0  2  2  0  2  2  0  0  0  0  0  3  6  6  5
 WSD   1  1  1  1  1  1  1  2  2  2  2  2  2  2  1  1  1  2  2  2  2  2  2
 GST   9 11 12 14 14 13  7  6  4  4  5  5  6  6  3  3  3  3  4  7 11 12  9
 GSD   2  3  3  2  2  2  2  2  2  2  2  2  2  2  1  2  2  2  2  3  3  2  3
 P06         0     0     0     0     0     0     0     0     0     0     0
 P12                     0           0           0           0           0
 Q06         0     0     0     0     0     0     0     0     0     0     0
 Q12                     0           0           0           0           0
 DUR                     0           0           0           0           0
 T03   0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0
 T06         0     0     0     0     0     0     0     0     0     0     0
 T12                     0           0           0           0           0
 PZR   0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0
 PSN   0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0
 PPL   0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0
 PRA   0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0
 S06         0     0     0     0     0     0     0     0     0     0     0
 SLV  52 48 27 16 18 20 17 11  7  2  1  0  7 14  8  6  2  2  1  5 12 19 22
 I06         0     0     0     0     0     0     0     0     0     0     0
 CIG -88-88-88 35-88-88-88-88-88-88-88-88-88-88-88-88-88-88-88-88-88-88-88
 IFC   1  0  0  4  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0
 LCB 160 60 20 24 37 31 30 29 22 22 14 80-88-88-88-88-88-88-88260-88260260
 VIS 100100100100100100100100100100100100100100100100100100100100100100100
 IFV   0  0  0  0  0  0  0  0  0  3  5  1  0  0  0  0  2  3  5  0  0  0  0
 MHT   5  6  7 27 38 41 15 21 30 25 21 22 35 33  6  5  4  4  4  8 25 26  5
 TWD  34  0 36  1  1  1  1  1 36 35 36  1  1  1  5  7 11 14 15 16 17 15 14
 TWS   9 11 12 18 15 13 10 10  9  8  9  9  9  7  7  7  7  7  7 10 11 11  9
 SOL   0  0  0 13 42 31  3  0  0  0  0 20 46 34  4  0  0  0  0 16 40 35 12`;

export function nbsFixtureText(now: number): string {
  const cycle = new Date(Math.floor(now / 3_600_000) * 3_600_000 - 3_600_000);
  const mm = String(cycle.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(cycle.getUTCDate()).padStart(2, '0');
  const hh = String(cycle.getUTCHours()).padStart(2, '0');
  const fhr = (/^ FHR .*$/m.exec(NBS_BLOCK)?.[0] ?? '').slice(5).match(/.{1,3}/g) ?? [];
  const utc = fhr.map((f) => String((cycle.getUTCHours() + Number(f)) % 24).padStart(2, '0')).join(' ');
  return NBS_BLOCK.replace(/11\/12\/2026 {2}0100 UTC/, `${mm}/${dd}/${cycle.getUTCFullYear()}  ${hh}00 UTC`).replace(
    /^ UTC .*$/m,
    ` UTC  ${utc} `,
  );
}
