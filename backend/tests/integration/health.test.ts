import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createHealthApp } from '../helpers/app.js';
import { checkDatabase, createPrismaClient } from '../../src/db/prisma.js';

describe('GET /api/health', () => {
  it('returns readiness only after the database check succeeds', async () => {
    const check = vi.fn().mockResolvedValue(undefined);
    const response = await request(createHealthApp(check)).get('/api/health');

    expect(check).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        status: 'ready',
        database: 'connected',
      },
    });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('returns a safe 503 without exposing the database error', async () => {
    const secret = 'postgresql://private-user:private-password@private-host/database';
    const check = vi.fn().mockRejectedValue(new Error(`Connection failed: ${secret}`));
    const response = await request(createHealthApp(check)).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'The database is unavailable. Please try again.',
      },
    });
    expect(response.text).not.toContain(secret);
    expect(response.text).not.toContain('stack');
  });

  it('returns 503 for a real Prisma connection failure', async () => {
    const prisma = createPrismaClient(
      'postgresql://test:test@127.0.0.1:1/unavailable?sslmode=disable',
    );

    try {
      const app = createHealthApp(() => checkDatabase(prisma));
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE');
      expect(response.text).not.toContain('postgresql://');
      expect(response.text).not.toContain('127.0.0.1');
    } finally {
      await prisma.$disconnect();
    }
  });
});

describe('HTTP error responses', () => {
  it('returns JSON for an unknown endpoint', async () => {
    const app = createHealthApp(async () => {});
    const response = await request(app).get('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns a safe 400 for malformed JSON', async () => {
    const app = createHealthApp(async () => {});
    const response = await request(app)
      .post('/api/unknown')
      .set('Content-Type', 'application/json')
      .set('Origin', 'http://localhost:5173')
      .send('{"secret":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
    expect(response.text).not.toContain('secret');
  });
});
