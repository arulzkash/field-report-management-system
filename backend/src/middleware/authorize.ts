import type { RequestHandler } from 'express';
import type { Role } from '../generated/prisma/client.js';
import { HttpError } from '../lib/http-error.js';

export function authorize(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in to continue.');
    }

    if (!roles.includes(req.auth.user.role)) {
      throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this resource.');
    }

    next();
  };
}
