/**
 * The line under the tabs that joins the two layouts while one is on trial
 * (the maintainer, 2026-11-25: launch option B "as an alternate view", and
 * of a link to it from the standard page, "yes link, probably at top").
 *
 * On the standard page, where the tab has sections to jump between, it
 * offers the trial; on the trial it says it is one and offers the way back.
 * Either link keeps the tab the reader is on (`hash`). Plain small text: an
 * invitation, not a flag.
 */
export function TrialNote({
  beta,
  hasBar,
  base,
  hash,
}: {
  /** Whether this page is the trial layout. */
  beta: boolean;
  /** Whether this tab has a section bar in the trial. */
  hasBar: boolean;
  /** The site's base path, ending in a slash. */
  base: string;
  /** The address's `#` part, to carry the tab across: '' or '#pilots'. */
  hash: string;
}): JSX.Element | null {
  if (beta) {
    return (
      <p className="beta-note muted small">
        Trial layout: the bar {hasBar ? '' : 'on the Jumpers and Pilots tabs '}jumps between sections of the page.{' '}
        <a href={`${base}${hash}`}>The standard layout</a>
      </p>
    );
  }
  if (!hasBar) return null;
  return (
    <p className="beta-note muted small">
      On trial: <a href={`${base}beta/${hash}`}>a layout with a bar to jump between sections</a>. Same page, same data.
    </p>
  );
}
