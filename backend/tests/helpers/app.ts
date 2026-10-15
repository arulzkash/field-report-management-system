import { createApp } from '../../src/app.js';
import { readEnvironment } from '../../src/config/env.js';
import { createPrismaClient } from '../../src/db/prisma.js';

export const testEnvironment = readEnvironment({
  DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/unavailable?sslmode=disable',
  NODE_ENV: 'test',
});

export const disconnectedPrisma = createPrismaClient(testEnvironment.DATABASE_URL);

export function createHealthApp(checkDatabase: () => Promise<void>) {
  return createApp({
    prisma: disconnectedPrisma,
    environment: testEnvironment,
    checkDatabase,
  });
}
