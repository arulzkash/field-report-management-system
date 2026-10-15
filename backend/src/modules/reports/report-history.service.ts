import type {
  ApprovalHistory,
  PrismaClient,
  User,
} from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import type { SafeUser } from '../auth/auth.types.js';

export type ReportHistoryEntry = Pick<
  ApprovalHistory,
  'id' | 'fromStatus' | 'toStatus' | 'reportVersion' | 'decidedAt'
> & {
  approver: Pick<User, 'id' | 'name' | 'email'>;
};

export async function getReportHistory(
  prisma: PrismaClient,
  user: SafeUser,
  id: string,
): Promise<ReportHistoryEntry[]> {
  const report = await prisma.report.findFirst({
    where: {
      id,
      ...(user.role === 'pelapor' ? { reporterId: user.id } : {}),
    },
    select: {
      history: {
        orderBy: { reportVersion: 'asc' },
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          reportVersion: true,
          decidedAt: true,
          approver: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!report) {
    throw new HttpError(404, 'REPORT_NOT_FOUND', 'The report could not be found.');
  }

  return report.history;
}
