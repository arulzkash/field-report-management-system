import { EnvironmentConfigurationError, loadEnvironment } from '../config/env.js';
import { checkDatabase, createPrismaClient } from '../db/prisma.js';

async function main(): Promise<void> {
  const environment = loadEnvironment();
  const prisma = createPrismaClient(environment.DATABASE_URL);

  try {
    await checkDatabase(prisma);
    console.info('Database connection verified (read-only SELECT 1).');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof EnvironmentConfigurationError) {
    console.error(error.message);
  } else {
    console.error('Database connection failed. Check DATABASE_URL and network access.');
  }

  process.exitCode = 1;
});
