export type ReportStatus = 'pending' | 'approved' | 'rejected';

export type Report = {
  id: string;
  name: string;
  description: string;
  status: ReportStatus;
  reporterId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateReportInput = Pick<Report, 'name' | 'description'>;
export type EditReportInput = CreateReportInput & Pick<Report, 'version'>;
export type DecisionStatus = Exclude<ReportStatus, 'pending'>;

export type ReportHistoryEntry = {
  id: string;
  fromStatus: ReportStatus;
  toStatus: DecisionStatus;
  reportVersion: number;
  decidedAt: string;
  approver: { id: string; name: string; email: string };
};
