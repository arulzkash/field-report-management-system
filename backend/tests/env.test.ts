import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { readEnvironment } from '../src/config/env.js';

const databaseUrl = 'postgresql://test:test@localhost:5432/foundation';

describe('environment configuration', () => {
  it('accepts a PostgreSQL URL and applies local defaults', () => {
    expect(readEnvironment({ DATABASE_URL: databaseUrl })).toEqual({
      DATABASE_URL: databaseUrl,
      PORT: 4000,
      NODE_ENV: 'development',
      APP_ORIGIN: 'http://localhost:5173',
    });
  });

  it('rejects a missing database URL', () => {
    expect(() => readEnvironment({})).toThrow('DATABASE_URL');
  });

  it('rejects non-PostgreSQL URLs without exposing their contents', () => {
    const secret = 'https://private-user:private-password@example.com/database';

    expect(() => readEnvironment({ DATABASE_URL: secret })).toThrow('DATABASE_URL');
    expect(() => readEnvironment({ DATABASE_URL: secret })).not.toThrow(secret);
  });

  it.each(['0', '65536', 'invalid'])('rejects invalid port %s', (port) => {
    expect(() => readEnvironment({ DATABASE_URL: databaseUrl, PORT: port })).toThrow(
      'PORT',
    );
  });

  it('rejects an origin containing a path', () => {
    expect(() =>
      readEnvironment({
        DATABASE_URL: databaseUrl,
        APP_ORIGIN: 'http://localhost:5173/reports',
      }),
    ).toThrow('APP_ORIGIN');
  });

  it('exits clearly on invalid startup configuration without printing secrets', () => {
    const secret = 'invalid-database-secret';
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
      env: {
        ...process.env,
        DATABASE_URL: secret,
        PORT: 'invalid',
      },
      encoding: 'utf8',
      timeout: 10_000,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Invalid environment configuration');
    expect(result.stderr).toContain('DATABASE_URL');
    expect(result.stderr).toContain('PORT');
    expect(result.stderr).not.toContain(secret);
    expect(result.stdout).not.toContain('API listening');
  });
});
