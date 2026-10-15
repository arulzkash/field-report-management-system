import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/scripts/seed-demo.ts',
  },
  datasource: {
    // Generation and validation must work before local secrets are configured.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
