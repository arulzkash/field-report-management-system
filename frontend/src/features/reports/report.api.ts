import { requestApi } from '../../lib/api';
import type {
  CreateReportInput,
  DecisionStatus,
  EditReportInput,
  Report,
} from './report.types';

export async function listReports(signal: AbortSignal): Promise<Report[]> {
  const response = await requestApi<{ data: Report[] }>('/reports', { signal });
  return response.data;
}

export async function getReport(id: string, signal: AbortSignal): Promise<Report> {
  const response = await requestApi<{ data: Report }>(
    `/reports/${encodeURIComponent(id)}`,
    {
      signal,
    },
  );
  return response.data;
}

export async function createReport(input: CreateReportInput): Promise<Report> {
  const response = await requestApi<{ data: Report }>('/reports', {
    method: 'POST',
    body: input,
  });
  return response.data;
}

export async function editReport(id: string, input: EditReportInput): Promise<Report> {
  const response = await requestApi<{ data: Report }>(
    `/reports/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: input,
    },
  );
  return response.data;
}

export async function decideReport(
  id: string,
  status: DecisionStatus,
  version: number,
): Promise<Report> {
  const response = await requestApi<{ data: Report }>(
    `/reports/${encodeURIComponent(id)}/status`,
    {
      method: 'PATCH',
      body: { status, version },
    },
  );
  return response.data;
}
