import { z } from 'zod';

export const CreateSupplierSchema = z.object({
  code: z.string().min(1).max(30),
  name: z.string().min(1).max(255),
  contactPerson: z.string().max(255).optional(),
  email: z.string().email().or(z.literal('')).optional(),
  phone: z.string().max(30).optional(),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).default('Ghana'),
  taxId: z.string().max(100).optional(),
  paymentTermsDays: z.number().int().min(0).default(30),
  creditLimitPesewas: z.number().int().min(0).default(0),
  notes: z.string().optional(),
});

export const UpdateSupplierSchema = CreateSupplierSchema.partial();

export const PurchaseOrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantityOrdered: z.number().int().min(1),
  unitCostPesewas: z.number().int().min(0),
  batchNumber: z.string().max(100).optional(),
  expiryDate: z.string().date().optional(),
});

export const CreatePurchaseOrderSchema = z.object({
  supplierId: z.string().uuid(),
  storeId: z.string().uuid(),
  expectedDeliveryDate: z.string().date().optional(),
  items: z.array(PurchaseOrderItemSchema).min(1),
  notes: z.string().optional(),
});

export const ReceiveGoodsSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  invoiceNumber: z.string().max(100).optional(),
  invoiceImageUrl: z.string().url().optional(),
  items: z.array(z.object({
    purchaseItemId: z.string().uuid(),
    quantityReceived: z.number().int().min(0),
    batchNumber: z.string().optional(),
    expiryDate: z.string().date().optional(),
  })).min(1),
  notes: z.string().optional(),
});

export type CreateSupplierDto = z.infer<typeof CreateSupplierSchema>;
export type UpdateSupplierDto = z.infer<typeof UpdateSupplierSchema>;
export type CreatePurchaseOrderDto = z.infer<typeof CreatePurchaseOrderSchema>;
export type ReceiveGoodsDto = z.infer<typeof ReceiveGoodsSchema>;
