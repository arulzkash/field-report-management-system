import { z } from 'zod';

export const createReportSchema = z.strictObject({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().min(1).max(5000),
});

export const reportIdSchema = z.uuid();

export type CreateReportInput = z.infer<typeof createReportSchema>;
