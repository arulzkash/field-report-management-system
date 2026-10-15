import { createHash } from 'node:crypto';
import type { CookieOptions, Request } from 'express';

export const SESSION_COOKIE_NAME = 'field_report_session';
export const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function readSessionToken(request: Request): string | undefined {
  const token: unknown = request.cookies?.[SESSION_COOKIE_NAME];

  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    return undefined;
  }

  return token;
}

export function sessionCookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  };
}
