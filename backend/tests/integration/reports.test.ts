import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { readEnvironment } from '../../src/config/env.js';
import { createPrismaClient } from '../../src/db/prisma.js';
import { hashPassword } from '../../src/modules/auth/password.js';
import { SESSION_COOKIE_NAME } from '../../src/modules/auth/session.js';
import { loadTestDatabaseUrl, migrateTestDatabase } from '../helpers/test-database.js';

const testUrl = loadTestDatabaseUrl();
const prisma = createPrismaClient(testUrl);
const origin = 'http://localhost:5173';
const users = {
  a: { id: randomUUID(), role: 'pelapor' },
  b: { id: randomUUID(), role: 'pelapor' },
  approver: { id: randomUUID(), role: 'approver' },
  admin: { id: randomUUID(), role: 'admin' },
} as const;
const input = {
  name: 'Drainage inspection',
  description: 'Standing water near the north gate.',
};
let app: Express;
let cookies: Record<keyof typeof users, string>;

beforeAll(async () => {
  migrateTestDatabase(testUrl);
  await prisma.session.deleteMany();
  await prisma.report.deleteMany();
  await prisma.user.deleteMany();
  const passwordHash = await hashPassword('Report-Test-Password-2026!');

  await prisma.user.createMany({
    data: Object.entries(users).map(([name, user]) => ({
      ...user,
      name,
      email: `${name}@reports.test`,
      passwordHash,
    })),
  });
  app = createApp({
    prisma,
    environment: readEnvironment({
      DATABASE_URL: testUrl,
      NODE_ENV: 'test',
      APP_ORIGIN: origin,
    }),
  });
}, 60_000);

beforeEach(async () => {
  await prisma.report.deleteMany();
  await prisma.session.deleteMany();
  cookies = {} as Record<keyof typeof users, string>;

  for (const key of Object.keys(users) as (keyof typeof users)[]) {
    const token = randomBytes(32).toString('hex');
    await prisma.session.create({
      data: {
        userId: users[key].id,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    cookies[key] = `${SESSION_COOKIE_NAME}=${token}`;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

function submit(body: object = input, actor: keyof typeof users = 'a') {
  return request(app)
    .post('/api/reports')
    .set('Origin', origin)
    .set('Cookie', cookies[actor])
    .send(body);
}

async function fixture(reporterId = users.a.id, createdAt = new Date()) {
  return prisma.report.create({ data: { ...input, reporterId, createdAt } });
}

describe('report creation', () => {
  it('persists trimmed content with server-owned defaults and no account secrets', async () => {
    const response = await submit({
      name: `  ${input.name}  `,
      description: `\n ${input.description} \n`,
    });
    expect(response.status).toBe(201);
    expect(response.headers.location).toBe(`/api/reports/${response.body.data.id}`);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.data).toMatchObject({
      ...input,
      reporterId: users.a.id,
      status: 'pending',
      version: 1,
    });
    expect(Object.keys(response.body.data).sort()).toEqual([
      'createdAt',
      'description',
      'id',
      'name',
      'reporterId',
      'status',
      'updatedAt',
      'version',
    ]);
    const stored = await prisma.report.findUniqueOrThrow({
      where: { id: response.body.data.id },
    });
    expect(stored).toMatchObject({
      ...input,
      reporterId: users.a.id,
      status: 'pending',
      version: 1,
    });
    expect(stored.updatedAt).toEqual(stored.createdAt);
    const detail = await request(app)
      .get(`/api/reports/${response.body.data.id}`)
      .set('Cookie', cookies.a);
    expect(detail.body).toEqual(response.body);
  });

  it('accepts the maximum lengths including multibyte and escaped JSON characters', async () => {
    const response = await submit({
      name: '界'.repeat(150),
      description: '\u0001'.repeat(5000),
    });
    expect(response.status).toBe(201);
    expect(response.body.data.description).toHaveLength(5000);
  });

  it.each([
    {},
    { name: '', description: 'Details' },
    { name: ' \n\t ', description: 'Details' },
    { name: 'Report', description: ' \n\t ' },
    { name: 'x'.repeat(151), description: 'Details' },
    { name: 'Report', description: 'x'.repeat(5001) },
    { name: 123, description: 'Details' },
    { name: 'Report', description: null },
  ])('rejects invalid content %# without inserting a report', async (body) => {
    const response = await submit(body);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_INPUT');
    expect(await prisma.report.count()).toBe(0);
  });

  it.each(['reporterId', 'status', 'version', 'createdAt', 'id', 'role'])(
    'rejects the forged field %s',
    async (field) => {
      const response = await submit({ ...input, [field]: 'forged' });
      expect(response.status).toBe(400);
      expect(await prisma.report.count()).toBe(0);
    },
  );

  it.each(['admin', 'approver'] as const)('denies creation by %s', async (role) => {
    expect((await submit(input, role)).status).toBe(403);
    expect(await prisma.report.count()).toBe(0);
  });

  it('requires the configured Origin for creation', async () => {
    const response = await request(app)
      .post('/api/reports')
      .set('Cookie', cookies.a)
      .send(input);
    expect(response.status).toBe(403);
    expect(await prisma.report.count()).toBe(0);
  });

  it('enforces the request size limit', async () => {
    const response = await submit({ ...input, description: 'x'.repeat(70_000) });
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('report read boundaries', () => {
  it('isolates both reporters and sorts by createdAt then id descending', async () => {
    const old = await fixture(users.a.id, new Date('2026-10-01T00:00:00Z'));
    const recentA = await fixture(users.a.id, new Date('2026-10-02T00:00:00Z'));
    const recentB = await fixture(users.a.id, new Date('2026-10-02T00:00:00Z'));
    const foreign = await fixture(users.b.id);
    const response = await request(app)
      .get('/api/reports?reporterId=' + users.b.id)
      .set('Cookie', cookies.a);
    const expected = [recentA.id, recentB.id].sort().reverse();
    expect(response.status).toBe(200);
    expect(response.body.data.map((report: { id: string }) => report.id)).toEqual([
      ...expected,
      old.id,
    ]);
    expect(response.headers['cache-control']).toBe('no-store');
    const other = await request(app).get('/api/reports').set('Cookie', cookies.b);
    expect(other.body.data.map((report: { id: string }) => report.id)).toEqual([
      foreign.id,
    ]);
  });

  it('returns the same 404 for foreign and nonexistent reports', async () => {
    const report = await fixture(users.b.id);
    const foreign = await request(app)
      .get(`/api/reports/${report.id}`)
      .set('Cookie', cookies.a);
    const missing = await request(app)
      .get(`/api/reports/${randomUUID()}`)
      .set('Cookie', cookies.a);
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
  });

  it('lets Approvers read every report without exposing account fields', async () => {
    const first = await fixture();
    const second = await fixture(users.b.id);
    const list = await request(app).get('/api/reports').set('Cookie', cookies.approver);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(2);
    for (const report of [first, second]) {
      const detail = await request(app)
        .get(`/api/reports/${report.id}`)
        .set('Cookie', cookies.approver);
      expect(detail.status).toBe(200);
      expect(detail.body.data.reporterId).toBe(report.reporterId);
      expect(detail.text).not.toMatch(/passwordHash|tokenHash|sessions/);
    }
  });

  it('returns an empty array when the Reporter has no reports', async () => {
    expect(
      (await request(app).get('/api/reports').set('Cookie', cookies.a)).body,
    ).toEqual({ data: [] });
  });

  it('rejects invalid UUIDs', async () => {
    const response = await request(app)
      .get('/api/reports/invalid')
      .set('Cookie', cookies.a);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_REPORT_ID');
  });

  it('denies Admin access to lists and details', async () => {
    const report = await fixture();
    for (const path of ['/api/reports', `/api/reports/${report.id}`]) {
      expect((await request(app).get(path).set('Cookie', cookies.admin)).status).toBe(
        403,
      );
    }
  });

  it('requires authentication for every report endpoint', async () => {
    const report = await fixture();
    expect((await request(app).get('/api/reports')).status).toBe(401);
    expect((await request(app).get(`/api/reports/${report.id}`)).status).toBe(401);
    expect(
      (await request(app).post('/api/reports').set('Origin', origin).send(input)).status,
    ).toBe(401);
  });

  it('does not provide editing or deletion endpoints in Slice 2', async () => {
    const report = await fixture();
    for (const method of ['patch', 'delete'] as const) {
      const client = request(app);
      const response = await client[method](`/api/reports/${report.id}`)
        .set('Origin', origin)
        .set('Cookie', cookies.a)
        .send({ name: 'Changed' });
      expect(response.status).toBe(404);
    }
    expect(
      (await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).name,
    ).toBe(input.name);
  });

  it('enforces report constraints and preserves referenced users at the database boundary', async () => {
    const report = await fixture();
    await expect(prisma.user.delete({ where: { id: users.a.id } })).rejects.toThrow();
    await expect(
      prisma.report.update({ where: { id: report.id }, data: { version: 0 } }),
    ).rejects.toThrow();
    await expect(
      prisma.report.update({ where: { id: report.id }, data: { name: ' ' } }),
    ).rejects.toThrow();
  });
});
