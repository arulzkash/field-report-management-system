import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { CreateReportInput } from './report.types';

type ReportFormProps = {
  initialValues?: CreateReportInput;
  onSubmit: (input: CreateReportInput) => Promise<void>;
  submitting: boolean;
  blocked?: boolean;
  error: string | null;
  submitLabel: string;
  submittingLabel: string;
  note: string;
  cancelTo: string;
};

export function ReportForm({
  initialValues,
  onSubmit,
  submitting,
  blocked = false,
  error,
  submitLabel,
  submittingLabel,
  note,
  cancelTo,
}: ReportFormProps) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const disabled = submitting || blocked;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (disabled) {
      return;
    }

    if (!name.trim() || !description.trim()) {
      setValidationError(
        'Enter a report name and description. Fields cannot contain only spaces.',
      );
      return;
    }

    setValidationError(null);
    await onSubmit({ name: name.trim(), description: description.trim() });
  }

  return (
    <form
      className="report-surface report-form"
      onSubmit={(event) => void handleSubmit(event)}
      aria-busy={submitting}
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
          readOnly={blocked}
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
          readOnly={blocked}
          aria-describedby="description-hint"
        />
        <p id="description-hint" className="form-note">
          Include the location, observation, and relevant details.{' '}
          {description.length.toLocaleString('en-GB')} / 5,000 characters.
        </p>
      </div>
      <p className="report-submission-note">{note}</p>
      {(validationError || error) && (
        <p className="form-error" role="alert">
          {validationError ?? error}
        </p>
      )}
      <div className="report-form-actions">
        <button type="submit" disabled={disabled}>
          {submitting ? submittingLabel : submitLabel}
        </button>
        <Link to={cancelTo}>Cancel</Link>
      </div>
    </form>
  );
}
