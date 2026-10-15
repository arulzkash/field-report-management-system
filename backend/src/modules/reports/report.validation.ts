import { z } from 'zod';

export const createReportSchema = z.strictObject({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().min(1).max(5000),
});

export const reportIdSchema = z.uuid();

// Reserve room for the next version in PostgreSQL's signed integer column.
const reportVersionSchema = z.number().int().min(1).max(2_147_483_646);

export const editReportSchema = createReportSchema.extend({
  version: reportVersionSchema,
});

export const reportDecisionSchema = z.strictObject({
  status: z.enum(['approved', 'rejected']),
  version: reportVersionSchema,
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type EditReportInput = z.infer<typeof editReportSchema>;
export type ReportDecisionInput = z.infer<typeof reportDecisionSchema>;
