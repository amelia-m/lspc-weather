import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  answerKey,
  countAnswered,
  earlierAnswers,
  emptyAnswers,
  formatAnswers,
  issueUrl,
  questionKey,
  sanitizeAnswers,
  type Answers,
} from '../src/domain/citationAnswers';
import { clearAnswers, loadAnswers, saveAnswers } from '../src/api/citationAnswers';
import type { ChecklistEntry } from '../src/config/citationsChecklist';
import { CHECKLIST } from '../src/config/citationsChecklist';
import { CITATIONS, VISIBILITY_ROW } from '../src/config/thresholds';

const REPO = 'https://github.com/amelia-m/lspc-weather';

const entry = (id: string, asks: string[]): ChecklistEntry => ({
  id,
  title: `Entry ${id}`,
  claim: 'claim',
  where: 'somewhere',
  sources: [CITATIONS.far10517],
  asks,
});
const checklist = [entry('A1', ['First question?', 'Second question?']), entry('A2', ['Only question?'])];

describe('formatAnswers', () => {
  it('reports only what was answered, with the question text repeated', () => {
    const answers: Answers = {
      reviewer: 'J. Doe, S&TA',
      date: '2026-09-27',
      claims: { A1: 'wrong-section' },
      questions: {
        [questionKey('A1', 1)]: { answer: 'no', note: 'nobody here jumps one' },
        [questionKey('A2', 0)]: { note: 'ask the DZO' },
      },
    };
    const text = formatAnswers(answers, checklist);
    expect(text).toContain('Citations review by J. Doe, S&TA, 2026-09-27.');
    expect(text).toContain('### A1 · Entry A1');
    expect(text).toContain('Verdict: Wrong section');
    // Q1 was not answered and is not reported; Q2 carries its answer and note.
    expect(text).not.toContain('First question?');
    expect(text).toContain('- Q2: No — nobody here jumps one');
    expect(text).toContain('> Second question?');
    // A note with no choice still counts as an answer, and says so.
    expect(text).toContain('### A2 · Entry A2');
    expect(text).toContain('Verdict: (not given)');
    expect(text).toContain('- Q1: (no answer) — ask the DZO');
  });

  it('says so when nothing has been answered', () => {
    expect(formatAnswers(emptyAnswers(), checklist)).toContain('(no answers yet)');
    expect(formatAnswers(emptyAnswers(), checklist)).toContain('unnamed reviewer, undated');
  });
});

describe('issueUrl', () => {
  it('prefills a new-issue link with title and body', () => {
    const answers: Answers = { ...emptyAnswers(), reviewer: 'J', date: '2026-09-27', claims: { A1: 'correct' } };
    const url = issueUrl(REPO, answers, checklist);
    expect(url).not.toBeNull();
    expect(url).toMatch(/^https:\/\/github\.com\/amelia-m\/lspc-weather\/issues\/new\?title=/);
    expect(decodeURIComponent(url!)).toContain('Verdict: Correct');
  });

  it('refuses rather than truncates once the link would exceed what GitHub keeps', () => {
    // GitHub silently drops the body past roughly 8 KB of URL; a review with
    // long notes must fall back to copy-and-paste, not lose its notes.
    const answers: Answers = {
      ...emptyAnswers(),
      questions: { [questionKey('A1', 0)]: { note: 'x'.repeat(7000) } },
    };
    expect(issueUrl(REPO, answers, checklist)).toBeNull();
  });
});

describe('countAnswered', () => {
  it('counts one verdict per entry and one answer per question', () => {
    expect(countAnswered(emptyAnswers(), checklist)).toEqual({ answered: 0, total: 5 });
    const some: Answers = {
      ...emptyAnswers(),
      claims: { A2: 'correct' },
      questions: { [questionKey('A1', 0)]: { answer: 'yes' }, [questionKey('A1', 1)]: { note: ' ' } },
    };
    // A whitespace-only note is not an answer.
    expect(countAnswered(some, checklist)).toEqual({ answered: 2, total: 5 });
  });

  it('matches the real checklist: every entry has a verdict slot and at least one question', () => {
    const { total } = countAnswered(emptyAnswers(), CHECKLIST);
    const asks = CHECKLIST.reduce((n, e) => n + e.asks.length, 0);
    expect(total).toBe(CHECKLIST.length + asks);
    expect(CHECKLIST.every((e) => e.asks.length > 0)).toBe(true);
  });
});

/* An entry whose wording follows a setting (A8, with VISIBILITY_ROW) has a
 * key per wording: a verdict on the 3 SM question must not be shown, counted
 * or sent as one on the 5 SM question, nor dropped unseen when the row moves,
 * in either direction. */
describe('answerKey', () => {
  const moved: ChecklistEntry = {
    ...entry('A1', ['New question?']),
    value: 'New figure',
    answerKey: 'A1@new',
    otherWordings: [{ answerKey: 'A1', value: 'Old figure' }],
  };
  const old: Answers = {
    ...emptyAnswers(),
    claims: { A1: 'correct' },
    questions: { [questionKey('A1', 0)]: { answer: 'yes' } },
  };

  it('counts answers given to the old wording as none, and reports them under its figure', () => {
    expect(countAnswered(old, [moved])).toEqual({ answered: 0, total: 2 });
    expect(earlierAnswers(old, moved)).toEqual([
      { value: 'Old figure', verdict: 'correct', questions: [{ index: 0, response: { answer: 'yes' } }] },
    ]);
    const text = formatAnswers(old, [moved]);
    expect(text).toContain(
      'Figure: New figure\nVerdict: (not given)\nGiven to an earlier wording of this entry (Old figure):\n- Verdict: Correct\n- Q1: Yes',
    );
    // Not as an answer to the question on the page now.
    expect(text).not.toContain('New question?');
  });

  it('keeps them when the wording moves back to the entry id', () => {
    const back: ChecklistEntry = {
      ...entry('A1', ['Old question?']),
      otherWordings: [{ answerKey: 'A1@new', value: 'New figure' }],
    };
    const given: Answers = { ...emptyAnswers(), claims: { 'A1@new': 'wrong-section' } };
    expect(countAnswered(given, [back])).toEqual({ answered: 0, total: 2 });
    expect(formatAnswers(given, [back])).toContain('Given to an earlier wording of this entry (New figure):\n- Verdict: Wrong section');
  });

  it('finds no earlier answers for an entry with one wording, or none given', () => {
    expect(earlierAnswers(old, entry('A1', ['First question?']))).toEqual([]);
    expect(earlierAnswers(emptyAnswers(), moved)).toEqual([]);
  });

  it('counts and reports answers under the new key, headed by the entry id and its figure', () => {
    const now: Answers = {
      ...emptyAnswers(),
      claims: { 'A1@new': 'wrong-section' },
      questions: { [questionKey('A1@new', 0)]: { answer: 'no' } },
    };
    expect(countAnswered(now, [moved])).toEqual({ answered: 2, total: 2 });
    const text = formatAnswers(now, [moved]);
    expect(text).toContain('### A1 · Entry A1\nFigure: New figure\nVerdict: Wrong section');
    expect(text).toContain('- Q1: No');
    expect(text).not.toContain('earlier wording');
    // An entry with one wording carries no figure line.
    expect(formatAnswers({ ...emptyAnswers(), claims: { A1: 'correct' } }, [{ ...entry('A1', []), value: 'x' }])).not.toContain(
      'Figure:',
    );
  });

  it('is the id for an entry with none; A8 keeps its id on the 3 SM row and lists the other row', () => {
    expect(answerKey(entry('A2', []))).toBe('A2');
    const a8 = CHECKLIST.find((e) => e.id === 'A8')!;
    expect(answerKey(a8) === 'A8').toBe(VISIBILITY_ROW === 'below-10000-msl');
    expect(a8.otherWordings).toHaveLength(1);
    expect(a8.otherWordings![0].answerKey).not.toBe(answerKey(a8));
  });
});

describe('sanitizeAnswers', () => {
  it('keeps the shape and drops anything else', () => {
    const out = sanitizeAnswers({
      reviewer: 'J',
      date: 5,
      claims: { A1: 'correct', A2: 'maybe', A3: 7 },
      questions: {
        'A1:0': { answer: 'yes', note: 'ok' },
        'A1:1': { answer: 'perhaps' },
        'A1:2': { note: '   ' },
        'A2:0': 'no',
      },
      extra: true,
    });
    expect(out).toEqual({
      reviewer: 'J',
      date: '',
      claims: { A1: 'correct' },
      questions: { 'A1:0': { answer: 'yes', note: 'ok' } },
    });
    expect(sanitizeAnswers(null)).toEqual(emptyAnswers());
    expect(sanitizeAnswers('x')).toEqual(emptyAnswers());
  });
});

/* Vitest runs in the node environment: no localStorage unless a test installs
 * one, and the module must stay call-safe without it. */
describe('answers storage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips through localStorage and sanitizes on the way back', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    const answers: Answers = { ...emptyAnswers(), reviewer: 'J', claims: { A1: 'correct' } };
    saveAnswers(answers);
    expect(loadAnswers()).toEqual(answers);
    store.set('lspc:citationAnswers', '{"claims":{"A1":"nonsense"},"reviewer":"K"}');
    expect(loadAnswers()).toEqual({ ...emptyAnswers(), reviewer: 'K' });
    store.set('lspc:citationAnswers', 'not json');
    expect(loadAnswers()).toEqual(emptyAnswers());
    clearAnswers();
    expect(store.has('lspc:citationAnswers')).toBe(false);
  });

  it('degrades to empty answers when storage throws or is absent', () => {
    expect(loadAnswers()).toEqual(emptyAnswers()); // no localStorage at all
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    });
    expect(loadAnswers()).toEqual(emptyAnswers());
    expect(() => saveAnswers(emptyAnswers())).not.toThrow();
    expect(() => clearAnswers()).not.toThrow();
  });
});
