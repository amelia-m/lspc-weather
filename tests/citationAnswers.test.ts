import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  countAnswered,
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
import { CITATIONS } from '../src/config/thresholds';

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
