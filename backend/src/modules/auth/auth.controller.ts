import type { RequestHandler } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import * as authService from './auth.service.js';
import { loginSchema } from './auth.validation.js';
import {
  readSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_LIFETIME_MS,
  sessionCookieOptions,
} from './session.js';

export function createAuthController(prisma: PrismaClient, secureCookie: boolean) {
  const cookieOptions = sessionCookieOptions(secureCookie);

  const login: RequestHandler = async (req, res) => {
    const input = loginSchema.safeParse(req.body);

    if (!input.success) {
      throw new HttpError(400, 'INVALID_INPUT', 'Enter a valid email and password.');
    }

    const result = await authService.login(prisma, input.data, readSessionToken(req));

    res.cookie(SESSION_COOKIE_NAME, result.token, {
      ...cookieOptions,
      maxAge: SESSION_LIFETIME_MS,
    });
    res.json({ data: result.user });
  };

  const me: RequestHandler = (req, res) => {
    if (!req.auth) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in to continue.');
    }

    res.json({ data: req.auth.user });
  };

  const logout: RequestHandler = async (req, res) => {
    if (!req.auth) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in to continue.');
    }

    await authService.logout(prisma, req.auth.sessionId);
    res.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
    res.json({ data: { message: 'You have been logged out.' } });
  };

  return { login, me, logout };
}
