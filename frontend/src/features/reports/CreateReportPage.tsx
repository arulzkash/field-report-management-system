import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import { createReport } from './report.api';
import type { CreateReportInput } from './report.types';
import { ReportForm } from './ReportForm';
import './reports.css';

export function CreateReportPage() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(input: CreateReportInput): Promise<void> {
    setError(null);
    setSubmitting(true);

    try {
      const report = await createReport(input);
      navigate(`/reports/${report.id}`, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await refreshSession();
        return;
      }

      setError(error instanceof Error ? error.message : 'Unable to submit the report.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page reports-page report-form-page">
      <Link className="back-link" to="/reports">
        Back to my reports
      </Link>
      <header className="reports-header">
        <div>
          <h1>New report</h1>
          <p>Describe what you observed in the field. All fields are required.</p>
        </div>
      </header>
      <ReportForm
        onSubmit={handleSubmit}
        submitting={submitting}
        error={error}
        submitLabel="Submit report"
        submittingLabel="Submitting..."
        note="Your report will be submitted with a Pending status for review."
        cancelTo="/reports"
      />
    </main>
  );
}
