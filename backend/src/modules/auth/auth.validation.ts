import { z } from 'zod';

export const demoPasswordSchema = z.string().refine((value) => {
  const length = Buffer.byteLength(value, 'utf8');

  return length >= 12 && length <= 72;
}, 'Password must contain 12-72 UTF-8 bytes.');

export const loginSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z
    .string()
    .min(1)
    .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password is too long.'),
});

export type LoginInput = z.infer<typeof loginSchema>;
