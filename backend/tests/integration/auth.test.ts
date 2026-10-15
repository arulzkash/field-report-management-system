import { createHash } from 'node:crypto';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import request, { type Response } from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { readEnvironment } from '../../src/config/env.js';
import { createPrismaClient } from '../../src/db/prisma.js';
import { authenticate } from '../../src/middleware/authenticate.js';
import { authorize } from '../../src/middleware/authorize.js';
import { errorHandler } from '../../src/middleware/error-handler.js';
import { readDemoPasswords, seedDemoUsers } from '../../src/modules/auth/demo-users.js';
import { SESSION_COOKIE_NAME } from '../../src/modules/auth/session.js';
import { loadTestDatabaseUrl, migrateTestDatabase } from '../helpers/test-database.js';

const testUrl = loadTestDatabaseUrl();
const prisma = createPrismaClient(testUrl);
const origin = 'http://localhost:5173';
const environment = readEnvironment({
  DATABASE_URL: testUrl,
  NODE_ENV: 'test',
  APP_ORIGIN: origin,
});
const passwords = readDemoPasswords({
  SEED_ADMIN_PASSWORD: 'Admin-Local-Test-2026!',
  SEED_PELAPOR_PASSWORD: 'Reporter-Local-Test-2026!',
  SEED_APPROVER_PASSWORD: 'Approver-Local-Test-2026!',
});
const accounts = [
  { email: 'admin@demo.local', role: 'admin', password: passwords.SEED_ADMIN_PASSWORD },
  {
    email: 'reporter@demo.local',
    role: 'pelapor',
    password: passwords.SEED_PELAPOR_PASSWORD,
  },
  {
    email: 'approver@demo.local',
    role: 'approver',
    password: passwords.SEED_APPROVER_PASSWORD,
  },
];

let app: Express;

function login(email = accounts[0]!.email, password = accounts[0]!.password) {
  return request(app)
    .post('/api/auth/login')
    .set('Origin', origin)
    .send({ email, password });
}

function sessionCookie(response: Response): string {
  const values = response.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = values?.[0]?.split(';')[0];

  if (!cookie) {
    throw new Error('Expected a session cookie.');
  }

  return cookie;
}

beforeAll(async () => {
  migrateTestDatabase(testUrl);
  await prisma.session.deleteMany();
  await prisma.report.deleteMany();
  await prisma.user.deleteMany();
  await seedDemoUsers(prisma, passwords);
}, 60_000);

beforeEach(async () => {
  await prisma.session.deleteMany();
  app = createApp({ prisma, environment });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('session authentication', () => {
  it.each(accounts)(
    'logs in $role and restores the session through /me',
    async (account) => {
      const response = await login(account.email, account.password);

      expect(response.status).toBe(200);
      expect(response.body.data.role).toBe(account.role);
      expect(Object.keys(response.body.data).sort()).toEqual([
        'email',
        'id',
        'name',
        'role',
      ]);
      expect(response.headers['cache-control']).toBe('no-store');

      const me = await request(app)
        .get('/api/auth/me')
        .set('Cookie', sessionCookie(response));

      expect(me.status).toBe(200);
      expect(me.body).toEqual(response.body);
      expect(me.text).not.toContain('passwordHash');
      expect(me.text).not.toContain('tokenHash');
    },
  );

  it('normalizes email whitespace and capitalization', async () => {
    const response = await login('  ADMIN@DEMO.LOCAL  ');

    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe('admin@demo.local');
  });

  it('uses the same credential error for unknown accounts and wrong passwords', async () => {
    const wrong = await login('admin@demo.local', 'incorrect-password');
    const unknown = await login('missing@demo.local', 'incorrect-password');

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.headers['set-cookie']).toBeUndefined();
    expect(await prisma.session.count()).toBe(0);
  });

  it('sets bounded HttpOnly SameSite cookies and stores only a token hash', async () => {
    const response = await login();
    const header = (response.headers['set-cookie'] as unknown as string[])[0]!;
    const token = sessionCookie(response).split('=')[1]!;
    const stored = await prisma.session.findFirstOrThrow();

    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Path=/');
    expect(header).toContain('Max-Age=28800');
    expect(header).not.toContain('Secure');
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.expiresAt.getTime() - Date.now()).toBeGreaterThan(7.9 * 60 * 60 * 1000);
    expect(response.text).not.toContain(token);
  });

  it('adds Secure for production cookies', async () => {
    app = createApp({ prisma, environment: { ...environment, NODE_ENV: 'production' } });
    const response = await login();

    expect(response.status).toBe(200);
    expect((response.headers['set-cookie'] as unknown as string[])[0]).toContain(
      'Secure',
    );
  });

  it('denies missing, forged, and malformed sessions', async () => {
    for (const cookie of [
      '',
      `${SESSION_COOKIE_NAME}=${'f'.repeat(64)}`,
      `${SESSION_COOKIE_NAME}=broken`,
    ]) {
      const response = await request(app).get('/api/auth/me').set('Cookie', cookie);

      expect(response.status).toBe(401);
    }
  });

  it('denies an expired database session', async () => {
    const response = await login();
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const expired = await request(app)
      .get('/api/auth/me')
      .set('Cookie', sessionCookie(response));

    expect(expired.status).toBe(401);
  });

  it('revokes the stored session on logout, including cookie replay', async () => {
    const response = await login();
    const cookie = sessionCookie(response);
    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({});

    expect(logout.status).toBe(200);
    expect((logout.headers['set-cookie'] as unknown as string[])[0]).toContain(
      'Expires=Thu, 01 Jan 1970',
    );
    expect(await prisma.session.count()).toBe(0);
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(
      401,
    );
  });

  it('rotates and revokes a previous browser session on login', async () => {
    const first = await login();
    const second = await login().set('Cookie', sessionCookie(first));

    expect(second.status).toBe(200);
    expect(sessionCookie(second)).not.toBe(sessionCookie(first));
    expect(await prisma.session.count()).toBe(1);
    expect(
      (await request(app).get('/api/auth/me').set('Cookie', sessionCookie(first))).status,
    ).toBe(401);
  });

  it('cleans expired sessions during a successful login', async () => {
    await login();
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await login();

    expect(await prisma.session.count()).toBe(1);
  });

  it.each(['', 'null', 'https://untrusted.example', `${origin}/reports`])(
    'rejects an invalid login Origin: %s',
    async (invalidOrigin) => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Origin', invalidOrigin)
        .send({ email: accounts[0]!.email, password: accounts[0]!.password });

      expect(response.status).toBe(403);
      expect(await prisma.session.count()).toBe(0);
    },
  );

  it('rejects a logout from an untrusted origin without revoking the session', async () => {
    const response = await login();
    const rejected = await request(app)
      .post('/api/auth/logout')
      .set('Origin', 'https://untrusted.example')
      .set('Cookie', sessionCookie(response))
      .send({});

    expect(rejected.status).toBe(403);
    expect(await prisma.session.count()).toBe(1);
  });

  it('requires JSON for mutations', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Origin', origin)
      .type('form')
      .send({ email: 'admin@demo.local', password: 'anything' });

    expect(response.status).toBe(415);
  });

  it('rejects unexpected login fields instead of trusting a supplied role', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({
        email: accounts[0]!.email,
        password: accounts[0]!.password,
        role: 'admin',
      });

    expect(response.status).toBe(400);
  });

  it('rate-limits repeated failed login attempts', async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await login('missing@demo.local', 'incorrect-password')).status).toBe(401);
    }

    const limited = await login();

    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('LOGIN_RATE_LIMITED');
    expect(limited.headers['retry-after']).toBeDefined();
    expect(await prisma.session.count()).toBe(0);
  });

  it('has no public registration endpoint', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({});

    expect(response.status).toBe(404);
  });
});

describe('role middleware with a real session database', () => {
  function protectedApp() {
    const harness = express();
    harness.use(cookieParser());
    harness.get('/admin', authenticate(prisma), authorize('admin'), (_req, res) => {
      res.json({ data: { allowed: true } });
    });
    harness.use(errorHandler);

    return harness;
  }

  it.each(accounts)('enforces Admin-only access for $role', async (account) => {
    const response = await login(account.email, account.password);
    const result = await request(protectedApp())
      .get('/admin')
      .set('Cookie', sessionCookie(response));

    expect(result.status).toBe(account.role === 'admin' ? 200 : 403);
  });

  it('returns 401 before checking roles for anonymous requests', async () => {
    expect((await request(protectedApp()).get('/admin')).status).toBe(401);
  });

  it('uses the current database role rather than a stale session role', async () => {
    const response = await login();
    await prisma.user.update({
      where: { email: 'admin@demo.local' },
      data: { role: 'approver' },
    });

    try {
      expect(
        (
          await request(protectedApp())
            .get('/admin')
            .set('Cookie', sessionCookie(response))
        ).status,
      ).toBe(403);
    } finally {
      await prisma.user.update({
        where: { email: 'admin@demo.local' },
        data: { role: 'admin' },
      });
    }
  });
});

describe('demo seed', () => {
  it('preserves IDs, existing names, and password hashes on reruns', async () => {
    await prisma.user.update({
      where: { email: 'admin@demo.local' },
      data: { name: 'Preserved name' },
    });
    const before = await prisma.user.findMany({ orderBy: { email: 'asc' } });

    await seedDemoUsers(prisma, passwords);

    expect(await prisma.user.findMany({ orderBy: { email: 'asc' } })).toEqual(before);
    expect(await prisma.user.count()).toBe(3);
  });

  it('rejects different seed passwords without modifying existing accounts', async () => {
    const before = await prisma.user.findMany({ orderBy: { email: 'asc' } });

    await expect(
      seedDemoUsers(prisma, {
        ...passwords,
        SEED_ADMIN_PASSWORD: 'Different-Demo-Password!',
      }),
    ).rejects.toThrow('different');

    expect(await prisma.user.findMany({ orderBy: { email: 'asc' } })).toEqual(before);
  });

  it('validates every seed password before use', () => {
    expect(() => readDemoPasswords({})).toThrow('12-72');
    expect(() =>
      readDemoPasswords({ ...passwords, SEED_ADMIN_PASSWORD: 'short' }),
    ).toThrow('12-72');
    expect(() =>
      readDemoPasswords({ ...passwords, SEED_ADMIN_PASSWORD: 'x'.repeat(73) }),
    ).toThrow('12-72');
  });
});
