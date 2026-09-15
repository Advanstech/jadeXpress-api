import { z } from 'zod';

// Percent values from the POS UI (e.g. 12.5 = 12.5%). The DB stores basis
// points (bps): 1500 = 15.00%.
export const UpdateOrganisationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  tradingName: z.string().min(1).max(255).optional(),
  currencyCode: z.string().min(3).max(10).optional(),
  currencySymbol: z.string().min(1).max(8).optional(),
  vatRatePct: z.number().min(0).max(100).optional(),
  nhilRatePct: z.number().min(0).max(100).optional(),
  getfundRatePct: z.number().min(0).max(100).optional(),
  maxDiscountPct: z.number().min(0).max(100).optional(),
  minStockThreshold: z.number().int().min(0).optional(),
  defaultFloatPesewas: z.number().int().min(0).optional(),
});

export type UpdateOrganisationDto = z.infer<typeof UpdateOrganisationSchema>;
