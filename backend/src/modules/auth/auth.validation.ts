import { z } from 'zod';

export const passwordSchema = z
  .string()
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') >= 12,
    'This password is too short. Try a longer password or a short phrase.',
  )
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') <= 72,
    'This password is too long. Try a shorter phrase.',
  );

export const loginSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z
    .string()
    .min(1)
    .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password is too long.'),
});

export type LoginInput = z.infer<typeof loginSchema>;
