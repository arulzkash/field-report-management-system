import express, { type Express } from 'express';
import { errorHandler } from './middleware/error-handler.js';

export function createApp(checkDatabase: () => Promise<void>): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

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
