import type { PrismaClient, Report } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import type { SafeUser } from '../auth/auth.types.js';
import type { CreateReportInput } from './report.validation.js';

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
