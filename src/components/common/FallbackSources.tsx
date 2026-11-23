import type { DataSource, SourceInUse } from '../../config/sources';
import { SourceLinks } from './SourceLinks';

/**
 * The "Data:" line of a card whose source can fail: one with a fallback (the
 * outlook) or without (the winds cards). The usual source is
 * named whatever answered, so a reader always sees where the card normally
 * comes from (and Open-Meteo keeps its licence link), but only the source in
 * use is written as the card's data: on the fallback the line leads with the
 * fallback and says so, and with nothing loaded it says that rather than
 * crediting anyone.
 *
 * `withUsual` rides along only when the usual source answered: the winds
 * card's cross-reference to Schulze's tool, which reads the same Open-Meteo
 * data, and the outlook's NWS hourly detail.
 */
export function FallbackSources({
  inUse,
  usual,
  fallback = [],
  withUsual = [],
}: {
  inUse: SourceInUse;
  usual: DataSource[];
  /** Empty or left out for a card with one source and no fallback (the
   *  winds cards since 2026-11-23): nothing loaded then names the usual
   *  source alone. */
  fallback?: DataSource[];
  withUsual?: DataSource[];
}): JSX.Element {
  if (inUse === 'usual') {
    return (
      <>
        Data: <SourceLinks sources={[...usual, ...withUsual]} />
      </>
    );
  }
  if (inUse === 'fallback') {
    return (
      <>
        Data: <SourceLinks sources={fallback} /> · <span className="source-chip fallback">fallback in use</span>{' '}
        · usually <SourceLinks sources={usual} />
      </>
    );
  }
  if (fallback.length === 0) {
    return (
      <>
        Data: none loaded · usually <SourceLinks sources={usual} />
      </>
    );
  }
  return (
    <>
      Data: none loaded · usually <SourceLinks sources={usual} />, with <SourceLinks sources={fallback} /> as the
      fallback
    </>
  );
}
