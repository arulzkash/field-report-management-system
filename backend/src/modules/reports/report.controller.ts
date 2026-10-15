import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import * as reportService from './report.service.js';
import { createReportSchema, reportIdSchema } from './report.validation.js';

export function createReportController(prisma: PrismaClient) {
  const create: RequestHandler = async (req, res) => {
    if (!req.auth) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in to continue.');
    }

    const input = createReportSchema.safeParse(req.body);

    if (!input.success) {
      throw new HttpError(
        400,
        'INVALID_INPUT',
        'Use a name of 1–150 characters and a description of 1–5,000 characters. Only these two fields are accepted.',
        z.flattenError(input.error).fieldErrors,
      );
    }

    const report = await reportService.createReport(prisma, req.auth.user.id, input.data);
    res.location(`/api/reports/${report.id}`).status(201).json({ data: report });
  };

  const list: RequestHandler = async (req, res) => {
    if (!req.auth) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in to continue.');
    }

    res.json({ data: await reportService.listReports(prisma, req.auth.user) });
  };

  const detail: RequestHandler = async (req, res) => {
    if (!req.auth) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in to continue.');
    }

    const id = reportIdSchema.safeParse(req.params.id);

    if (!id.success) {
      throw new HttpError(400, 'INVALID_REPORT_ID', 'Enter a valid report ID.');
    }

    res.json({ data: await reportService.getReport(prisma, req.auth.user, id.data) });
  };

  return { create, list, detail };
}
