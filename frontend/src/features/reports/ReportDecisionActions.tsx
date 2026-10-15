import { useState } from 'react';
import { ApiError } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import { decideReport } from './report.api';
import type { DecisionStatus, Report } from './report.types';

export function ReportDecisionActions({
  report,
  reload,
}: {
  report: Report;
  reload: () => void;
}) {
  const { refreshSession } = useAuth();
  const [submitting, setSubmitting] = useState<DecisionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  async function handleDecision(status: DecisionStatus): Promise<void> {
    if (submitting || conflict) {
      return;
    }

    setSubmitting(status);
    setError(null);

    try {
      await decideReport(report.id, status, report.version);
      reload();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await refreshSession();
        return;
      }

      if (error instanceof ApiError && error.status === 409) {
        setConflict(true);
        return;
      }

      setError(error instanceof Error ? error.message : 'Unable to save the decision.');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div
      className="report-decisions"
      role="group"
      aria-label={`Decide ${report.name}`}
      aria-busy={submitting !== null}
    >
      <div className="report-decision-buttons">
        {report.status !== 'approved' && (
          <button
            type="button"
            disabled={submitting !== null || conflict}
            onClick={() => void handleDecision('approved')}
          >
            {submitting === 'approved' ? 'Saving...' : 'Approve'}
          </button>
        )}
        {report.status !== 'rejected' && (
          <button
            type="button"
            className="reject-button"
            disabled={submitting !== null || conflict}
            onClick={() => void handleDecision('rejected')}
          >
            {submitting === 'rejected' ? 'Saving...' : 'Reject'}
          </button>
        )}
      </div>
      {conflict && (
        <div className="report-decision-error" role="alert">
          <p>This report has changed. Reload before deciding again.</p>
          <button type="button" onClick={reload}>
            Reload reports
          </button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
