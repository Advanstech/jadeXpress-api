import { z } from 'zod';

export const ProductIntelligenceSchema = z.object({
  productId: z.string().uuid(),
});

export type ProductIntelligenceDto = z.infer<typeof ProductIntelligenceSchema>;
