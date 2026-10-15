import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Environment } from '../../config/env.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { authenticate } from '../../middleware/authenticate.js';
import { createAuthController } from './auth.controller.js';

export function createAuthRouter(prisma: PrismaClient, environment: Environment): Router {
  const router = Router();
  const controller = createAuthController(prisma, environment.NODE_ENV === 'production');
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'LOGIN_RATE_LIMITED',
        message: 'Too many login attempts. Please try again later.',
      },
    },
  });

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.post('/login', loginLimiter, controller.login);
  router.get('/me', authenticate(prisma), controller.me);
  router.post('/logout', authenticate(prisma), controller.logout);

  return router;
}
