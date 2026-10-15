import { z } from 'zod';
import { loginSchema, passwordSchema } from '../auth/auth.validation.js';

export const createUserSchema = z.strictObject({
  name: z.string().trim().min(1).max(150),
  email: loginSchema.shape.email,
  password: passwordSchema,
  role: z.enum(['admin', 'pelapor', 'approver']),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
