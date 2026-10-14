import { useEffect, useState } from 'react';
import { getHealth } from './health.api';

type HealthState =
  | { status: 'loading' }
  | { status: 'ready'; checkedAt: Date }
  | { status: 'error'; message: string };

export function HealthPage() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHealth(): Promise<void> {
      try {
        await getHealth(controller.signal);

        if (!controller.signal.aborted) {
          setHealth({ status: 'ready', checkedAt: new Date() });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setHealth({
            status: 'error',
            message:
              error instanceof Error ? error.message : 'Unable to check readiness.',
          });
        }
      }
    }

    void loadHealth();

    return () => controller.abort();
  }, [attempt]);

  function refresh(): void {
    setHealth({ status: 'loading' });
    setAttempt((current) => current + 1);
  }

  return (
    <main className="page">
      <header className="page-header">
        <p className="eyebrow">Field Report Management</p>
        <h1>System readiness</h1>
        <p className="introduction">
          Check the connection between the application and its services.
        </p>
      </header>

      <section className="status-panel" aria-labelledby="status-heading">
        <div className="panel-header">
          <h2 id="status-heading">Connection status</h2>
          <span className={`status-badge status-badge--${health.status}`}>
            {health.status === 'loading' && 'Checking'}
            {health.status === 'ready' && 'Ready'}
            {health.status === 'error' && 'Unavailable'}
          </span>
        </div>

        <div className="status-content" role="status" aria-live="polite">
          {health.status === 'loading' && (
            <p>Checking the API and database connection...</p>
          )}

          {health.status === 'ready' && (
            <>
              <p className="status-message">All services are ready.</p>
              <dl className="service-list">
                <div>
                  <dt>API</dt>
                  <dd>Reachable</dd>
                </div>
                <div>
                  <dt>Database</dt>
                  <dd>Connected</dd>
                </div>
              </dl>
              <p className="checked-at">
                Last checked at {health.checkedAt.toLocaleTimeString()}.
              </p>
            </>
          )}

          {health.status === 'error' && (
            <>
              <p className="status-message">Services are not ready.</p>
              <p>{health.message}</p>
            </>
          )}
        </div>

        <button type="button" onClick={refresh} disabled={health.status === 'loading'}>
          {health.status === 'loading' ? 'Checking...' : 'Check again'}
        </button>
      </section>
    </main>
  );
}
