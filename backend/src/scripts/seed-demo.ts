import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { loadEnvironment } from '../config/env.js';
import { createPrismaClient } from '../db/prisma.js';
import { readDemoPasswords, seedDemoUsers } from '../modules/auth/demo-users.js';

async function main(): Promise<void> {
  dotenv.config({
    path: fileURLToPath(new URL('../../.env.demo', import.meta.url)),
    quiet: true,
  });
  const environment = loadEnvironment();

  if (environment.NODE_ENV === 'production') {
    throw new Error('Demo seeding is disabled in production.');
  }

  const passwords = readDemoPasswords(process.env);
  const prisma = createPrismaClient(environment.DATABASE_URL);

  try {
    await seedDemoUsers(prisma, passwords);
    console.info(
      'All three demo accounts are available. Existing accounts were preserved.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error('Demo seed failed. Check migration status and demo seed configuration.');
  process.exitCode = 1;
});
