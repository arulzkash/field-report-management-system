import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { readEnvironment } from '../../src/config/env.js';
import { createPrismaClient } from '../../src/db/prisma.js';
import { hashPassword, verifyPassword } from '../../src/modules/auth/password.js';
import { SESSION_COOKIE_NAME } from '../../src/modules/auth/session.js';
import { loadTestDatabaseUrl, migrateTestDatabase } from '../helpers/test-database.js';

const testUrl = loadTestDatabaseUrl();
const prisma = createPrismaClient(testUrl);
const origin = 'http://localhost:5173';
const actors = {
  admin: { id: randomUUID(), role: 'admin' },
  reporter: { id: randomUUID(), role: 'pelapor' },
  approver: { id: randomUUID(), role: 'approver' },
} as const;
const input = {
  name: 'New Team Member',
  email: 'member@users.test',
  password: 'New-Member-Test-2026!',
  role: 'pelapor',
};
let app: Express;
let cookies: Record<keyof typeof actors, string>;

beforeAll(async () => {
  migrateTestDatabase(testUrl);
  await prisma.approvalHistory.deleteMany();
  await prisma.report.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  const passwordHash = await hashPassword('Existing-Account-Test-2026!');
  await prisma.user.createMany({
    data: Object.entries(actors).map(([name, actor]) => ({
      id: actor.id,
      role: actor.role,
      name,
      email: `${name}@users.test`,
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
  await prisma.session.deleteMany();
  await prisma.user.deleteMany({
    where: { id: { notIn: Object.values(actors).map((actor) => actor.id) } },
  });
  cookies = {} as Record<keyof typeof actors, string>;
  for (const key of Object.keys(actors) as (keyof typeof actors)[]) {
    const token = randomBytes(32).toString('hex');
    await prisma.session.create({
      data: {
        userId: actors[key].id,
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

function create(body: object = input, actor: keyof typeof actors = 'admin') {
  return request(app)
    .post('/api/users')
    .set('Cookie', cookies[actor])
    .set('Origin', origin)
    .send(body);
}

describe('Admin account creation', () => {
  it.each(['admin', 'pelapor', 'approver'] as const)(
    'creates %s with a hashed password and a working login',
    async (role) => {
      const response = await create({
        ...input,
        name: '  New Team Member  ',
        email: '  MEMBER@USERS.TEST  ',
        role,
      });
      expect(response.status).toBe(201);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(response.body.data).toMatchObject({
        name: input.name,
        email: input.email,
        role,
      });
      expect(Object.keys(response.body.data).sort()).toEqual([
        'email',
        'id',
        'name',
        'role',
      ]);
      expect(response.text).not.toContain(input.password);
      const stored = await prisma.user.findUniqueOrThrow({
        where: { email: input.email },
      });
      expect(stored.passwordHash).toMatch(/^\$2[ab]\$12\$/);
      expect(await verifyPassword(input.password, stored.passwordHash)).toBe(true);
      const login = await request(app)
        .post('/api/auth/login')
        .set('Origin', origin)
        .send({ email: input.email, password: input.password });
      expect(login.status).toBe(200);
      expect(login.body.data).toEqual(response.body.data);
      const cookie = (login.headers['set-cookie'] as unknown as string[])[0]!.split(
        ';',
      )[0]!;
      const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
      expect(me.status).toBe(200);
      expect(me.body.data).toEqual(response.body.data);
    },
  );

  it('rejects a normalized duplicate without overwriting the existing user', async () => {
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: actors.reporter.id },
    });
    const response = await create({
      ...input,
      email: '  REPORTER@USERS.TEST  ',
      role: 'admin',
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_EXISTS');
    expect(
      await prisma.user.findUniqueOrThrow({ where: { id: actors.reporter.id } }),
    ).toEqual(before);
    expect(await prisma.user.count()).toBe(3);
  });

  it('creates only one account when two requests race for the same normalized email', async () => {
    const responses = await Promise.all([
      create(input),
      create({ ...input, email: ' MEMBER@USERS.TEST ', name: 'Other request' }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await prisma.user.count({ where: { email: input.email } })).toBe(1);
  });

  it.each(['reporter', 'approver'] as const)(
    'denies account creation by %s',
    async (actor) => {
      expect((await create(input, actor)).status).toBe(403);
      expect(await prisma.user.count()).toBe(3);
    },
  );

  it('requires authentication, the configured Origin, and JSON', async () => {
    const anonymous = await request(app)
      .post('/api/users')
      .set('Origin', origin)
      .send(input);
    const originless = await request(app)
      .post('/api/users')
      .set('Cookie', cookies.admin)
      .send(input);
    const wrongOrigin = await request(app)
      .post('/api/users')
      .set('Cookie', cookies.admin)
      .set('Origin', 'http://untrusted.test')
      .send(input);
    const text = await request(app)
      .post('/api/users')
      .set('Cookie', cookies.admin)
      .set('Origin', origin)
      .set('Content-Type', 'text/plain')
      .send('role=admin');
    expect([
      anonymous.status,
      originless.status,
      wrongOrigin.status,
      text.status,
    ]).toEqual([401, 403, 403, 415]);
    expect(await prisma.user.count()).toBe(3);
  });

  it.each([
    { ...input, name: '' },
    { ...input, name: ' \n\t ' },
    { ...input, name: 'x'.repeat(151) },
    { ...input, email: 'invalid' },
    { ...input, email: 'a'.repeat(250) + '@users.test' },
    { ...input, password: '' },
    { ...input, password: 'x'.repeat(11) },
    { ...input, password: 'x'.repeat(73) },
    { ...input, password: 'é'.repeat(37) },
    { ...input, password: 123456789012 },
    { ...input, role: 'reporter' },
    { ...input, role: 'superadmin' },
    { ...input, role: null },
    { name: input.name, email: input.email, password: input.password },
  ])('rejects invalid creation payload %#', async (body) => {
    const response = await create(body);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_INPUT');
    expect(response.text).not.toContain(input.password);
    expect(await prisma.user.count()).toBe(3);
  });

  it.each(['id', 'passwordHash', 'createdAt', 'sessions'])(
    'rejects the unexpected field %s',
    async (field) => {
      expect((await create({ ...input, [field]: 'forged' })).status).toBe(400);
      expect(await prisma.user.count()).toBe(3);
    },
  );

  it.each(['x'.repeat(12), 'x'.repeat(72), '界'.repeat(4)])(
    'preserves valid boundary passwords without trimming',
    async (password) => {
      const response = await create({ ...input, password });
      expect(response.status).toBe(201);
      const login = await request(app)
        .post('/api/auth/login')
        .set('Origin', origin)
        .send({ email: input.email, password });
      expect(login.status).toBe(200);
    },
  );

  it('preserves intentional password spaces', async () => {
    const password = '  Boundary-Password-2026!  ';
    expect((await create({ ...input, password })).status).toBe(201);
    const stored = await prisma.user.findUniqueOrThrow({ where: { email: input.email } });
    expect(await verifyPassword(password, stored.passwordHash)).toBe(true);
    expect(await verifyPassword(password.trim(), stored.passwordHash)).toBe(false);
  });

  it('keeps account listing, updates, deletion, and public registration unavailable', async () => {
    expect(
      (await request(app).get('/api/users').set('Cookie', cookies.admin)).status,
    ).toBe(404);
    for (const method of ['patch', 'delete'] as const) {
      const client = request(app);
      const response = await client[method](`/api/users/${actors.reporter.id}`)
        .set('Cookie', cookies.admin)
        .set('Origin', origin)
        .send({ role: 'admin' });
      expect(response.status).toBe(404);
    }
    expect(
      (await request(app).post('/api/auth/register').set('Origin', origin).send(input))
        .status,
    ).toBe(404);
  });
});
