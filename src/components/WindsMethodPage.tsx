import { REPO_URL, SITE } from '../config/site';
import { DATA_SOURCES } from '../config/sources';
import { Panel } from './common/Panel';
import { SimTerm } from './common/SimTerm';

/**
 * The Winds aloft card's method, on a page of its own (`#winds-method`,
 * since 2026-11-22, the maintainer's word on the card-wording review: move
 * the detailed explanations of the winds aloft process to another page).
 * Until then the card folded four paragraphs, 464 words, under "About
 * these numbers"; the card now keeps one line per fact and links here.
 *
 * Everything here describes how the table is built and how it can differ
 * from Mark Schulze's tool, which reads the same forecast. No figure is a
 * limit and nothing grades a wind (CLAUDE.md). The one dated figure, the
 * Surface rows against KPMV's measured wind, is a count from
 * docs/markschulze-altitude-reference.md, quoted as that reading.
 */
const SCHULZE_DOC = `${REPO_URL}/blob/main/docs/markschulze-altitude-reference.md`;

export function WindsMethodPage(): JSX.Element {
  return (
    <div className="app">
      <header className="app-head">
        <div>
          <h1>How the winds aloft table is built</h1>
          <p className="app-sub">
            The Winds aloft card&rsquo;s method, and how it compares with Mark Schulze&rsquo;s tool ·{' '}
            <a href="#">back to the dashboard</a>
          </p>
        </div>
      </header>

      <Panel title="Which hour each table shows" sources={[DATA_SOURCES.openMeteo, DATA_SOURCES.markschulze]}>
        <p className="muted small">
          The card and{' '}
          <a href={DATA_SOURCES.markschulze.url} target="_blank" rel="noopener noreferrer">
            Mark Schulze&rsquo;s Winds Aloft
          </a>{' '}
          read the same Open-Meteo forecast. If his numbers differ, check his valid time (labelled in
          Z, e.g. &ldquo;1600Z&rdquo;) against the card&rsquo;s: the card follows the hour nearest the
          clock and moves on at half past, his tool shows the hour in progress, so after half past the
          two are an hour apart until one is stepped. On the same hour the two can be on different
          forecast runs for up to about half an hour, most often between half past and ten to the hour,
          while a new run reaches Open-Meteo&rsquo;s servers one copy at a time; if they disagree then,
          look again later. His altitudes are{' '}
          <strong>
            <SimTerm term="agl">AGL</SimTerm>, like the card&rsquo;s
          </strong>
          ; the &ldquo;MSL&rdquo; on his page is the ground elevation it looked up, not the scale of its
          table.
        </p>
      </Panel>

      <Panel title="The Surface rows" sources={[DATA_SOURCES.openMeteo, DATA_SOURCES.markschulze]}>
        <p className="muted small">
          The two tables&rsquo; Surface rows are different winds. The card&rsquo;s is the model&rsquo;s
          forecast wind at 10&nbsp;m (33&nbsp;ft), the height an airport sensor measures; the measured wind
          is under the table and on the Surface wind card. His is a straight line between two of the
          model&rsquo;s pressure levels (one below the ground here, the next up) read at ground level:
          nearer the wind a couple of hundred feet up, so it often shows more wind than the 10&nbsp;m row,
          most of all at night, when the air near the ground goes calm while the air above keeps moving.
          The card&rsquo;s <em>As Schulze</em> view builds it his way. Against KPMV&rsquo;s measured wind
          over 369 hours to 2026-11-04 the 10&nbsp;m row was nearer in 249, his in 47, tied in 73 (
          <a href={SCHULZE_DOC} target="_blank" rel="noopener noreferrer">
            the comparison
          </a>
          ): a point about heights, not a fault in his tool.
        </p>
      </Panel>

      <Panel title="The ground each counts from" sources={[DATA_SOURCES.openMeteo]}>
        <p className="muted small">
          The card counts altitudes from the field&rsquo;s published elevation,{' '}
          {SITE.dz.elevationFt.toLocaleString()}&nbsp;ft. His tool counts from the ground Open-Meteo&rsquo;s
          terrain gives at the map pin: at this dashboard&rsquo;s point, which the card&rsquo;s link opens,
          a few feet from the field&rsquo;s figure (the card says how many for the hour shown). His own
          list&rsquo;s pin for the club is in the field south-west of the runway and counts from that
          ground.
        </p>
      </Panel>

      <Panel title="How each level is worked out" sources={[DATA_SOURCES.openMeteo]}>
        <p className="muted small">
          <strong>All levels</strong>, the card&rsquo;s default: every sample this app takes, the
          model&rsquo;s winds at 10, 80, 120 and 180&nbsp;m above its ground and at pressure surfaces every
          25&nbsp;hPa through the table&rsquo;s altitudes, seven of them between the ones his tool samples.
          Each level is <strong>linearly interpolated</strong> between the samples either side of it; a
          pressure surface comes with its geopotential height, converted to ft MSL and then to the
          table&rsquo;s AGL altitudes; direction is interpolated along the shortest compass arc.
        </p>
        <p className="muted small">
          <strong>As Schulze</strong>: the table built his way, to check this one against it: his
          pressure levels only (the thirteen below 18,000&nbsp;ft), altitudes above Open-Meteo&rsquo;s
          ground rather than the field, and his Surface row, a rule inferred from his output, not read
          from his code.
        </p>
        <p className="muted small">
          A model <strong>forecast</strong> for the DZ, not a measured sounding. Every comparison run
          logs both tables against his; <a href="#parity">How different from other sources</a> has the
          counts.
        </p>
      </Panel>

      <footer className="app-foot">
        <a href="#">← Back to the dashboard</a>
      </footer>
    </div>
  );
}
