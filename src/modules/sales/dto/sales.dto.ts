import { z } from 'zod';

export const SaleItemInputSchema = z.object({
  productId: z.string().uuid(),
  batchId: z.string().uuid().optional(),
  quantity: z.number().int().min(1),
  unitPricePesewas: z.number().int().min(0),
  discountAmountPesewas: z.number().int().min(0).default(0),
  productNameSnapshot: z.string(),
  productSkuSnapshot: z.string(),
});

export const TenderBreakdownSchema = z.object({
  type: z.enum(['cash', 'momo', 'card', 'store_credit']),
  amountPesewas: z.number().int().min(0),
  reference: z.string().optional(),
});

export const CreateSaleSchema = z.object({
  // Client-generated UUID — idempotency for offline sync
  clientId: z.string().uuid(),
  storeId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  shiftId: z.string().uuid().optional(),
  items: z.array(SaleItemInputSchema).min(1),
  tenderType: z.enum(['cash', 'momo', 'card', 'store_credit', 'split']).default('cash'),
  tenderBreakdown: z.array(TenderBreakdownSchema).default([]),
  tenderedPesewas: z.number().int().min(0),
  discountAmountPesewas: z.number().int().min(0).default(0),
  discountAuthorizedById: z.string().uuid().optional(),
  loyaltyPointsRedeemed: z.number().int().min(0).default(0),
  momoReference: z.string().optional(),
  cardReference: z.string().optional(),
  createdOffline: z.boolean().default(false),
  notes: z.string().optional(),
});

export const HoldSaleSchema = z.object({
  saleId: z.string().uuid(),
  heldNote: z.string().optional(),
});

export const VoidSaleSchema = z.object({
  saleId: z.string().uuid(),
  reason: z.string().min(1),
  authorizedById: z.string().uuid(),
});

export type CreateSaleDto = z.infer<typeof CreateSaleSchema>;
export type HoldSaleDto = z.infer<typeof HoldSaleSchema>;
export type VoidSaleDto = z.infer<typeof VoidSaleSchema>;
