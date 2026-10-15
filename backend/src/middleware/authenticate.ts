import type { RequestHandler } from 'express';
import type { PrismaClient } from '../generated/prisma/client.js';
import { HttpError } from '../lib/http-error.js';
import { safeUserSelect } from '../modules/auth/auth.types.js';
import { hashSessionToken, readSessionToken } from '../modules/auth/session.js';

export function authenticate(prisma: PrismaClient): RequestHandler {
  return async (req, _res, next) => {
    const token = readSessionToken(req);

    if (!token) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in to continue.');
    }

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      select: {
        id: true,
        expiresAt: true,
        user: { select: safeUserSelect },
      },
    });

    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in to continue.');
    }

    req.auth = { sessionId: session.id, user: session.user };
    next();
  };
}
