import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import { createUser } from './user.service.js';
import { createUserSchema } from './user.validation.js';

export function createUserController(prisma: PrismaClient): RequestHandler {
  return async (req, res) => {
    const input = createUserSchema.safeParse(req.body);

    if (!input.success) {
      throw new HttpError(
        400,
        'INVALID_INPUT',
        'Check the name, email, password, and role. Only these four fields are accepted.',
        z.flattenError(input.error).fieldErrors,
      );
    }

    const user = await createUser(prisma, input.data);
    res.status(201).json({ data: user });
  };
}
