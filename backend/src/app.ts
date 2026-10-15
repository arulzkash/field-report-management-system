import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import type { Environment } from './config/env.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { checkDatabase as queryDatabase } from './db/prisma.js';
import { errorHandler } from './middleware/error-handler.js';
import { validateOrigin } from './middleware/validate-origin.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createReportRouter } from './modules/reports/report.routes.js';
import { createUserRouter } from './modules/users/user.routes.js';

type AppOptions = {
  prisma: PrismaClient;
  environment: Environment;
  checkDatabase?: () => Promise<void>;
};

export function createApp(options: AppOptions): Express {
  const app = express();
  const checkDatabase = options.checkDatabase ?? (() => queryDatabase(options.prisma));

  app.disable('x-powered-by');
  app.use('/api', validateOrigin(options.environment.APP_ORIGIN));
  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());

  app.get('/api/health', async (_req, res) => {
    res.set('Cache-Control', 'no-store');

    try {
      await checkDatabase();
    } catch {
      res.status(503).json({
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'The database is unavailable. Please try again.',
        },
      });
      return;
    }

    res.json({
      data: {
        status: 'ready',
        database: 'connected',
      },
    });
  });

  app.use('/api/auth', createAuthRouter(options.prisma, options.environment));
  app.use('/api/reports', createReportRouter(options.prisma));
  app.use('/api/users', createUserRouter(options.prisma));

  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested endpoint does not exist.',
      },
    });
  });

  app.use(errorHandler);

  return app;
}
