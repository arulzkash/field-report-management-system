import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ReportDecisionActions } from './ReportDecisionActions';
import { ReportLoadState } from './ReportLoadState';
import { ReportStatusBadge } from './ReportStatusBadge';
import { formatReportDate } from './report-date';
import { useReports } from './useReports';
import './reports.css';

export function ReportListPage() {
  const { session } = useAuth();
  const isApprover = session.user?.role === 'approver';
  const { state, retry } = useReports();

  return (
    <main className="page reports-page">
      <header className="reports-header">
        <div>
          <h1>{isApprover ? 'Review reports' : 'My reports'}</h1>
          <p>
            {isApprover
              ? 'Review field observations and record your decision.'
              : 'Record your field observations and follow their status.'}
          </p>
        </div>
        {!isApprover && (
          <Link className="button-link" to="/reports/new">
            New report
          </Link>
        )}
      </header>

      {state.status !== 'ready' && (
        <ReportLoadState
          message={state.status === 'error' ? state.message : undefined}
          retry={retry}
        />
      )}

      {state.status === 'ready' && state.reports.length === 0 && (
        <section className="report-surface report-empty">
          <h2>No reports yet</h2>
          {isApprover ? (
            <p>Reports will appear here when a Reporter submits an observation.</p>
          ) : (
            <>
              <p>
                Your submitted reports will appear here. Start with your first field
                observation.
              </p>
              <Link to="/reports/new">Create your first report</Link>
            </>
          )}
        </section>
      )}

      {state.status === 'ready' && state.reports.length > 0 && (
        <section
          className="report-surface report-register"
          aria-label={isApprover ? 'All reports' : 'Your reports'}
        >
          <div className="report-register-heading">
            <h2>
              Submitted reports <span>({state.reports.length})</span>
            </h2>
            <p>Newest first · All times WIB</p>
          </div>
          <table
            className={
              isApprover ? 'reports-table reports-table--review' : 'reports-table'
            }
          >
            <caption className="visually-hidden">
              {isApprover ? 'All reports' : 'Your reports'}, newest first. Select a report
              name to view details.
            </caption>
            <thead>
              <tr>
                <th scope="col">Report name</th>
                <th scope="col">Status</th>
                <th scope="col">Submitted</th>
                {isApprover && <th scope="col">Decision</th>}
              </tr>
            </thead>
            <tbody>
              {state.reports.map((report) => (
                <tr key={report.id}>
                  <td className="report-name">
                    <Link to={`/reports/${report.id}`}>{report.name}</Link>
                  </td>
                  <td data-label="Status">
                    <ReportStatusBadge status={report.status} />
                  </td>
                  <td data-label="Submitted">
                    <time dateTime={report.createdAt}>
                      {formatReportDate(report.createdAt)}
                    </time>
                  </td>
                  {isApprover && (
                    <td data-label="Decision">
                      <ReportDecisionActions
                        key={report.version}
                        report={report}
                        reload={retry}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
