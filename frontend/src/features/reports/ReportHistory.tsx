import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import { formatDecisionDate } from './report-date';
import { getReportHistory } from './report.api';
import type { ReportHistoryEntry } from './report.types';
import { ReportStatusBadge } from './ReportStatusBadge';

type HistoryState =
  | { status: 'loading' }
  | { status: 'ready'; entries: ReportHistoryEntry[] }
  | { status: 'error'; message: string };

export function ReportHistory({ reportId }: { reportId: string }) {
  const { refreshSession } = useAuth();
  const [state, setState] = useState<HistoryState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load(): Promise<void> {
      try {
        const entries = await getReportHistory(reportId, controller.signal);
        if (!controller.signal.aborted) {
          setState({ status: 'ready', entries });
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          await refreshSession();
          return;
        }

        setState({
          status: 'error',
          message:
            error instanceof Error ? error.message : 'Unable to load decision history.',
        });
      }
    }

    void load();
    return () => controller.abort();
  }, [reportId, attempt, refreshSession]);

  function retry(): void {
    setState({ status: 'loading' });
    setAttempt((current) => current + 1);
  }

  return (
    <section className="report-surface report-history" aria-labelledby="history-heading">
      <h2 id="history-heading">Decision history</h2>
      {state.status === 'loading' && <p role="status">Loading decision history...</p>}
      {state.status === 'error' && (
        <div>
          <p className="form-error" role="alert">
            {state.message}
          </p>
          <button type="button" onClick={retry}>
            Retry history
          </button>
        </div>
      )}
      {state.status === 'ready' && state.entries.length === 0 && (
        <p>
          No decisions yet. History will appear after an Approver reviews this report.
        </p>
      )}
      {state.status === 'ready' && state.entries.length > 0 && (
        <>
          <p className="form-note">Oldest decision first · All times WIB</p>
          <ol className="decision-history-list">
            {state.entries.map((entry) => (
              <li key={entry.id}>
                <div className="decision-history-transition">
                  <ReportStatusBadge status={entry.fromStatus} />
                  <span aria-label="to">→</span>
                  <ReportStatusBadge status={entry.toStatus} />
                </div>
                <p className="decision-history-actor">Decided by {entry.approver.name}</p>
                <p className="form-note">{entry.approver.email}</p>
                <time dateTime={entry.decidedAt}>
                  {formatDecisionDate(entry.decidedAt)}
                </time>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
