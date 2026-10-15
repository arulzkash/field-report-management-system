import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import { safeUserSelect, type SafeUser } from '../auth/auth.types.js';
import { hashPassword } from '../auth/password.js';
import type { CreateUserInput } from './user.validation.js';

export async function createUser(
  prisma: PrismaClient,
  input: CreateUserInput,
): Promise<SafeUser> {
  const passwordHash = await hashPassword(input.password);

  try {
    return await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
      },
      select: safeUserSelect,
    });
  } catch (error) {
    // The unique constraint also handles two Admin requests racing for an email.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(
        409,
        'EMAIL_EXISTS',
        'An account with this email already exists.',
      );
    }

    throw error;
  }
}
