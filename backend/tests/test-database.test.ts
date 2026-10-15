import { describe, expect, it } from 'vitest';
import { assertSeparateTestDatabase } from './helpers/test-database.js';

describe('test database safety', () => {
  const development = 'postgresql://app:password@localhost:5432/field_report_test';

  it('rejects missing test configuration', () => {
    expect(() => assertSeparateTestDatabase(development, undefined)).toThrow(
      'TEST_DATABASE_URL',
    );
  });

  it('rejects the same database with different credentials and a schema parameter', () => {
    const alias =
      'postgresql://other:different@127.0.0.1/field_report_test?schema=testing';

    expect(() => assertSeparateTestDatabase(development, alias)).toThrow('separate');
  });

  it('rejects direct and pooled Neon aliases of the same database', () => {
    expect(() =>
      assertSeparateTestDatabase(
        'postgresql://app:password@ep-example-pooler.region.neon.tech/app_test',
        'postgresql://other:different@ep-example.region.neon.tech/app_test',
      ),
    ).toThrow('separate');
  });

  it('rejects databases without an explicit test name', () => {
    expect(() =>
      assertSeparateTestDatabase(
        development,
        'postgresql://test:test@localhost:55432/app',
      ),
    ).toThrow('_test');
  });

  it('accepts a distinct disposable database', () => {
    expect(() =>
      assertSeparateTestDatabase(
        development,
        'postgresql://test:test@localhost:55432/field_report_test',
      ),
    ).not.toThrow();
  });
});
