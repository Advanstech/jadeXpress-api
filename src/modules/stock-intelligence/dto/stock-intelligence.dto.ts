import { z } from 'zod';

export const ForecastQuerySchema = z.object({
  productId: z.string().uuid(),
  storeId: z.string().uuid(),
  horizonDays: z.coerce.number().int().min(7).max(365).default(30),
});

export const UpsellBodySchema = z.object({
  productIds: z.array(z.string().uuid()).min(1),
  storeId: z.string().uuid().optional(),
});

export type ForecastQueryDto = z.infer<typeof ForecastQuerySchema>;
export type UpsellBodyDto = z.infer<typeof UpsellBodySchema>;
