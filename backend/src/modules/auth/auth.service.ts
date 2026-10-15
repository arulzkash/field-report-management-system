import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import { safeUserSelect, type SafeUser } from './auth.types.js';
import type { LoginInput } from './auth.validation.js';
import { hashPassword, verifyPassword } from './password.js';
import { hashSessionToken, SESSION_LIFETIME_MS } from './session.js';

// Unknown accounts still perform password verification to reduce timing differences.
const dummyPasswordHash = hashPassword(randomBytes(32).toString('hex'));

type LoginResult = {
  user: SafeUser;
  token: string;
};

export async function login(
  prisma: PrismaClient,
  input: LoginInput,
  previousToken?: string,
): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...safeUserSelect, passwordHash: true },
  });
  const matches = await verifyPassword(
    input.password,
    user?.passwordHash ?? (await dummyPasswordHash),
  );

  if (!user || !matches) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  const token = randomBytes(32).toString('hex');
  const now = new Date();
  const cleanupConditions = [{ expiresAt: { lte: now } }];

  await prisma.$transaction(async (transaction) => {
    await transaction.session.deleteMany({
      where: {
        OR: [
          ...cleanupConditions,
          ...(previousToken ? [{ tokenHash: hashSessionToken(previousToken) }] : []),
        ],
      },
    });
    await transaction.session.create({
      data: {
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS),
      },
    });
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

export async function logout(prisma: PrismaClient, sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}
