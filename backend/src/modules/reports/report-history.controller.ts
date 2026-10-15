import type { RequestHandler } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import { getReportHistory } from './report-history.service.js';
import { reportIdSchema } from './report.validation.js';

export function createReportHistoryController(prisma: PrismaClient): RequestHandler {
  return async (req, res) => {
    if (!req.auth) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in to continue.');
    }

    const id = reportIdSchema.safeParse(req.params.id);

    if (!id.success) {
      throw new HttpError(400, 'INVALID_REPORT_ID', 'Enter a valid report ID.');
    }

    const history = await getReportHistory(prisma, req.auth.user, id.data);
    res.json({ data: history });
  };
}
