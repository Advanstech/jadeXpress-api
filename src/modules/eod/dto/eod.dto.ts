import { z } from 'zod';

const DenominationSchema = z.object({
  denom: z.number().int(),
  count: z.number().int().min(0),
  total: z.number().int(),
});

export const InitEodSchema = z.object({
  storeId: z.string().uuid(),
  businessDate: z.string().date(),
  openingFloat: z.number().int().min(0).optional(),
});

export const CloseEodSchema = z.object({
  storeId: z.string().uuid(),
  businessDate: z.string().date(),
  physicalCashCount: z.number().int().min(0),
  denominations: z.array(DenominationSchema).default([]),
  momoConfirmed: z.number().int().min(0).default(0),
  varianceNotes: z.string().optional(),
});

export const RejectEodSchema = z.object({
  reason: z.string().min(1, 'A rejection reason is required'),
});

export const CloseShiftSchema = z.object({
  businessDate: z.string().date().optional(),
  physicalCashCount: z.number().int().min(0),
  denominations: z.array(DenominationSchema).default([]),
  momoConfirmed: z.number().int().min(0).default(0),
  varianceNotes: z.string().optional(),
});

export const ListShiftsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  staffId: z.string().uuid().optional(),
  status: z.string().optional(),
  businessDate: z.string().date().optional(),
});

export type InitEodDto = z.infer<typeof InitEodSchema>;
export type CloseEodDto = z.infer<typeof CloseEodSchema>;
export type RejectEodDto = z.infer<typeof RejectEodSchema>;
export type CloseShiftDto = z.infer<typeof CloseShiftSchema>;
export type ListShiftsDto = z.infer<typeof ListShiftsSchema>;
