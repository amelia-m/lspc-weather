import { describe, expect, it } from 'vitest';
import { mergeArchiveLines, unarchivedLines } from '../src/domain/paritySummary';

const line = (kind: string, at: string, extra = '') => `@@parity {"kind":"${kind}","at":"${at}"${extra}}`;

describe('unarchivedLines', () => {
  it('keeps the records no archive holds, one per record, oldest first', () => {
    const fresh = [
      'vitest noise',
      `2026-10-19T08:46:01Z ${line('usairnet', '2026-10-19T08:46:00Z')}`,
      line('schulze', '2026-10-19T06:04:00Z'),
      line('schulze', '2026-10-18T23:52:00Z'),
      // The same run uploaded twice (a re-run) counts once.
      line('schulze', '2026-10-19T06:04:00Z', ',"x":1'),
    ].join('\n');
    const archived = line('schulze', '2026-10-18T23:52:00Z');
    expect(unarchivedLines(fresh, archived)).toEqual([
      line('schulze', '2026-10-19T06:04:00Z'),
      line('usairnet', '2026-10-19T08:46:00Z'),
    ]);
  });

  it('tells records apart by kind as well as time', () => {
    const at = '2026-10-19T06:04:00Z';
    expect(unarchivedLines(line('usairnet', at), line('schulze', at))).toEqual([line('usairnet', at)]);
  });

  it('leaves out what the summary would skip', () => {
    expect(unarchivedLines(['@@parity {not json', line('other', '2026-10-19T06:04:00Z')].join('\n'), '')).toEqual([]);
  });
});

describe('mergeArchiveLines', () => {
  it('merges a later run’s lines into an existing archive by run time', () => {
    const existing = [line('usairnet', '2026-10-05T20:51:00Z'), line('schulze', '2026-10-19T16:32:00Z')].join('\n') + '\n';
    expect(mergeArchiveLines(existing, [line('usairnet', '2026-10-15T08:13:00Z')])).toEqual([
      line('usairnet', '2026-10-05T20:51:00Z'),
      line('usairnet', '2026-10-15T08:13:00Z'),
      line('schulze', '2026-10-19T16:32:00Z'),
    ]);
  });
});
