/** Browser storage for the citations checklist answers — the one place the
 *  answers live until the reviewer sends them, since the site has no backend.
 *  In the api layer because it is I/O; the shape and formatting are pure and
 *  live in domain/citationAnswers.ts. Storage access mirrors the safeLocal*
 *  helpers in nws.ts: localStorage can throw, and a failure must degrade to
 *  in-memory answers rather than a blank page. */

import { type Answers, sanitizeAnswers } from '../domain/citationAnswers';

const STORAGE_KEY = 'lspc:citationAnswers';

export function loadAnswers(): Answers {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return sanitizeAnswers(stored == null ? null : JSON.parse(stored));
  } catch {
    return sanitizeAnswers(null);
  }
}

export function saveAnswers(answers: Answers): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
  } catch {
    /* private mode / quota — the in-memory state still holds them */
  }
}

export function clearAnswers(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* unavailable — nothing to clear */
  }
}
