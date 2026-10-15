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
