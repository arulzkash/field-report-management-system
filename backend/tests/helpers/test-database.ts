import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

function databaseIdentity(connectionString: string): string {
  const url = new URL(connectionString);
  let host = url.hostname;

  if (['localhost', '127.0.0.1', '[::1]'].includes(host)) {
    host = '127.0.0.1';
  }

  if (host.endsWith('.neon.tech')) {
    host = host.replace('-pooler.', '.');
  }

  return `${host}:${url.port || '5432'}${decodeURIComponent(url.pathname)}`;
}

export function assertSeparateTestDatabase(
  databaseUrl: string | undefined,
  testDatabaseUrl: string | undefined,
): asserts testDatabaseUrl is string {
  if (!databaseUrl || !testDatabaseUrl) {
    throw new Error(
      'Configure a separate TEST_DATABASE_URL before running integration tests.',
    );
  }

  try {
    const testUrl = new URL(testDatabaseUrl);

    if (
      !['postgresql:', 'postgres:'].includes(testUrl.protocol) ||
      !decodeURIComponent(testUrl.pathname).endsWith('_test') ||
      databaseIdentity(databaseUrl) === databaseIdentity(testDatabaseUrl)
    ) {
      throw new Error();
    }
  } catch {
    throw new Error(
      'Use a separate disposable PostgreSQL database whose name ends in _test.',
    );
  }
}

export function loadTestDatabaseUrl(): string {
  const localEnvironmentPath = fileURLToPath(new URL('../../.env', import.meta.url));
  const localEnvironment = existsSync(localEnvironmentPath)
    ? dotenv.parse(readFileSync(localEnvironmentPath))
    : {};

  dotenv.config({
    path: fileURLToPath(new URL('../../.env.test', import.meta.url)),
    quiet: true,
  });

  const databaseUrl = process.env.DATABASE_URL ?? localEnvironment.DATABASE_URL;
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;

  assertSeparateTestDatabase(databaseUrl, testDatabaseUrl);

  return testDatabaseUrl;
}

export function migrateTestDatabase(testDatabaseUrl: string): void {
  try {
    execFileSync(
      process.execPath,
      [
        fileURLToPath(
          new URL('../../node_modules/prisma/build/index.js', import.meta.url),
        ),
        'migrate',
        'deploy',
      ],
      {
        cwd: fileURLToPath(new URL('../../', import.meta.url)),
        env: {
          ...process.env,
          DATABASE_URL: testDatabaseUrl,
          DIRECT_URL: testDatabaseUrl,
        },
        stdio: 'pipe',
        timeout: 30_000,
      },
    );
  } catch {
    // CLI output can contain connection details; do not include it in test failures.
    throw new Error(
      'Unable to migrate the test database. Start it and verify test configuration.',
    );
  }
}
