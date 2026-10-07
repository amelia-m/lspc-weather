import { Panel } from './common/Panel';

/**
 * What changed, and what each change did to the comparisons, in date order.
 *
 * Two kinds of change move these figures and they mean different things. A
 * change to the dashboard moves how far it really is from the other source;
 * a change to the comparison moves how well that distance is measured, and a
 * figure that improved after one is not evidence the dashboard got better.
 * Each entry says which it was.
 *
 * Static and dated, like the context panel: the before and after figures are
 * the ones logged or measured at the time (commit log, the write-ups under
 * docs/, and the summaries of the day), not recomputed, so an entry does not
 * move when the summary does. The live sections above are where the current
 * figures are.
 */

type Kind = 'Dashboard' | 'Comparison' | 'Event';

interface Entry {
  date: string;
  kind: Kind;
  what: string;
  effect: string;
}

const TIMELINE: Entry[] = [
  {
    date: 'Sep 23',
    kind: 'Dashboard',
    what: 'The sky is read from the METAR text, with the NWS API’s decode used only when the text has no sky group.',
    effect:
      'That day the API’s decode came back empty for seven KPMV reports in a row, and the dashboard showed a clear sky and VFR under a 2,700 ft overcast that usairnet showed as “Solid Overcast at 2700 ft”. Since the comparison began, the ceiling has agreed with usairnet’s on every run that showed the same report (764 of 764 to Oct 3).',
  },
  {
    date: 'Sep 23',
    kind: 'Dashboard',
    what: 'The winds-aloft table samples the same 13 pressure levels as Schulze’s tool, where it had sampled 6.',
    effect:
      'At the same hour before the change (08Z), the two tables were 24° to 38° apart from 3,000 to 7,000 ft, where the app had no sample between 850 and 700 hPa. After it (19Z), within 4° and 1 kt at every level.',
  },
  {
    date: 'Sep 24',
    kind: 'Comparison',
    what: 'The logged comparisons begin: the winds table against Schulze’s, and the observation and sun times against usairnet’s, combined on this page.',
    effect: 'The first figures on this page.',
  },
  {
    date: 'Sep 26',
    kind: 'Comparison',
    what: 'Winds runs are grouped by the time the two tables represent, and sampled from one long-running job instead of cron lines GitHub ran under a tenth of the time.',
    effect:
      'It showed that most of the winds difference is which hour each page shows. On the summary to Oct 3: on the same hour and forecast run the median gap is 0° and 0 kt, and one hour apart 6° and 1 kt.',
  },
  {
    date: 'Sep 27',
    kind: 'Comparison',
    what: 'Runs where both sides showed the same report are kept apart from runs where they showed different ones, and the side that was behind is logged.',
    effect:
      'When the two showed different reports, this dashboard had the older one in 11 of 11 runs that logged both times; NWS’s own observation list already held the newer report in 3 of them.',
  },
  {
    date: 'Sep 29',
    kind: 'Dashboard',
    what: 'The observation is read from IEM first, with NWS as the backup, polled every 2 minutes.',
    effect:
      'Since then, to Oct 3: when the two showed different reports, this dashboard had the newer one in 786 of 786 runs, and IEM served the report in 1,430 of 1,430. Median minutes from a report to its source: IEM 7, NWS 27.',
  },
  {
    date: 'Sep 30',
    kind: 'Comparison',
    what: 'usairnet’s page is read right for gusts, calm, rain or fog in its heading, and “Solid Overcast”; the sampler moves to every 2 minutes.',
    effect:
      'Clouds went from 72 of 120 same-report runs agreeing (to Sep 29) to 576 of 576 (to Oct 2). The 19 gust and 4 calm wind-direction differences stopped. Two-minute samples are what time each source’s arrivals.',
  },
  {
    date: 'Sep 30',
    kind: 'Event',
    what: 'usairnet’s page could not be read from 13:12 to 15:31Z, 72 samples in a row.',
    effect:
      'Those runs compared nothing. The outage line above counts them: the sampler’s logs are archived with the site’s code, so they stay in the summary after the 14-day logs expire.',
  },
  {
    date: 'Oct 3',
    kind: 'Dashboard',
    what: 'Sunrise and sunset are computed by NOAA’s method, replacing a simplified equation.',
    effect:
      'Before, sunset agreed with usairnet’s on 0 of 723 same-report runs, 2 to 4 minutes apart (summary of Oct 2). The new times match the US Naval Observatory’s to the minute in 56 of 56 checked; against usairnet’s, which are for KPMV, a minute or less apart is expected. The sun rows above count only runs since the change.',
  },
  {
    date: 'Oct 3',
    kind: 'Comparison',
    what: 'Fractional visibility (“1 1/4 Miles”) is read, and a north wind’s 360° is compared with usairnet’s “0° North” as the same direction.',
    effect:
      'Before, 25 visibility and 48 wind-direction differences on the same report were these misreadings (to Oct 2). Those rows count only runs since the fix.',
  },
  {
    date: 'Oct 3',
    kind: 'Comparison',
    what: 'How Schulze’s Surface row is computed was worked out (72 of 72 hours at four sites).',
    effect:
      'Nothing on the page moved; the ground row’s gap, a median ratio near 1.2, now has a cause: the two rows are different heights.',
  },
  {
    date: 'Oct 5',
    kind: 'Comparison',
    what: 'The two-minute sampler ended. Its logs are archived with the site’s code and stay in the summary; one run a day continued, always at about 13:00Z.',
    effect:
      'The arrival timings above come only from the sampler and stop growing. Its last count: on the same hour, this card and Schulze’s were on different forecast runs in 114 of 1,611 comparisons, 81 of them between half past and ten to the hour, the longest stretch about half an hour. Why is still open: after half past the comparison also switches to Schulze’s next-hour table.',
  },
  {
    date: 'Oct 7',
    kind: 'Comparison',
    what: 'The comparisons run eight times a day, about three hours apart and each scheduled at a different minute of the hour.',
    effect:
      'The samples spread over the night and every part of the hour again, the second half included, where the two winds tables show different hours and were most often on different forecast runs. Runs hours apart time almost no arrivals; those figures stay mostly the sampler’s.',
  },
];

export function ParityTimeline(): JSX.Element {
  return (
    <Panel title="Timeline: what changed, and what it did" subtitle="dashboard and comparison changes, in order">
      <p className="muted small">
        A change to the dashboard moves how far it is from the other source. A change to the
        comparison moves how well that is measured, so a figure that improved after one is not
        evidence the dashboard changed. Each entry says which it was, with the figures logged at
        the time, or dated where they come from a later summary.
      </p>
      <ol className="cite-found parity-timeline">
        {TIMELINE.map((e, i) => (
          <li key={i}>
            <strong>
              {e.date} · {e.kind}.
            </strong>{' '}
            {e.what}
            <br />
            <span className="muted">{e.effect}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
