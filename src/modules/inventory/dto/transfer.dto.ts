import { z } from 'zod';

export const createTransferItemSchema = z.object({
  productId: z.string().uuid(),
  quantityRequested: z.number().int().positive(),
  unitCostPesewas: z.number().int().min(0).default(0),
  sellingPricePesewas: z.number().int().min(0).optional(),
});

export const createTransferSchema = z.object({
  fromStoreId: z.string().uuid(),
  toStoreId: z.string().uuid(),
  notes: z.string().optional(),
  instantTransfer: z.boolean().optional().default(false),
  items: z.array(createTransferItemSchema).min(1),
});

export type CreateTransferDto = z.infer<typeof createTransferSchema>;

export const transferApprovalItemSchema = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().uuid(),
  quantityRequested: z.number().int().positive().optional(),
  unitCostPesewas: z.number().int().min(0).optional(),
  sellingPricePesewas: z.number().int().min(0).optional(),
});

export const transferApprovalSchema = z.object({
  notes: z.string().optional(),
  items: z.array(transferApprovalItemSchema).optional(),
});

export type TransferApprovalDto = z.infer<typeof transferApprovalSchema>;
