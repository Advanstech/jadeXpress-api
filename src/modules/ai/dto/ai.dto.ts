import { z } from 'zod';

export const ProductIntelligenceSchema = z.object({
  productId: z.string().uuid(),
});

export type ProductIntelligenceDto = z.infer<typeof ProductIntelligenceSchema>;

export const MatchProductsSchema = z.object({
  extractedItems: z.array(z.string()),
  catalog: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      sku: z.string().optional().nullable(),
    })
  ),
});

export type MatchProductsDto = z.infer<typeof MatchProductsSchema>;
