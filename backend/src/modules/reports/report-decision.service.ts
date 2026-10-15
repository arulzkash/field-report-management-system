import type { PrismaClient, Report } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import type { ReportDecisionInput } from './report.validation.js';

function decisionConflict(): HttpError {
  return new HttpError(
    409,
    'REPORT_DECISION_CONFLICT',
    'This report has changed or already has this status. Reload the latest report before deciding again.',
  );
}

export function decideReport(
  prisma: PrismaClient,
  approverId: string,
  id: string,
  input: ReportDecisionInput,
): Promise<Report> {
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.report.findUnique({ where: { id } });

    if (!current) {
      throw new HttpError(404, 'REPORT_NOT_FOUND', 'The report could not be found.');
    }

    if (current.version !== input.version || current.status === input.status) {
      throw decisionConflict();
    }

    // The write rechecks the version/status read above. A concurrent edit or
    // decision must lose this comparison instead of overwriting committed data.
    const [updated] = await transaction.report.updateManyAndReturn({
      where: { id, version: input.version, status: current.status },
      data: { status: input.status, version: { increment: 1 } },
    });

    if (!updated) {
      throw decisionConflict();
    }

    await transaction.approvalHistory.create({
      data: {
        reportId: id,
        approverId,
        fromStatus: current.status,
        toStatus: input.status,
        reportVersion: updated.version,
      },
    });

    return updated;
  });
}
