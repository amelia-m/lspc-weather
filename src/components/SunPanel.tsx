import type { SunTimes } from '../domain/types';
import { useNow } from '../hooks/useNow';
import { Panel } from './common/Panel';
import { fmtTime } from './format';
import { DATA_SOURCES } from '../config/sources';

export function SunPanel({ sun }: { sun: SunTimes | null }): JSX.Element {
  const now = useNow(30_000);
  const minsToSunset = sun ? Math.round((sun.sunset - now) / 60000) : null;
  return (
    <Panel title="Daylight" subtitle="last load planning" sources={[DATA_SOURCES.computed]}>
      {!sun ? (
        <p className="muted">—</p>
      ) : (
        <dl className="kv">
          <dt>Sunrise</dt>
          <dd>{fmtTime(sun.sunrise)}</dd>
          <dt>Sunset</dt>
          <dd>{fmtTime(sun.sunset)}</dd>
          <dt>To sunset</dt>
          <dd>
            {minsToSunset != null && minsToSunset > 0
              ? `${Math.floor(minsToSunset / 60)}h ${minsToSunset % 60}m`
              : 'after sunset'}
          </dd>
        </dl>
      )}
    </Panel>
  );
}
