export function ReportLoadState({
  message,
  retry,
}: {
  message?: string;
  retry: () => void;
}) {
  if (!message) {
    return (
      <p className="report-surface" role="status">
        Loading reports...
      </p>
    );
  }

  return (
    <div className="report-surface">
      <p className="form-error" role="alert">
        {message}
      </p>
      <button type="button" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
