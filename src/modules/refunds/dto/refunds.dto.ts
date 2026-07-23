import { z } from 'zod';

export const CreateRefundSchema = z.object({
  saleId: z.string().uuid(),
  storeId: z.string().uuid(),
  reason: z.enum(['customer_request','defective_product','wrong_item','overcharge','duplicate_sale','near_expiry','other']),
  method: z.enum(['cash','momo','card','store_credit']).default('cash'),
  authorizedById: z.string().uuid(),
  momoReference: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    saleItemId: z.string().uuid(),
    productId: z.string().uuid(),
    quantity: z.number().int().min(1),
    unitPricePesewas: z.number().int().min(0),
    restockToInventory: z.boolean().default(true),
  })).min(1),
});

export type CreateRefundDto = z.infer<typeof CreateRefundSchema>;
