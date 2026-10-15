import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { createReportController } from './report.controller.js';
import { createReportDecisionController } from './report-decision.controller.js';

export function createReportRouter(prisma: PrismaClient): Router {
  const router = Router();
  const controller = createReportController(prisma);

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(authenticate(prisma));
  router.post('/', authorize('pelapor'), controller.create);
  router.patch('/:id', authorize('pelapor'), controller.edit);
  router.patch(
    '/:id/status',
    authorize('approver'),
    createReportDecisionController(prisma),
  );
  router.get('/', authorize('pelapor', 'approver'), controller.list);
  router.get('/:id', authorize('pelapor', 'approver'), controller.detail);

  return router;
}
