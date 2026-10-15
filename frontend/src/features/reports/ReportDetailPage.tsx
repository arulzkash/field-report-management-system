import { Link, useParams } from 'react-router-dom';
import { ReportLoadState } from './ReportLoadState';
import { ReportStatusBadge } from './ReportStatusBadge';
import { formatReportDate } from './report-date';
import { useReports } from './useReports';
import './reports.css';

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, retry } = useReports(id);
  const report = state.status === 'ready' ? state.reports[0] : undefined;

  return (
    <main className="page reports-page report-detail-page">
      <Link className="back-link" to="/reports">
        Back to my reports
      </Link>
      <header className="reports-header">
        <h1>Report details</h1>
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
        </article>
      )}
    </main>
  );
}
