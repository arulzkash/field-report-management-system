import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import { createReport } from './report.api';
import './reports.css';

export function CreateReportPage() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!name.trim() || !description.trim()) {
      setError('Enter a report name and description. Fields cannot contain only spaces.');
      return;
    }

    setSubmitting(true);

    try {
      const report = await createReport({
        name: name.trim(),
        description: description.trim(),
      });
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
      <form
        className="report-surface report-form"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="form-field">
          <label htmlFor="report-name">Report name</label>
          <input
            id="report-name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={150}
            disabled={submitting}
            aria-describedby="name-hint"
          />
          <p id="name-hint" className="form-note">
            A short, specific title. Maximum 150 characters.
          </p>
        </div>
        <div className="form-field">
          <label htmlFor="report-description">Description</label>
          <textarea
            id="report-description"
            name="description"
            rows={8}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            maxLength={5000}
            disabled={submitting}
            aria-describedby="description-hint"
          />
          <p id="description-hint" className="form-note">
            Include the location, observation, and relevant details.{' '}
            {description.length.toLocaleString('en-GB')} / 5,000 characters.
          </p>
        </div>
        <p className="report-submission-note">
          Your report will be submitted with a Pending status for review.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="report-form-actions">
          <button type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit report'}
          </button>
          <Link to="/reports">Cancel</Link>
        </div>
      </form>
    </main>
  );
}
