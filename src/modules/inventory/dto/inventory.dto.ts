import { z } from 'zod';

export const CreateProductSchema = z.object({
  sku: z.string().min(1).max(100),
  barcode: z.string().max(100).optional(),
  name: z.string().min(1).max(255),
  genericName: z.string().max(255).optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  primarySupplierId: z.string().uuid().optional(),
  type: z.enum(['supplement', 'beauty', 'otc_medicine', 'rx_medicine', 'equipment', 'consumable']).default('supplement'),
  costPricePesewas: z.number().int().min(0),
  sellingPricePesewas: z.number().int().min(0),
  taxable: z.boolean().default(true),
  unit: z.string().default('piece'),
  packSize: z.number().int().min(1).default(1),
  imageUrl: z.string().url().optional(),
  dosageForm: z.string().max(100).optional(),
  strength: z.string().max(100).optional(),
  manufacturer: z.string().max(255).optional(),
  countryOfOrigin: z.string().max(100).optional(),
  storageInstructions: z.string().optional(),
  allergens: z.array(z.string()).default([]),
  warnings: z.string().optional(),
  requiresPrescription: z.boolean().default(false),
  reorderPoint: z.number().int().min(0).default(5),
  reorderQty: z.number().int().min(0).default(10),
  minStockLevel: z.number().int().min(0).default(0),
  maxStockLevel: z.number().int().min(0).optional(),
  tags: z.array(z.string()).default([]),
});

export const UpdateProductSchema = CreateProductSchema.partial();

export const StockAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  storeId: z.string().uuid(),
  batchId: z.string().uuid().optional(),
  type: z.enum(['adjustment_in', 'adjustment_out', 'opening_stock']),
  quantity: z.number().int().min(1),
  costPricePesewas: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export const CreateBatchSchema = z.object({
  productId: z.string().uuid(),
  storeId: z.string().uuid(),
  supplierId: z.string().uuid().optional(),
  purchaseOrderId: z.string().uuid().optional(),
  batchNumber: z.string().max(100).optional(),
  quantityReceived: z.number().int().min(1),
  costPricePesewas: z.number().int().min(0),
  expiryDate: z.string().date().optional(),
  manufacturedDate: z.string().date().optional(),
});

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(150),
  slug: z.string().min(1).max(150),
  description: z.string().optional(),
  parentId: z.string().uuid().optional(),
  iconUrl: z.string().url().optional(),
  sortOrder: z.number().int().default(0),
});

export type CreateProductDto = z.infer<typeof CreateProductSchema>;
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;
export type StockAdjustmentDto = z.infer<typeof StockAdjustmentSchema>;
export type CreateBatchDto = z.infer<typeof CreateBatchSchema>;
export type CreateCategoryDto = z.infer<typeof CreateCategorySchema>;
