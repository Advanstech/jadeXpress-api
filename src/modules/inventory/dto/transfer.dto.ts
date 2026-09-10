import { z } from 'zod';

export const createTransferItemSchema = z.object({
  productId: z.string().uuid(),
  quantityRequested: z.number().int().positive(),
  unitCostPesewas: z.number().int().min(0).default(0),
});

export const createTransferSchema = z.object({
  fromStoreId: z.string().uuid(),
  toStoreId: z.string().uuid(),
  notes: z.string().optional(),
  items: z.array(createTransferItemSchema).min(1),
});

export type CreateTransferDto = z.infer<typeof createTransferSchema>;

export const transferApprovalSchema = z.object({
  notes: z.string().optional(),
});

export type TransferApprovalDto = z.infer<typeof transferApprovalSchema>;
