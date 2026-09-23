import { useState } from 'react';
import { CHECKLIST, type ChecklistEntry } from '../config/citationsChecklist';
import { REPO_URL } from '../config/site';
import {
  CLAIM_VERDICTS,
  CLAIM_VERDICT_LABEL,
  QUESTION_ANSWERS,
  QUESTION_ANSWER_LABEL,
  countAnswered,
  emptyAnswers,
  formatAnswers,
  issueUrl,
  questionKey,
  type Answers,
  type ClaimVerdict,
  type QuestionAnswer,
} from '../domain/citationAnswers';
import { clearAnswers, loadAnswers, saveAnswers } from '../api/citationAnswers';
import { Panel } from './common/Panel';
import { SourceLink } from './common/SourceLink';

/**
 * The verification checklist, as a page a jumper or instructor can actually
 * work through from a phone at the DZ.
 *
 * Each entry (config/citationsChecklist.ts) is a claim, what its source says,
 * and the questions a reader is asked to settle. The reader rules on the claim
 * and answers each question in place; the answers are kept in the browser as
 * they go (api/citationAnswers.ts), so a pass can be finished next weekend,
 * and leave as a prefilled GitHub issue or as copied text — the site is
 * static, so that is how a ruling reaches the repository.
 *
 * Nothing in the dashboard links here, and that is the point: there is no
 * "Source: LSPC Weather — app heuristic" line left to follow. A threshold no
 * published source sets does not raise a flag at all (thresholds.ts, rule 3),
 * so this page is reached from the footer link and read as a checklist someone
 * works through — not as a glossary the dashboard defers to mid-flag.
 */

interface Heuristic {
  id: string;
  what: string;
  value: string;
  where: string;
}

/** Numbers this dashboard invented that are still on screen. A threshold with
 *  no published source does not decide whether a flag appears or paint a
 *  figure in a warning colour; what is left asserts nothing — it sets the
 *  length of a bar — which is why the list is one row. */
const HEURISTICS: Heuristic[] = [
  {
    id: 'B1',
    what: 'Licensed surface-wind bar scale',
    value: '25 kt',
    where: 'Surface wind card, Licensed — sets where the bar tops out. No flag, no band.',
  },
];

/** Today as the date field's default, in the reviewer's own calendar. Only
 *  used when nothing is stored, so a saved date is never overwritten. */
function today(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function CitationsPage(): JSX.Element {
  const [answers, setAnswers] = useState<Answers>(() => {
    const stored = loadAnswers();
    return stored.date ? stored : { ...stored, date: today() };
  });
  const [copied, setCopied] = useState<'copied' | 'failed' | null>(null);

  const update = (next: Answers): void => {
    setAnswers(next);
    saveAnswers(next);
  };
  const setClaim = (id: string, verdict: ClaimVerdict): void =>
    update({ ...answers, claims: { ...answers.claims, [id]: verdict } });
  const setQuestion = (
    id: string,
    index: number,
    patch: { answer?: QuestionAnswer; note?: string },
  ): void => {
    const key = questionKey(id, index);
    update({
      ...answers,
      questions: { ...answers.questions, [key]: { ...answers.questions[key], ...patch } },
    });
  };
  const reset = (): void => {
    if (!window.confirm('Clear every answer on this page?')) return;
    clearAnswers();
    setAnswers({ ...emptyAnswers(), date: today() });
  };
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(formatAnswers(answers, CHECKLIST));
      setCopied('copied');
    } catch {
      setCopied('failed');
    }
  };

  const { answered, total } = countAnswered(answers, CHECKLIST);
  const issue = issueUrl(REPO_URL, answers, CHECKLIST);

  return (
    <div className="app">
      <header className="app-head">
        <div>
          <h1>Citations to verify</h1>
          <p className="app-sub">
            What this dashboard claims, what the source says, and what you are asked to confirm ·{' '}
            <a href="#">back to the dashboard</a>
          </p>
        </div>
      </header>

      <p className="disclaimer">
        <strong>Each entry below is a claim the dashboard makes, what its source says, and the
        questions a reader is asked to settle.</strong>{' '}
        The USPA SIM sections were read at uspa.org on 2026-09-22; 14 CFR 105.17 and 105.19, AIM
        7-1-7 and FAA-P-8740-2 on 2026-09-23. The club&rsquo;s posted wind-limit tiers are a
        transcription of an undated photo of the sign. A reading is each source as served on one
        day, not a licensed professional&rsquo;s sign-off, and knowing a rule is not knowing how
        this DZ applies it. Rule on each claim, answer its questions, and send the answers with the
        button below; they are kept in this browser until you do.
      </p>

      <Panel title="Your answers" subtitle={`${answered} of ${total} answered`}>
        <div className="cite-review">
          <label className="settings-field">
            <span className="settings-label">Reviewer</span>
            <input
              type="text"
              value={answers.reviewer}
              placeholder="name, and rating if any"
              onChange={(e) => update({ ...answers, reviewer: e.target.value })}
            />
          </label>
          <label className="settings-field">
            <span className="settings-label">Date</span>
            <input
              type="date"
              value={answers.date}
              onChange={(e) => update({ ...answers, date: e.target.value })}
            />
          </label>
        </div>
        <div className="cite-actions">
          {/* The site has no backend: the answers leave as a prefilled issue,
              which is the one write path a phone has into the repository
              without a client. Past ~8 KB of URL GitHub drops the body, so a
              long review is copied instead. */}
          {issue !== null ? (
            <a className="refresh-btn" href={issue} target="_blank" rel="noopener noreferrer">
              Send as a GitHub issue
            </a>
          ) : (
            <span className="muted small">
              Too long for a GitHub link — copy the answers and paste them into a new issue.
            </span>
          )}
          <button className="refresh-btn" type="button" onClick={() => void copy()}>
            Copy answers
          </button>
          <button className="refresh-btn" type="button" onClick={reset}>
            Clear answers
          </button>
          {copied === 'copied' && <span className="muted small">Copied.</span>}
          {copied === 'failed' && (
            <span className="muted small">
              Could not reach the clipboard — select the text below the page and copy it by hand.
            </span>
          )}
        </div>
      </Panel>

      <h2 className="cite-heading">Part A · the USPA and FAA claims</h2>
      <p className="muted small cite-intro">Ordered by what a jumper could act on.</p>

      {CHECKLIST.map((item) => (
        <ChecklistPanel
          key={item.id}
          item={item}
          answers={answers}
          onClaim={(v) => setClaim(item.id, v)}
          onQuestion={(i, patch) => setQuestion(item.id, i, patch)}
        />
      ))}

      <h2 className="cite-heading">Part B · instructor judgement, no lookup needed</h2>
      <p className="muted small cite-intro">
        One number invented for this dashboard is still on screen. It is not claimed to come from
        USPA or the FAA, and it triggers nothing — it only decides how long a bar is drawn. Worth a
        glance rather than a ruling.
      </p>

      <Panel title="App thresholds" subtitle="not published limits">
        <div className="sky-scroll">
          <table className="aloft-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Threshold</th>
                <th>Value</th>
                <th>Where</th>
              </tr>
            </thead>
            <tbody>
              {HEURISTICS.map((h) => (
                <tr key={h.id}>
                  <td>{h.id}</td>
                  <td>{h.what}</td>
                  <td>{h.value}</td>
                  <td>{h.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Every wind flag fires at a published limit or not at all. The <strong>Watch</strong>{' '}
          badge appears on the two flags that fire on a reported condition rather than on a number:
          MVFR flight category (AIM 7-1-7) and an overcast layer (14 CFR 105.17).
        </p>
        <p className="muted small">
          The club waiver tiers (0–5 jumps: 15 mph wind / 16 mph gust · 6–10: 16/18 · 10–20: 18/19 ·
          21+: 18/20) are transcribed from the club’s posted policy and are <strong>not</strong> app
          heuristics — please confirm the transcription matches the current posted sign.
        </p>
      </Panel>

      <h2 className="cite-heading">How each source was read</h2>
      <p className="muted small cite-intro">
        The SIM as uspa.org served it on 2026-09-22. The two CFR sections through the eCFR API on
        2026-09-23 — Title 14 as current on 2026-09-21 — which serves the text the linked pages
        render. AIM 7-1-7 from the HTML edition on faa.gov on 2026-09-23, Change 3, effective
        2026-07-09. FAA-P-8740-2 from the linked PDF on 2026-09-23: the 2008 AFS-8 edition, eight
        pages, in a FAASTeam event folder rather than a catalogue — if the link dies, the pamphlet
        is what to search for. None of that is a check by a person who holds the rating, which is
        what the answers above are for.
      </p>

      <footer className="app-foot">
        <a href="#">← Back to the dashboard</a>
      </footer>
    </div>
  );
}

function ChecklistPanel({
  item,
  answers,
  onClaim,
  onQuestion,
}: {
  item: ChecklistEntry;
  answers: Answers;
  onClaim: (verdict: ClaimVerdict) => void;
  onQuestion: (index: number, patch: { answer?: QuestionAnswer; note?: string }) => void;
}): JSX.Element {
  const verdict = answers.claims[item.id];
  return (
    <Panel title={`${item.id} · ${item.title}`}>
      <p className="cite-quote">{item.claim}</p>
      <dl className="kv cite-kv">
        {item.value && (
          <>
            <dt>Value</dt>
            <dd>{item.value}</dd>
          </>
        )}
        <dt>Where</dt>
        <dd>{item.where}</dd>
        <dt>Cites</dt>
        <dd>
          {item.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ' · '}
              <SourceLink citation={s} />
            </span>
          ))}
          {item.citesNote && <> — {item.citesNote}</>}
        </dd>
      </dl>
      {item.found && (
        <>
          <p className="cite-found-head">The source says (read in {item.found.read}):</p>
          <ul className="cite-found">
            {item.found.says.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </>
      )}

      {/* One verdict for the claim, then one answer per question: the two are
          different rulings, and one line under three questions muddled them. */}
      <div className="cite-answer">
        <p className="cite-answer-head">Your verdict on the claim:</p>
        <div className="cite-choices" role="radiogroup" aria-label={`Verdict on ${item.id}`}>
          {CLAIM_VERDICTS.map((v) => (
            <label key={v}>
              <input
                type="radio"
                name={`claim-${item.id}`}
                value={v}
                checked={verdict === v}
                onChange={() => onClaim(v)}
              />
              {CLAIM_VERDICT_LABEL[v]}
            </label>
          ))}
        </div>
        {item.asks.length > 0 && (
          <>
            <p className="cite-answer-head">Please confirm:</p>
            <ol className="cite-question">
              {item.asks.map((ask, i) => {
                const key = questionKey(item.id, i);
                const response = answers.questions[key];
                return (
                  <li key={key}>
                    <p className="cite-question-text">
                      Q{i + 1}. {ask}
                    </p>
                    <div
                      className="cite-choices"
                      role="radiogroup"
                      aria-label={`${item.id} question ${i + 1}`}
                    >
                      {QUESTION_ANSWERS.map((a) => (
                        <label key={a}>
                          <input
                            type="radio"
                            name={`q-${key}`}
                            value={a}
                            checked={response?.answer === a}
                            onChange={() => onQuestion(i, { answer: a })}
                          />
                          {QUESTION_ANSWER_LABEL[a]}
                        </label>
                      ))}
                    </div>
                    <textarea
                      className="cite-note"
                      placeholder="Notes — what the DZ does, or what the source should say"
                      value={response?.note ?? ''}
                      aria-label={`${item.id} question ${i + 1} notes`}
                      onChange={(e) => onQuestion(i, { note: e.target.value })}
                    />
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </Panel>
  );
}
