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
  approverB: { id: randomUUID(), role: 'approver' },
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
  await prisma.approvalHistory.deleteMany();
  await prisma.report.deleteMany();
  await prisma.user.deleteMany();
  const passwordHash = await hashPassword('Report-Test-Password-2026!');

  await prisma.user.createMany({
    data: Object.entries(users).map(([name, user]) => ({
      ...user,
      name,
      email: `${name.toLowerCase()}@reports.test`,
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
  await prisma.approvalHistory.deleteMany();
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

function edit(id: string, body: object, actor: keyof typeof users = 'a') {
  return request(app)
    .patch(`/api/reports/${id}`)
    .set('Origin', origin)
    .set('Cookie', cookies[actor])
    .send(body);
}

async function fixture(reporterId = users.a.id, createdAt = new Date()) {
  return prisma.report.create({ data: { ...input, reporterId, createdAt } });
}

function decide(id: string, body: object, actor: keyof typeof users = 'approver') {
  return request(app)
    .patch(`/api/reports/${id}/status`)
    .set('Origin', origin)
    .set('Cookie', cookies[actor])
    .send(body);
}

describe('report decisions and atomic history', () => {
  it.each([
    ['pending', 'approved'],
    ['pending', 'rejected'],
    ['approved', 'rejected'],
    ['rejected', 'approved'],
  ] as const)(
    'commits %s to %s with the authenticated actor and server timestamp',
    async (fromStatus, status) => {
      const report = await fixture();
      await prisma.report.update({
        where: { id: report.id },
        data: { status: fromStatus },
      });
      const before = Date.now();
      const response = await decide(report.id, { status, version: 1 });
      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body.data).toMatchObject({
        ...input,
        id: report.id,
        reporterId: users.a.id,
        status,
        version: 2,
        createdAt: report.createdAt.toISOString(),
      });
      const history = await prisma.approvalHistory.findMany({
        where: { reportId: report.id },
      });
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        reportId: report.id,
        approverId: users.approver.id,
        fromStatus,
        toStatus: status,
        reportVersion: 2,
      });
      expect(history[0]!.decidedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(history[0]!.decidedAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
      expect(response.text).not.toMatch(/passwordHash|tokenHash|sessions/);
      const stored = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
      expect(response.body.data.updatedAt).toBe(stored.updatedAt.toISOString());
    },
  );

  it('preserves every decision through reversals by different Approvers', async () => {
    const report = await fixture();
    expect((await decide(report.id, { status: 'approved', version: 1 })).status).toBe(
      200,
    );
    expect(
      (await decide(report.id, { status: 'rejected', version: 2 }, 'approverB')).status,
    ).toBe(200);
    const response = await decide(report.id, { status: 'approved', version: 3 });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: 'approved', version: 4 });
    const history = await prisma.approvalHistory.findMany({
      where: { reportId: report.id },
      orderBy: { reportVersion: 'asc' },
    });
    expect(
      history.map(({ fromStatus, toStatus, reportVersion, approverId }) => ({
        fromStatus,
        toStatus,
        reportVersion,
        approverId,
      })),
    ).toEqual([
      {
        fromStatus: 'pending',
        toStatus: 'approved',
        reportVersion: 2,
        approverId: users.approver.id,
      },
      {
        fromStatus: 'approved',
        toStatus: 'rejected',
        reportVersion: 3,
        approverId: users.approverB.id,
      },
      {
        fromStatus: 'rejected',
        toStatus: 'approved',
        reportVersion: 4,
        approverId: users.approver.id,
      },
    ]);
  });

  it.each(['approved', 'rejected'] as const)(
    'rejects repeating %s without adding history or updating timestamps',
    async (status) => {
      const report = await fixture();
      await decide(report.id, { status, version: 1 });
      const before = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
      const response = await decide(report.id, { status, version: 2 });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('REPORT_DECISION_CONFLICT');
      expect(await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).toEqual(
        before,
      );
      expect(await prisma.approvalHistory.count()).toBe(1);
    },
  );

  it('rejects stale reversals without changing the committed decision', async () => {
    const report = await fixture();
    await decide(report.id, { status: 'approved', version: 1 });
    const response = await decide(report.id, { status: 'rejected', version: 1 });
    expect(response.status).toBe(409);
    expect(
      await prisma.report.findUniqueOrThrow({ where: { id: report.id } }),
    ).toMatchObject({ status: 'approved', version: 2 });
    expect(await prisma.approvalHistory.count()).toBe(1);
  });

  it('commits only one concurrent decision and one matching history entry', async () => {
    const report = await fixture();
    const responses = await Promise.all([
      decide(report.id, { status: 'approved', version: 1 }),
      decide(report.id, { status: 'rejected', version: 1 }, 'approverB'),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const winner = responses.findIndex((response) => response.status === 200);
    const stored = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    const history = await prisma.approvalHistory.findMany();
    expect(stored).toMatchObject({
      status: winner === 0 ? 'approved' : 'rejected',
      version: 2,
    });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      toStatus: stored.status,
      reportVersion: 2,
      approverId: winner === 0 ? users.approver.id : users.approverB.id,
    });
  });

  it('resolves edit versus approval without losing content or decision history', async () => {
    const report = await fixture();
    const responses = await Promise.all([
      edit(report.id, {
        name: 'Corrected observation',
        description: 'Corrected details',
        version: 1,
      }),
      decide(report.id, { status: 'approved', version: 1 }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const stored = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    expect(stored.version).toBe(2);
    if (responses[0]!.status === 200) {
      expect(stored).toMatchObject({
        name: 'Corrected observation',
        description: 'Corrected details',
        status: 'pending',
      });
      expect(await prisma.approvalHistory.count()).toBe(0);
      expect((await decide(report.id, { status: 'approved', version: 2 })).status).toBe(
        200,
      );
      expect(await prisma.approvalHistory.findFirstOrThrow()).toMatchObject({
        reportVersion: 3,
      });
    } else {
      expect(stored).toMatchObject({ ...input, status: 'approved' });
      expect(await prisma.approvalHistory.count()).toBe(1);
      expect((await edit(report.id, { ...input, version: 2 })).status).toBe(409);
    }
  });

  it.each(['approved', 'rejected'] as const)(
    'blocks Reporter edits after an actual %s decision',
    async (status) => {
      const report = await fixture();
      expect((await decide(report.id, { status, version: 1 })).status).toBe(200);
      const decided = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
      const history = await prisma.approvalHistory.findMany();
      const response = await edit(report.id, {
        name: 'Disallowed edit',
        description: 'Do not overwrite',
        version: 2,
      });
      expect(response.status).toBe(409);
      expect(await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).toEqual(
        decided,
      );
      expect(await prisma.approvalHistory.findMany()).toEqual(history);
    },
  );

  it('rolls back status, version, and updatedAt when the history insert fails', async () => {
    const report = await fixture();
    // Occupy the next history version only in this disposable database. The
    // real insert then fails after the transaction's update, proving rollback.
    await prisma.approvalHistory.create({
      data: {
        reportId: report.id,
        approverId: users.approver.id,
        fromStatus: 'pending',
        toStatus: 'approved',
        reportVersion: 2,
      },
    });
    const beforeHistory = await prisma.approvalHistory.findMany();
    const response = await decide(report.id, { status: 'rejected', version: 1 });
    expect(response.status).toBe(500);
    expect(response.text).not.toMatch(/prisma|constraint|postgresql|stack/i);
    expect(await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).toEqual(
      report,
    );
    expect(await prisma.approvalHistory.findMany()).toEqual(beforeHistory);
  });

  it.each(['a', 'b', 'admin'] as const)('denies decisions by %s', async (actor) => {
    const report = await fixture();
    expect(
      (await decide(report.id, { status: 'approved', version: 1 }, actor)).status,
    ).toBe(403);
    expect(await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).toEqual(
      report,
    );
    expect(await prisma.approvalHistory.count()).toBe(0);
  });

  it.each([
    { status: 'pending', version: 1 },
    { status: 'unknown', version: 1 },
    { status: 'approved' },
    { status: 'approved', version: 0 },
    { status: 'approved', version: -1 },
    { status: 'approved', version: 1.5 },
    { status: 'approved', version: '1' },
    { status: 'approved', version: 2_147_483_647 },
  ])('rejects invalid decision payload %#', async (body) => {
    const report = await fixture();
    expect((await decide(report.id, body)).status).toBe(400);
    expect(await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).toEqual(
      report,
    );
    expect(await prisma.approvalHistory.count()).toBe(0);
  });

  it.each([
    'approverId',
    'decidedAt',
    'reportVersion',
    'reporterId',
    'name',
    'fromStatus',
  ])('rejects forged decision field %s', async (field) => {
    const report = await fixture();
    expect(
      (await decide(report.id, { status: 'approved', version: 1, [field]: 'forged' }))
        .status,
    ).toBe(400);
    expect(await prisma.approvalHistory.count()).toBe(0);
    expect(await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).toEqual(
      report,
    );
  });

  it('returns 404 for missing reports and 400 for invalid IDs', async () => {
    expect((await decide(randomUUID(), { status: 'approved', version: 1 })).status).toBe(
      404,
    );
    expect((await decide('invalid', { status: 'approved', version: 1 })).status).toBe(
      400,
    );
    expect(await prisma.approvalHistory.count()).toBe(0);
  });

  it('requires authentication, the configured Origin, and JSON', async () => {
    const report = await fixture();
    const path = `/api/reports/${report.id}/status`;
    const anonymous = await request(app)
      .patch(path)
      .set('Origin', origin)
      .send({ status: 'approved', version: 1 });
    const originless = await request(app)
      .patch(path)
      .set('Cookie', cookies.approver)
      .send({ status: 'approved', version: 1 });
    const text = await request(app)
      .patch(path)
      .set('Cookie', cookies.approver)
      .set('Origin', origin)
      .set('Content-Type', 'text/plain')
      .send('status=approved');
    expect([anonymous.status, originless.status, text.status]).toEqual([401, 403, 415]);
    expect(await prisma.approvalHistory.count()).toBe(0);
  });

  it('protects history relationships and transition constraints in PostgreSQL', async () => {
    const report = await fixture();
    await decide(report.id, { status: 'approved', version: 1 });
    await expect(prisma.report.delete({ where: { id: report.id } })).rejects.toThrow();
    await expect(
      prisma.user.delete({ where: { id: users.approver.id } }),
    ).rejects.toThrow();
    const data = {
      reportId: report.id,
      approverId: users.approver.id,
      fromStatus: 'approved' as const,
      toStatus: 'pending' as const,
      reportVersion: 3,
    };
    await expect(prisma.approvalHistory.create({ data })).rejects.toThrow();
    await expect(
      prisma.approvalHistory.create({ data: { ...data, toStatus: 'approved' } }),
    ).rejects.toThrow();
    await expect(
      prisma.approvalHistory.create({
        data: { ...data, toStatus: 'rejected', reportVersion: 1 },
      }),
    ).rejects.toThrow();
  });
});

describe('editing own pending reports', () => {
  it('saves trimmed content, increments version, and preserves server-owned fields', async () => {
    const report = await fixture(users.a.id, new Date('2026-10-01T00:00:00Z'));
    const response = await edit(report.id, {
      name: '  Updated observation  ',
      description: '\nUpdated details\nSecond line.  ',
      version: report.version,
    });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.data).toMatchObject({
      id: report.id,
      name: 'Updated observation',
      description: 'Updated details\nSecond line.',
      status: 'pending',
      reporterId: users.a.id,
      version: 2,
      createdAt: report.createdAt.toISOString(),
    });
    const stored = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    expect(stored.version).toBe(2);
    expect(stored.updatedAt.getTime()).toBeGreaterThan(report.updatedAt.getTime());
    const detail = await request(app)
      .get(`/api/reports/${report.id}`)
      .set('Cookie', cookies.a);
    expect(detail.body).toEqual(response.body);
  });

  it('allows subsequent edits with the latest version', async () => {
    const report = await fixture();
    expect((await edit(report.id, { ...input, version: 1 })).status).toBe(200);
    const response = await edit(report.id, { ...input, name: 'Second edit', version: 2 });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      name: 'Second edit',
      version: 3,
      status: 'pending',
    });
  });

  it('returns identical 404 responses for another owner and a missing report', async () => {
    const report = await fixture(users.b.id);
    const foreign = await edit(report.id, { ...input, version: 1 });
    const missing = await edit(randomUUID(), { ...input, version: 1 });
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
    expect(await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).toEqual(
      report,
    );
  });

  it.each(['admin', 'approver'] as const)('denies edits by %s', async (role) => {
    const report = await fixture();
    expect((await edit(report.id, { ...input, version: 1 }, role)).status).toBe(403);
    expect(await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).toEqual(
      report,
    );
  });

  it.each(['approved', 'rejected'] as const)(
    'rejects edits to %s reports even with the current version',
    async (status) => {
      const report = await fixture();
      const decided = await prisma.report.update({
        where: { id: report.id },
        data: { status, version: 2 },
      });
      const response = await edit(report.id, {
        name: 'Forbidden edit',
        description: 'No overwrite',
        version: 2,
      });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('REPORT_EDIT_CONFLICT');
      expect(await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).toEqual(
        decided,
      );
    },
  );

  it('rejects a stale version without changing content or timestamps', async () => {
    const report = await fixture();
    await edit(report.id, {
      name: 'First saved edit',
      description: 'Saved details',
      version: 1,
    });
    const saved = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    const response = await edit(report.id, {
      name: 'Stale edit',
      description: 'Stale details',
      version: 1,
    });
    expect(response.status).toBe(409);
    expect(await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).toEqual(
      saved,
    );
  });

  it('commits exactly one of two concurrent edits using the same version', async () => {
    const report = await fixture();
    const first = { name: 'First writer', description: 'First details', version: 1 };
    const second = { name: 'Second writer', description: 'Second details', version: 1 };
    const responses = await Promise.all([
      edit(report.id, first),
      edit(report.id, second),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const winner = responses.findIndex((response) => response.status === 200);
    const stored = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    expect(stored).toMatchObject({
      name: [first, second][winner]!.name,
      description: [first, second][winner]!.description,
      version: 2,
      status: 'pending',
    });
    expect(responses[winner]!.body.data.updatedAt).toBe(stored.updatedAt.toISOString());
  });

  it.each([
    { name: ' ', description: 'Details', version: 1 },
    { name: 'Report', description: '\n\t ', version: 1 },
    { name: 'x'.repeat(151), description: 'Details', version: 1 },
    { name: 'Report', description: 'x'.repeat(5001), version: 1 },
    { ...input },
    { ...input, version: 0 },
    { ...input, version: -1 },
    { ...input, version: 1.5 },
    { ...input, version: '1' },
    { ...input, version: 2_147_483_647 },
    { name: 'Report', version: 1 },
  ])('rejects invalid edit payload %# without writing', async (body) => {
    const report = await fixture();
    const response = await edit(report.id, body);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_INPUT');
    expect(await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).toEqual(
      report,
    );
  });

  it.each(['reporterId', 'status', 'id', 'createdAt', 'updatedAt', 'role'])(
    'rejects the forged edit field %s',
    async (field) => {
      const report = await fixture();
      const response = await edit(report.id, { ...input, version: 1, [field]: 'forged' });
      expect(response.status).toBe(400);
      expect(await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).toEqual(
        report,
      );
    },
  );

  it('requires authentication, the correct Origin, and JSON for editing', async () => {
    const report = await fixture();
    const body = { ...input, version: 1 };
    const anonymous = await request(app)
      .patch(`/api/reports/${report.id}`)
      .set('Origin', origin)
      .send(body);
    const missingOrigin = await request(app)
      .patch(`/api/reports/${report.id}`)
      .set('Cookie', cookies.a)
      .send(body);
    const textBody = await request(app)
      .patch(`/api/reports/${report.id}`)
      .set('Cookie', cookies.a)
      .set('Origin', origin)
      .set('Content-Type', 'text/plain')
      .send('name=Report');
    expect(anonymous.status).toBe(401);
    expect(missingOrigin.status).toBe(403);
    expect(textBody.status).toBe(415);
    expect(await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).toEqual(
      report,
    );
  });

  it('validates edit IDs before querying the report', async () => {
    const response = await edit('invalid-id', { ...input, version: 1 });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_REPORT_ID');
  });

  it('keeps history read endpoints deferred to Slice 5', async () => {
    const report = await fixture();
    const response = await request(app)
      .get(`/api/reports/${report.id}/history`)
      .set('Cookie', cookies.approver);
    expect(response.status).toBe(404);
  });
});

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

  it('does not provide a deletion endpoint', async () => {
    const report = await fixture();
    const response = await request(app)
      .delete(`/api/reports/${report.id}`)
      .set('Origin', origin)
      .set('Cookie', cookies.a)
      .send({});
    expect(response.status).toBe(404);
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
