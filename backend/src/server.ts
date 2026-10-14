import { createApp } from './app.js';
import { EnvironmentConfigurationError, loadEnvironment } from './config/env.js';
import { checkDatabase, createPrismaClient } from './db/prisma.js';

function startServer(): void {
  const environment = loadEnvironment();
  const prisma = createPrismaClient(environment.DATABASE_URL);
  const app = createApp(() => checkDatabase(prisma));
  const server = app.listen(environment.PORT, '127.0.0.1', () => {
    console.info(`API listening at http://127.0.0.1:${environment.PORT}`);
  });

  server.on('error', () => {
    console.error('Unable to start the API. Check whether the port is available.');
    void prisma.$disconnect();
    process.exitCode = 1;
  });

  function shutdown(): void {
    server.close(() => {
      prisma.$disconnect().catch(() => {
        console.error('Unable to close the database connection cleanly.');
        process.exitCode = 1;
      });
    });
  }

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

try {
  startServer();
} catch (error) {
  if (error instanceof EnvironmentConfigurationError) {
    console.error(error.message);
  } else {
    console.error('Unable to start the API. Check the application configuration.');
  }

  process.exitCode = 1;
}
