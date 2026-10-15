import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import { editReport } from './report.api';
import type { CreateReportInput, Report } from './report.types';
import { ReportForm } from './ReportForm';
import { ReportLoadState } from './ReportLoadState';
import { useReports } from './useReports';
import './reports.css';

function PendingReportEditor({ report, reload }: { report: Report; reload: () => void }) {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  async function handleSubmit(input: CreateReportInput): Promise<void> {
    setError(null);
    setSubmitting(true);

    try {
      await editReport(report.id, { ...input, version: report.version });
      navigate(`/reports/${report.id}`, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await refreshSession();
        return;
      }

      if (error instanceof ApiError && error.status === 409) {
        setConflict(true);
        return;
      }

      setError(error instanceof Error ? error.message : 'Unable to save the report.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {conflict && (
        <section
          className="report-conflict"
          role="alert"
          aria-labelledby="conflict-heading"
        >
          <h2 id="conflict-heading">Report changed</h2>
          <p>
            This report was updated or is no longer Pending. Your changes have not been
            saved. Copy any text you want to keep before reloading; reloading replaces
            your draft with the latest report.
          </p>
          <button type="button" onClick={reload}>
            Reload latest report
          </button>
        </section>
      )}
      <ReportForm
        initialValues={report}
        onSubmit={handleSubmit}
        submitting={submitting}
        blocked={conflict}
        error={error}
        submitLabel="Save changes"
        submittingLabel="Saving..."
        note="You can edit this report while its status is Pending. All fields are required."
        cancelTo={`/reports/${report.id}`}
      />
    </>
  );
}

export function EditReportPage() {
  const { id } = useParams<{ id: string }>();
  const { state, retry } = useReports(id);
  const report = state.status === 'ready' ? state.reports[0] : undefined;

  return (
    <main className="page reports-page report-form-page">
      <Link className="back-link" to={`/reports/${id}`}>
        Back to report details
      </Link>
      <header className="reports-header">
        <h1>Edit report</h1>
      </header>
      {state.status !== 'ready' && (
        <ReportLoadState
          message={state.status === 'error' ? state.message : undefined}
          retry={retry}
        />
      )}
      {report?.status === 'pending' && (
        <PendingReportEditor
          key={`${report.id}:${report.version}`}
          report={report}
          reload={retry}
        />
      )}
      {report && report.status !== 'pending' && (
        <section className="report-surface" role="status">
          <h2>Report is read-only</h2>
          <p>
            Only Pending reports can be edited. This report has already been{' '}
            {report.status}.
          </p>
          <Link to={`/reports/${report.id}`}>View report details</Link>
        </section>
      )}
    </main>
  );
}
