import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Catches render/lifecycle errors anywhere below it so a single failing panel
 * degrades to a readable message instead of a blank white screen. Keeps the
 * advisory-only framing: it tells the jumper the tool is down and to fall back
 * to official sources, rather than implying anything about conditions.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface it in the console for anyone debugging from the deployed site.
    console.error('Dashboard crashed:', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="app">
        <div className="crash" role="alert">
          <h1>Something went wrong</h1>
          <p>
            The dashboard hit an unexpected error and can&rsquo;t display right now. This is a bug
            in the tool, not a weather reading &mdash; do not infer anything about conditions from
            it. Check official sources directly:{' '}
            <a href="https://forecast.weather.gov/" target="_blank" rel="noreferrer">
              NWS
            </a>{' '}
            and{' '}
            <a
              href="https://aviationweather.gov/data/taf/?id=KOFF"
              target="_blank"
              rel="noreferrer"
            >
              aviation weather
            </a>
            , and confirm with the S&amp;TA and pilot in command.
          </p>
          <button type="button" className="crash-btn" onClick={() => window.location.reload()}>
            Reload
          </button>
          <details className="crash-details">
            <summary>Error detail</summary>
            <pre>{error.message}</pre>
          </details>
        </div>
      </div>
    );
  }
}
