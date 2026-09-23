import type { ChecklistEntry } from '../config/citationsChecklist';

/**
 * A reviewer's answers to the citations checklist, and how they travel.
 *
 * The site is static, so answers are kept in the reviewer's browser (api/
 * citationAnswers.ts) and carried out by hand: this module turns them into a
 * Markdown report, and into a prefilled new-issue URL for the repository so an
 * instructor at the DZ can file a ruling from a phone without a GitHub client.
 * Pure — no storage, no clock, no window — so the formatting is unit-tested.
 */

/** The ruling on a claim as a whole: the page's four verdicts. */
export type ClaimVerdict = 'correct' | 'wrong-section' | 'wrong-authority' | 'claim-wrong';
export const CLAIM_VERDICTS: readonly ClaimVerdict[] = [
  'correct',
  'wrong-section',
  'wrong-authority',
  'claim-wrong',
];
export const CLAIM_VERDICT_LABEL: Record<ClaimVerdict, string> = {
  correct: 'Correct',
  'wrong-section': 'Wrong section',
  'wrong-authority': 'Wrong authority',
  'claim-wrong': 'The claim itself is wrong',
};

/** Most asks are yes/no ("does anyone here jump a round reserve?"); the note
 *  carries the rest. */
export type QuestionAnswer = 'yes' | 'no' | 'unsure';
export const QUESTION_ANSWERS: readonly QuestionAnswer[] = ['yes', 'no', 'unsure'];
export const QUESTION_ANSWER_LABEL: Record<QuestionAnswer, string> = {
  yes: 'Yes',
  no: 'No',
  unsure: 'Not sure',
};

export interface QuestionResponse {
  answer?: QuestionAnswer;
  note?: string;
}

export interface Answers {
  reviewer: string;
  /** ISO date (YYYY-MM-DD), as typed into the date field. */
  date: string;
  /** Keyed by entry id ("A1"). */
  claims: Record<string, ClaimVerdict>;
  /** Keyed by questionKey(entryId, index). */
  questions: Record<string, QuestionResponse>;
}

export const emptyAnswers = (): Answers => ({ reviewer: '', date: '', claims: {}, questions: {} });

export const questionKey = (entryId: string, index: number): string => `${entryId}:${index}`;

/** Rebuild an Answers from whatever storage held, dropping anything that is
 *  not the shape above. Storage is user-writable and survives releases that
 *  may rename a verdict, and one bad record must not blank a reviewer's page. */
export function sanitizeAnswers(value: unknown): Answers {
  const out = emptyAnswers();
  if (typeof value !== 'object' || value === null) return out;
  const raw = value as Record<string, unknown>;
  if (typeof raw.reviewer === 'string') out.reviewer = raw.reviewer;
  if (typeof raw.date === 'string') out.date = raw.date;
  if (typeof raw.claims === 'object' && raw.claims !== null) {
    for (const [id, v] of Object.entries(raw.claims as Record<string, unknown>)) {
      if (CLAIM_VERDICTS.includes(v as ClaimVerdict)) out.claims[id] = v as ClaimVerdict;
    }
  }
  if (typeof raw.questions === 'object' && raw.questions !== null) {
    for (const [key, v] of Object.entries(raw.questions as Record<string, unknown>)) {
      if (typeof v !== 'object' || v === null) continue;
      const q = v as Record<string, unknown>;
      const resp: QuestionResponse = {};
      if (QUESTION_ANSWERS.includes(q.answer as QuestionAnswer)) resp.answer = q.answer as QuestionAnswer;
      if (typeof q.note === 'string' && q.note.trim() !== '') resp.note = q.note;
      if (resp.answer !== undefined || resp.note !== undefined) out.questions[key] = resp;
    }
  }
  return out;
}

/** How many of the checklist's verdicts and questions have an answer. */
export function countAnswered(
  answers: Answers,
  checklist: readonly ChecklistEntry[],
): { answered: number; total: number } {
  let answered = 0;
  let total = 0;
  for (const entry of checklist) {
    total += 1;
    if (answers.claims[entry.id] !== undefined) answered += 1;
    entry.asks.forEach((_, i) => {
      total += 1;
      const q = answers.questions[questionKey(entry.id, i)];
      if (q?.answer !== undefined || (q?.note ?? '').trim() !== '') answered += 1;
    });
  }
  return { answered, total };
}

/** The answers as a Markdown report: only what was answered, with the question
 *  text repeated so the issue reads on its own without the page. */
export function formatAnswers(answers: Answers, checklist: readonly ChecklistEntry[]): string {
  const lines: string[] = [];
  const who = answers.reviewer.trim() || 'unnamed reviewer';
  const when = answers.date.trim() || 'undated';
  lines.push(`Citations review by ${who}, ${when}.`, '');
  let any = false;
  for (const entry of checklist) {
    const verdict = answers.claims[entry.id];
    const qs = entry.asks
      .map((ask, i) => ({ ask, i, r: answers.questions[questionKey(entry.id, i)] }))
      .filter(({ r }) => r !== undefined && (r.answer !== undefined || (r.note ?? '').trim() !== ''));
    if (verdict === undefined && qs.length === 0) continue;
    any = true;
    lines.push(`### ${entry.id} · ${entry.title}`);
    lines.push(`Verdict: ${verdict !== undefined ? CLAIM_VERDICT_LABEL[verdict] : '(not given)'}`);
    for (const { ask, i, r } of qs) {
      const head = r?.answer !== undefined ? QUESTION_ANSWER_LABEL[r.answer] : '(no answer)';
      const note = (r?.note ?? '').trim();
      lines.push(`- Q${i + 1}: ${head}${note ? ` — ${note}` : ''}`);
      lines.push(`  > ${ask}`);
    }
    lines.push('');
  }
  if (!any) lines.push('(no answers yet)');
  return lines.join('\n').trimEnd() + '\n';
}

/** GitHub's new-issue page accepts a title and body in the query string, but
 *  only up to roughly 8 KB of URL; past that the page loads with the body
 *  dropped, silently. Leave headroom and refuse rather than truncate — the
 *  page offers "Copy answers" for that case. */
const MAX_ISSUE_URL_CHARS = 7000;

export function issueUrl(
  repoUrl: string,
  answers: Answers,
  checklist: readonly ChecklistEntry[],
): string | null {
  const who = answers.reviewer.trim() || 'reviewer';
  const when = answers.date.trim() || 'undated';
  const title = `Citations review — ${who}, ${when}`;
  const body = formatAnswers(answers, checklist);
  const url = `${repoUrl}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  return url.length <= MAX_ISSUE_URL_CHARS ? url : null;
}
