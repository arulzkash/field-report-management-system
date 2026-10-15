import type { ReportStatus } from './report.types';

const labels: Record<ReportStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className={`report-status report-status--${status}`}>{labels[status]}</span>
  );
}
