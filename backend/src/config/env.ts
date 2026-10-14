import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

function isPostgresUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      ['postgres:', 'postgresql:'].includes(url.protocol) &&
      url.hostname.length > 0 &&
      url.pathname.length > 1
    );
  } catch {
    return false;
  }
}

function isHttpOrigin(value: string): boolean {
  try {
    const url = new URL(value);

    return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
  } catch {
    return false;
  }
}

const environmentSchema = z.object({
  DATABASE_URL: z
    .string({ error: 'is required' })
    .trim()
    .refine(isPostgresUrl, 'must be a PostgreSQL connection URL with a database name'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ORIGIN: z
    .string()
    .refine(isHttpOrigin, 'must be an HTTP(S) origin without a path or trailing slash')
    .default('http://localhost:5173'),
});

export type Environment = z.infer<typeof environmentSchema>;

export class EnvironmentConfigurationError extends Error {}

export function readEnvironment(input: NodeJS.ProcessEnv): Environment {
  const result = environmentSchema.safeParse(input);

  if (!result.success) {
    const messages = result.error.issues.map((issue) => {
      return `${issue.path.join('.')}: ${issue.message}`;
    });

    throw new EnvironmentConfigurationError(
      `Invalid environment configuration. ${messages.join('; ')}`,
    );
  }

  return result.data;
}

export function loadEnvironment(): Environment {
  dotenv.config({
    path: fileURLToPath(new URL('../../.env', import.meta.url)),
    quiet: true,
  });

  return readEnvironment(process.env);
}
