import { z } from 'zod';

const DenominationSchema = z.object({
  denom: z.number().int(),
  count: z.number().int().min(0),
  total: z.number().int(),
});

export const InitEodSchema = z.object({
  storeId: z.string().uuid(),
  businessDate: z.string().date(),
});

export const CloseEodSchema = z.object({
  storeId: z.string().uuid(),
  businessDate: z.string().date(),
  physicalCashCount: z.number().int().min(0),
  denominations: z.array(DenominationSchema).default([]),
  momoConfirmed: z.number().int().min(0).default(0),
  varianceNotes: z.string().optional(),
});

export type InitEodDto = z.infer<typeof InitEodSchema>;
export type CloseEodDto = z.infer<typeof CloseEodSchema>;
