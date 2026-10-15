import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ReportLoadState } from './ReportLoadState';
import { ReportHistory } from './ReportHistory';
import { ReportStatusBadge } from './ReportStatusBadge';
import { formatReportDate } from './report-date';
import { useReports } from './useReports';
import './reports.css';

export function ReportDetailPage() {
  const { session } = useAuth();
  const isReporter = session.user?.role === 'pelapor';
  const { id } = useParams<{ id: string }>();
  const { state, retry } = useReports(id);
  const report = state.status === 'ready' ? state.reports[0] : undefined;

  return (
    <main className="page reports-page report-detail-page">
      <Link className="back-link" to="/reports">
        {isReporter ? 'Back to my reports' : 'Back to review reports'}
      </Link>
      <header className="reports-header">
        <h1>Report details</h1>
        {isReporter && report?.status === 'pending' && (
          <Link className="button-link" to={`/reports/${report.id}/edit`}>
            Edit report
          </Link>
        )}
      </header>
      {state.status !== 'ready' && (
        <ReportLoadState
          message={state.status === 'error' ? state.message : undefined}
          retry={retry}
        />
      )}
      {report && (
        <article className="report-surface report-detail">
          <div className="report-detail-heading">
            <h2>{report.name}</h2>
            <ReportStatusBadge status={report.status} />
          </div>
          <dl className="report-metadata">
            <div>
              <dt>Submitted</dt>
              <dd>
                <time dateTime={report.createdAt}>
                  {formatReportDate(report.createdAt)}
                </time>
              </dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>
                <time dateTime={report.updatedAt}>
                  {formatReportDate(report.updatedAt)}
                </time>
              </dd>
            </div>
          </dl>
          <section aria-labelledby="description-heading" className="report-description">
            <h3 id="description-heading">Description</h3>
            <p>{report.description}</p>
          </section>
          {isReporter && report.status !== 'pending' && (
            <p className="report-readonly-note">
              This report is read-only. Only Pending reports can be edited.
            </p>
          )}
        </article>
      )}
      {report && (
        <ReportHistory key={`${report.id}:${report.version}`} reportId={report.id} />
      )}
    </main>
  );
}
