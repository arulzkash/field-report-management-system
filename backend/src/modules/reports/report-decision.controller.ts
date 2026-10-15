import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import { decideReport } from './report-decision.service.js';
import { reportDecisionSchema, reportIdSchema } from './report.validation.js';

export function createReportDecisionController(prisma: PrismaClient): RequestHandler {
  return async (req, res) => {
    if (!req.auth) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in to continue.');
    }

    const id = reportIdSchema.safeParse(req.params.id);

    if (!id.success) {
      throw new HttpError(400, 'INVALID_REPORT_ID', 'Enter a valid report ID.');
    }

    const input = reportDecisionSchema.safeParse(req.body);

    if (!input.success) {
      throw new HttpError(
        400,
        'INVALID_INPUT',
        'Provide an approved or rejected status and a valid report version. Only these two fields are accepted.',
        z.flattenError(input.error).fieldErrors,
      );
    }

    const report = await decideReport(prisma, req.auth.user.id, id.data, input.data);
    res.json({ data: report });
  };
}
