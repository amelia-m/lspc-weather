/**
 * The NWS National Blend of Models' hourly station bulletin (NBH), as the
 * relay cuts it for KPMV (relay/src/nbm.ts), read into hours.
 *
 * What the rows mean is MDL's "NBM v5.0 Text Bulletin Card"
 * (vlab.noaa.gov/web/mdl/nbm-textcard-v5.0, read 2026-10-26; the hourly
 * card's key is data/parity/nbm-textcard-v5.0-key-2026-10-26.txt):
 * `CIG` is "ceiling height, 100s feet (>5000 ft reported to the nearest
 * 1000 ft; -88=unlimited)", `LCB` "lowest cloud base, 100s feet" on the
 * same terms, `SKY` "sky cover, percent", and -99 missing. MDL's elements
 * page defines the base as "Lowest cloud base whether or not a ceiling is
 * present (could be FEW or SCT layer)", "a 50/50 blend of model diagnostic
 * cloud information and RH derived clouds". The first line is station,
 * bulletin, forecast date and cycle; the `UTC` line the valid hours, "date
 * as in line 1, unless past 23Z - then the following date is valid".
 *
 * The card shows the base; the ceiling and sky are read too, so the block
 * can be set against the NWS gridpoint's later. Values print right-aligned
 * in three-character fields after a four-character label, so a row is cut
 * by position, not by spaces: "-88-88140" is three fields.
 *
 * Pure: text in, hours out. Nothing here raises a flag: no published limit
 * applies to a lowest cloud base, and the card prints it plainly.
 */
import type { NbmForecast, NbmHour } from './types';

const FIELD = 3;
/** A row is " CIG -88-88140…": a space, the three-letter label, a space,
 *  then the three-character fields. The UTC row is the same shape. */
const LABEL = 5;

/** A row's fields by position, the label stripped. */
function fields(line: string): string[] {
  const out: string[] = [];
  for (let i = LABEL; i < line.length; i += FIELD) out.push(line.slice(i, i + FIELD));
  return out;
}

/** A field in hundreds of feet: a height, `null` for -88 (unlimited: no
 *  layer, no ceiling), and `undefined` for -99 or a blank (not given). */
function hundredsFt(field: string | undefined): number | null | undefined {
  if (field == null || field.trim() === '' || field.trim() === '-99') return undefined;
  if (field.trim() === '-88') return null;
  const n = Number(field);
  return Number.isFinite(n) ? n * 100 : undefined;
}

function percent(field: string | undefined): number | null {
  const n = field == null ? NaN : Number(field);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** The hours of one station's NBH block. Null when the text is not one:
 *  no header, or no UTC row. A row the block lacks leaves its figures
 *  undefined for every hour; the key says such a row is not printed when
 *  its data are missing for every hour. */
export function parseNbhBlock(text: string): NbmForecast | null {
  const lines = text.split('\n').map((l) => l.replace(/\r$/, ''));
  const head = /^ (\S+)\s+NBM V(\S+) NBH GUIDANCE\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{2})(\d{2}) UTC/.exec(lines[0] ?? '');
  if (!head) return null;
  const station = head[1];
  const issuedMs = Date.UTC(Number(head[5]), Number(head[3]) - 1, Number(head[4]), Number(head[6]), Number(head[7]));
  const rows = new Map<string, string[]>();
  for (const line of lines.slice(1)) {
    const label = line.slice(1, LABEL).trim();
    if (label) rows.set(label, fields(line));
  }
  const utc = rows.get('UTC');
  if (!utc) return null;
  const hours: NbmHour[] = [];
  let day = 0;
  let prev = -1;
  utc.forEach((f, i) => {
    const hh = Number(f);
    if (!Number.isFinite(hh) || f.trim() === '') return;
    // The hours run on from the cycle; a smaller one than the last is the
    // next day's.
    if (hh < prev) day += 1;
    prev = hh;
    const time = Date.UTC(Number(head[5]), Number(head[3]) - 1, Number(head[4]) + day, hh);
    hours.push({
      time,
      lowestBaseFtAgl: hundredsFt(rows.get('LCB')?.[i]),
      ceilingFtAgl: hundredsFt(rows.get('CIG')?.[i]),
      skyCoverPct: percent(rows.get('SKY')?.[i]),
    });
  });
  return { station, version: head[2], issuedMs, hours };
}
