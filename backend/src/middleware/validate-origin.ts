import type { RequestHandler } from 'express';
import { HttpError } from '../lib/http-error.js';

export function validateOrigin(origin: string): RequestHandler {
  return (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      next();
      return;
    }

    if (req.get('Origin') !== origin) {
      throw new HttpError(403, 'INVALID_ORIGIN', 'The request origin is not allowed.');
    }

    if (!req.is('application/json')) {
      throw new HttpError(415, 'JSON_REQUIRED', 'Use application/json for this request.');
    }

    next();
  };
}
