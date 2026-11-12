/**
 * The NWS National Blend of Models' station bulletins, as the relay cuts
 * them for KPMV (relay/src/nbm.ts), read into hours: the hourly NBH, and
 * since 2026-11-12 the three-hourly NBS (6 to 72 hours ahead, the bulletin
 * usairnet's three-day table reads, docs/usairnet-parity.md, "Why
 * usairnet's ceiling runs further out"). The NBS has the same rows in the
 * same three-character fields, plus `DT` (the dates) and `FHR` (hours from
 * the cycle), which date its columns here; the NBH has no `FHR`, so its
 * hours are dated by the `UTC` row's roll past 23Z.
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
import type { NbmForecast, NbmHour, NbmProduct } from './types';

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
export const parseNbhBlock = (text: string): NbmForecast | null => parseNbmBlock(text, 'NBH');

/** The same for an NBS block: three-hourly columns, dated by its `FHR`
 *  row. Strict about the product, as the NBH parser is: the relay's two
 *  paths serve one each, and a block of the other would date wrongly. */
export const parseNbsBlock = (text: string): NbmForecast | null => parseNbmBlock(text, 'NBS');

export function parseNbmBlock(text: string, product: NbmProduct): NbmForecast | null {
  const lines = text.split('\n').map((l) => l.replace(/\r$/, ''));
  // The version token ("V5.0") is optional: the bucket's header carried it
  // through the 2026-11-03 11Z cycle and not from the 12Z one on ("NBM  NBH
  // GUIDANCE"), and a pattern that required it parsed nothing for twelve
  // hours (docs/nbm-lowest-cloud-base.md, "The header lost its version").
  const head = new RegExp(
    `^ (\\S+)\\s+NBM(?: V(\\S+))?\\s+${product} GUIDANCE\\s+(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})\\s+(\\d{2})(\\d{2}) UTC`,
  ).exec(lines[0] ?? '');
  if (!head) return null;
  const station = head[1];
  const cycleHour = Number(head[6]);
  const cycleMs = Date.UTC(Number(head[5]), Number(head[3]) - 1, Number(head[4]), cycleHour, Number(head[7]));
  const rows = new Map<string, string[]>();
  for (const line of lines.slice(1)) {
    // Another station's header ends this block: text cut loosely would
    // otherwise hand the next station's rows to this one.
    if (/^ \S+\s+NBM(?: V\S+)?\s+NB[A-Z] GUIDANCE/.test(line)) break;
    const label = line.slice(1, LABEL).trim();
    if (label) rows.set(label, fields(line));
  }
  const utc = rows.get('UTC');
  if (!utc) return null;
  // The NBS says how far each column is from the cycle (" FHR  05 08 11
  // …"), which dates it outright; the `DT` row above names the days but
  // only at each change. The NBH has no such row.
  const fhr = rows.get('FHR');
  const hours: NbmHour[] = [];
  let day = 0;
  // The hours run on from the cycle's own, so one not after the last is
  // the next day's: the 23Z cycle's first hour, 00, is the next day's at
  // once (the key: "date as in line 1, unless past 23Z"). Starting from -1
  // instead dated the 23Z bulletin's every hour a day early (found in
  // review, 2026-10-27).
  let prev = cycleHour;
  utc.forEach((f, i) => {
    const hh = Number(f);
    if (!Number.isFinite(hh) || f.trim() === '') return;
    if (hh <= prev) day += 1;
    prev = hh;
    const ahead = fhr == null ? NaN : Number(fhr[i]);
    const time = Number.isFinite(ahead)
      ? cycleMs + ahead * 3_600_000
      : Date.UTC(Number(head[5]), Number(head[3]) - 1, Number(head[4]) + day, hh);
    hours.push({
      time,
      lowestBaseFtAgl: hundredsFt(rows.get('LCB')?.[i]),
      ceilingFtAgl: hundredsFt(rows.get('CIG')?.[i]),
      skyCoverPct: percent(rows.get('SKY')?.[i]),
    });
  });
  // The step from the columns themselves, so a bulletin spaced otherwise
  // is read as it is; the NBH's is 1, the NBS's 3.
  const stepHours = hours.length > 1 ? Math.round((hours[1].time - hours[0].time) / 3_600_000) : product === 'NBS' ? 3 : 1;
  return { station, product, stepHours, version: head[2] ?? null, cycleMs, hours };
}
