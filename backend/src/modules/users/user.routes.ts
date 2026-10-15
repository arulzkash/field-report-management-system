import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { createUserController } from './user.controller.js';

export function createUserRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(authenticate(prisma));
  router.post('/', authorize('admin'), createUserController(prisma));

  return router;
}
