import { useMemo } from 'react';
import type { SunTimes } from '../domain/types';
import { skyPhase } from '../domain/sun';
import { SITE } from '../config/site';
import { SunArc } from './common/SunArc';
import { useNow } from '../hooks/useNow';
import { Panel } from './common/Panel';
import { fmtTime } from './format';
import { DATA_SOURCES } from '../config/sources';

/**
 * Sunrise, sunset, and how far through the day or the night it is.
 *
 * Sunset and sunrise bound the only period on this card that a rule turns
 * on: 14 CFR 105.19 makes parachute ops between them night ops, and the
 * daylight flag fires across that whole period. The card used to be framed
 * around "last load" instead, which promised something it no longer does —
 * the minutes-before-sunset watch (45 min for students, 30 for licensed) was
 * a figure this dashboard picked, and no published source sets one. The time
 * remaining is printed for the reader to plan against; how many loads fit in
 * it is manifest's call, not the app's.
 *
 * Everything on the card is the current period's, from one `skyPhase`: by
 * day this morning's sunrise and this evening's sunset, by night the evening
 * sunset it began at and the sunrise it ends at, so after sunset the card
 * reads tomorrow's sunrise, not a sunrise already past. The arc above the
 * times shows the share gone, and the line under it the time since and to.
 * The sunrise and sunset are the night flag's (same calculation, same
 * place, same rule at the boundary); the card ticks every 30 s and the flag
 * every minute, so for a minute around sunset the two can differ.
 */
export function SunPanel({ sun }: { sun: SunTimes | null }): JSX.Element {
  const now = useNow(30_000);
  const phase = useMemo(() => skyPhase(SITE.dz.lat, SITE.dz.lon, now), [now]);
  const day = phase?.phase === 'day';
  return (
    <Panel
      className="panel-secondary"
      title="Daylight"
      subtitle="how far through the day or night"
      sources={[DATA_SOURCES.computed]}
    >
      {!sun || !phase ? (
        <p className="muted">—</p>
      ) : (
        <>
          <SunArc phase={phase} now={now} />
          <dl className="kv">
            <dt>{day ? 'Sunrise' : 'Sunset'}</dt>
            <dd>{fmtTime(phase.startMs)}</dd>
            <dt>{day ? 'Sunset' : 'Sunrise'}</dt>
            <dd>{fmtTime(phase.endMs)}</dd>
          </dl>
        </>
      )}
    </Panel>
  );
}
