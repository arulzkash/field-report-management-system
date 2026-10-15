import type { PrismaClient, Report } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import type { SafeUser } from '../auth/auth.types.js';
import type { CreateReportInput, EditReportInput } from './report.validation.js';

export function createReport(
  prisma: PrismaClient,
  reporterId: string,
  input: CreateReportInput,
): Promise<Report> {
  return prisma.report.create({
    data: {
      name: input.name,
      description: input.description,
      reporterId,
      status: 'pending',
      version: 1,
    },
  });
}

export function listReports(prisma: PrismaClient, user: SafeUser): Promise<Report[]> {
  return prisma.report.findMany({
    where: user.role === 'pelapor' ? { reporterId: user.id } : {},
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

export async function editReport(
  prisma: PrismaClient,
  reporterId: string,
  id: string,
  input: EditReportInput,
): Promise<Report> {
  // Check ownership, pending status, and version in the write itself so concurrent
  // edits or decisions cannot overwrite a newer report.
  const [updated] = await prisma.report.updateManyAndReturn({
    where: {
      id,
      reporterId,
      status: 'pending',
      version: input.version,
    },
    data: {
      name: input.name,
      description: input.description,
      version: { increment: 1 },
    },
  });

  if (updated) {
    return updated;
  }

  const ownedReport = await prisma.report.findFirst({
    where: { id, reporterId },
    select: { id: true },
  });

  if (!ownedReport) {
    throw new HttpError(404, 'REPORT_NOT_FOUND', 'The report could not be found.');
  }

  throw new HttpError(
    409,
    'REPORT_EDIT_CONFLICT',
    'This report has changed or is no longer pending. Reload the latest report before editing again.',
  );
}

export async function getReport(
  prisma: PrismaClient,
  user: SafeUser,
  id: string,
): Promise<Report> {
  const report = await prisma.report.findFirst({
    where: {
      id,
      ...(user.role === 'pelapor' ? { reporterId: user.id } : {}),
    },
  });

  if (!report) {
    throw new HttpError(404, 'REPORT_NOT_FOUND', 'The report could not be found.');
  }

  return report;
}
