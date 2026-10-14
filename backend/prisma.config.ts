import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Generation and validation must work before local secrets are configured.
    url: process.env.DATABASE_URL,
  },
});
