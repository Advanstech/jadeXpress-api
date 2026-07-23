import { z } from 'zod';

export const PlQuerySchema = z.object({
  storeId: z.string().uuid(),
  periodType: z.enum(['daily', 'weekly', 'monthly']).default('monthly'),
  from: z.string().date(),
  to: z.string().date(),
});

export const ExportSchema = z.object({
  storeId: z.string().uuid(),
  from: z.string().date(),
  to: z.string().date(),
  format: z.enum(['json', 'csv']).default('json'),
});

export const SnapshotSchema = z.object({
  storeId: z.string().uuid(),
  date: z.string().date(),
});

export type PlQueryDto = z.infer<typeof PlQuerySchema>;
export type ExportDto = z.infer<typeof ExportSchema>;
export type SnapshotDto = z.infer<typeof SnapshotSchema>;
