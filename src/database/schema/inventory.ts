/**
 * Product + Category + StockItem + StockMovement + StockAlert + StockTransfer
 *
 * Design decisions vs pharma schema:
 * - `product` = pharma Product (extended for supplements: dosage, strength, allergens)
 * - `stock_item` = pharma StockItem — the per-store inventory record (current qty)
 * - `stock_movement` = pharma StockMovement — full movement ledger (immutable)
 * - `stock_alert` = pharma StockAlert
 * - `stock_transfer` + `stock_transfer_item` = pharma StockTransfer + StockTransferItem
 * - `rx_item` = pharma RxItem — DORMANT, Phase 2 only (requires rxEnabled store flag)
 *
 * All monetary values stored as integer pesewas (GHS × 100) to avoid float issues.
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  doublePrecision,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import {
  productStatusEnum,
  productTypeEnum,
  stockMovementTypeEnum,
  stockAlertTypeEnum,
  alertSeverityEnum,
  stockTransferStatusEnum,
} from './enums';
import { stores } from './organisation';
import { staffProfile } from './staff';
import { suppliers } from './suppliers';

// ─── Category ─────────────────────────────────────────────────────────────────
export const categories = pgTable('category', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 150 }).notNull().unique(),
  slug: varchar('slug', { length: 150 }).notNull().unique(),
  description: text('description'),
  tagline: varchar('tagline', { length: 255 }),
  imageUrl: text('image_url'),
  parentId: uuid('parent_id'), // self-ref for sub-categories
  iconUrl: text('icon_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Product ──────────────────────────────────────────────────────────────────
export const products = pgTable(
  'product',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sku: varchar('sku', { length: 100 }).notNull().unique(),
    barcode: varchar('barcode', { length: 100 }).unique(),
    slug: varchar('slug', { length: 255 }).unique(),
    name: varchar('name', { length: 255 }).notNull(),
    genericName: varchar('generic_name', { length: 255 }), // for supplements / future Rx
    brand: varchar('brand', { length: 150 }),
    description: text('description'),
    shortDescription: varchar('short_description', { length: 500 }),
    categoryId: uuid('category_id').references(() => categories.id),
    primarySupplierId: uuid('primary_supplier_id').references(() => suppliers.id),
    type: productTypeEnum('type').notNull().default('supplement'),
    status: productStatusEnum('status').notNull().default('active'),

    // Pricing (pesewas)
    costPricePesewas: integer('cost_price_pesewas').notNull().default(0),
    sellingPricePesewas: integer('selling_price_pesewas').notNull().default(0),
    taxable: boolean('taxable').notNull().default(true),

    // Packaging
    unit: varchar('unit', { length: 50 }).notNull().default('piece'),
    packSize: integer('pack_size').notNull().default(1), // e.g. 30 capsules per pack
    imageUrl: text('image_url'),
    // Storefront gallery (multiple images) — imageUrl above stays as legacy/primary fallback
    images: jsonb('images').$type<string[]>().default([]),
    // Online storefront merchandising
    isFeatured: boolean('is_featured').notNull().default(false),
    isBestseller: boolean('is_bestseller').notNull().default(false),
    rating: doublePrecision('rating').notNull().default(0),
    reviewCount: integer('review_count').notNull().default(0),
    ingredients: text('ingredients'),
    usageInstructions: text('usage_instructions'),
    benefits: jsonb('benefits').$type<string[]>().default([]),
    compareAtPricePesewas: integer('compare_at_price_pesewas'),

    // Supplement / OTC specific fields
    dosageForm: varchar('dosage_form', { length: 100 }),   // tablet, capsule, liquid, powder
    strength: varchar('strength', { length: 100 }),        // e.g. "500mg", "1000IU"
    manufacturer: varchar('manufacturer', { length: 255 }),
    countryOfOrigin: varchar('country_of_origin', { length: 100 }),
    storageInstructions: text('storage_instructions'),
    // Allergen / interaction warnings (important for supplements)
    allergens: jsonb('allergens').$type<string[]>().default([]),
    warnings: text('warnings'),

    // Rx fields — Phase 2, dormant until rxEnabled
    requiresPrescription: boolean('requires_prescription').notNull().default(false),
    scheduleClass: varchar('schedule_class', { length: 20 }), // e.g. 'S2', 'S3', 'S4'
    nafdacNumber: varchar('nafdac_number', { length: 100 }), // Ghana FDA registration

    // Stock thresholds (global defaults; per-store overrides in stock_item)
    reorderPoint: integer('reorder_point').notNull().default(5),
    reorderQty: integer('reorder_qty').notNull().default(10),
    minStockLevel: integer('min_stock_level').notNull().default(0),
    maxStockLevel: integer('max_stock_level'),

    // AI / search metadata
    tags: jsonb('tags').$type<string[]>().default([]),
    searchVector: text('search_vector'), // pre-computed full-text search string

    expiryDate: date('expiry_date'), // General tracked expiry date for the product

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('product_sku_idx').on(t.sku),
    index('product_barcode_idx').on(t.barcode),
    index('product_slug_idx').on(t.slug),
    index('product_category_idx').on(t.categoryId),
    index('product_type_idx').on(t.type),
  ],
);

// ─── Stock Item (per-store live inventory record) ─────────────────────────────
// Mirrors pharma StockItem — one row per product per store.
// Updated by stock_movement triggers / application logic.
export const stockItems = pgTable(
  'stock_item',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    quantityOnHand: integer('quantity_on_hand').notNull().default(0),
    quantityReserved: integer('quantity_reserved').notNull().default(0), // held by pending sales
    quantityOnOrder: integer('quantity_on_order').notNull().default(0),  // open POs
    // Per-store overrides (null = use product defaults)
    reorderPointOverride: integer('reorder_point_override'),
    reorderQtyOverride: integer('reorder_qty_override'),
    sellingPriceOverride: integer('selling_price_override'), // pesewas
    lastCountDate: timestamp('last_count_date', { withTimezone: true }),
    lastMovementAt: timestamp('last_movement_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('stock_item_product_store_idx').on(t.productId, t.storeId),
  ],
);

// ─── Stock Batch (per-batch expiry tracking) ──────────────────────────────────
// Each delivery creates a batch. FIFO consumption tracked via stock_movement.
export const stockBatches = pgTable(
  'stock_batch',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    supplierId: uuid('supplier_id').references(() => suppliers.id),
    purchaseOrderId: uuid('purchase_order_id'), // FK resolved in index.ts
    batchNumber: varchar('batch_number', { length: 100 }),
    quantityReceived: integer('quantity_received').notNull(),
    quantityRemaining: integer('quantity_remaining').notNull(),
    costPricePesewas: integer('cost_price_pesewas').notNull(),
    expiryDate: date('expiry_date'),
    manufacturedDate: date('manufactured_date'),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    index('stock_batch_product_idx').on(t.productId, t.storeId),
    index('stock_batch_expiry_idx').on(t.expiryDate),
  ],
);

// ─── Stock Movement (immutable ledger) ────────────────────────────────────────
// Mirrors pharma StockMovement — append-only. Never updated or deleted.
export const stockMovements = pgTable(
  'stock_movement',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id').notNull().references(() => products.id),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    batchId: uuid('batch_id').references(() => stockBatches.id),
    type: stockMovementTypeEnum('type').notNull(),
    quantityChange: integer('quantity_change').notNull(), // +in / -out
    quantityBefore: integer('quantity_before').notNull(),
    quantityAfter: integer('quantity_after').notNull(),
    costPricePesewas: integer('cost_price_pesewas'),
    // Reference to the source document
    referenceType: varchar('reference_type', { length: 50 }), // 'sale'|'purchase'|'refund'|'transfer'|'adjustment'
    referenceId: uuid('reference_id'),
    performedById: uuid('performed_by_id').references(() => staffProfile.id),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('stock_movement_product_idx').on(t.productId, t.storeId),
    index('stock_movement_created_idx').on(t.createdAt),
    index('stock_movement_ref_idx').on(t.referenceType, t.referenceId),
  ],
);

// ─── Stock Alert ──────────────────────────────────────────────────────────────
// Mirrors pharma StockAlert
export const stockAlerts = pgTable(
  'stock_alert',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id').notNull().references(() => products.id),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    batchId: uuid('batch_id').references(() => stockBatches.id),
    type: stockAlertTypeEnum('type').notNull(),
    severity: alertSeverityEnum('severity').notNull().default('warning'),
    message: text('message').notNull(),
    quantityOnHand: integer('quantity_on_hand'),
    expiryDate: date('expiry_date'),
    isDismissed: boolean('is_dismissed').notNull().default(false),
    dismissedById: uuid('dismissed_by_id').references(() => staffProfile.id),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('stock_alert_product_idx').on(t.productId, t.storeId)],
);

// ─── Stock Transfer (inter-store) ─────────────────────────────────────────────
// Mirrors pharma StockTransfer + StockTransferItem
export const stockTransfers = pgTable('stock_transfer', {
  id: uuid('id').defaultRandom().primaryKey(),
  transferNumber: varchar('transfer_number', { length: 50 }).notNull().unique(),
  fromStoreId: uuid('from_store_id').notNull().references(() => stores.id),
  toStoreId: uuid('to_store_id').notNull().references(() => stores.id),
  status: stockTransferStatusEnum('status').notNull().default('draft'),
  initiatedById: uuid('initiated_by_id').references(() => staffProfile.id),
  receivedById: uuid('received_by_id').references(() => staffProfile.id),
  notes: text('notes'),
  dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const stockTransferItems = pgTable('stock_transfer_item', {
  id: uuid('id').defaultRandom().primaryKey(),
  transferId: uuid('transfer_id')
    .notNull()
    .references(() => stockTransfers.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  batchId: uuid('batch_id').references(() => stockBatches.id),
  quantityRequested: integer('quantity_requested').notNull(),
  quantityDispatched: integer('quantity_dispatched').notNull().default(0),
  quantityReceived: integer('quantity_received').notNull().default(0),
  unitCostPesewas: integer('unit_cost_pesewas').notNull(),
});

// ─── Rx Item (DORMANT — Phase 2 prescription drugs) ──────────────────────────
// Mirrors pharma RxItem. Only used when store.rxEnabled = true.
// Not surfaced in API until the pharmacist role + Rx module is activated.
export const rxItems = pgTable('rx_item', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id),
  prescriptionId: uuid('prescription_id'), // FK resolved after prescriptions table
  dispensedById: uuid('dispensed_by_id').references(() => staffProfile.id),
  quantity: integer('quantity').notNull(),
  instructions: text('instructions'),
  dispensedAt: timestamp('dispensed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const categoriesRelations = relations(categories, ({ many, one }) => ({
  products: many(products),
  parent: one(categories, { fields: [categories.parentId], references: [categories.id] }),
  children: many(categories),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  primarySupplier: one(suppliers, {
    fields: [products.primarySupplierId],
    references: [suppliers.id],
  }),
  stockItems: many(stockItems),
  batches: many(stockBatches),
  movements: many(stockMovements),
  alerts: many(stockAlerts),
}));

export const stockItemsRelations = relations(stockItems, ({ one }) => ({
  product: one(products, { fields: [stockItems.productId], references: [products.id] }),
  store: one(stores, { fields: [stockItems.storeId], references: [stores.id] }),
}));

export const stockBatchesRelations = relations(stockBatches, ({ one }) => ({
  product: one(products, { fields: [stockBatches.productId], references: [products.id] }),
  store: one(stores, { fields: [stockBatches.storeId], references: [stores.id] }),
  supplier: one(suppliers, { fields: [stockBatches.supplierId], references: [suppliers.id] }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, { fields: [stockMovements.productId], references: [products.id] }),
  store: one(stores, { fields: [stockMovements.storeId], references: [stores.id] }),
  batch: one(stockBatches, { fields: [stockMovements.batchId], references: [stockBatches.id] }),
  performedBy: one(staffProfile, {
    fields: [stockMovements.performedById],
    references: [staffProfile.id],
  }),
}));

export const stockAlertsRelations = relations(stockAlerts, ({ one }) => ({
  product: one(products, { fields: [stockAlerts.productId], references: [products.id] }),
  store: one(stores, { fields: [stockAlerts.storeId], references: [stores.id] }),
  dismissedBy: one(staffProfile, {
    fields: [stockAlerts.dismissedById],
    references: [staffProfile.id],
  }),
}));

export const stockTransfersRelations = relations(stockTransfers, ({ one, many }) => ({
  fromStore: one(stores, { fields: [stockTransfers.fromStoreId], references: [stores.id] }),
  toStore: one(stores, { fields: [stockTransfers.toStoreId], references: [stores.id] }),
  initiatedBy: one(staffProfile, {
    fields: [stockTransfers.initiatedById],
    references: [staffProfile.id],
  }),
  receivedBy: one(staffProfile, {
    fields: [stockTransfers.receivedById],
    references: [staffProfile.id],
  }),
  items: many(stockTransferItems),
}));

export const stockTransferItemsRelations = relations(stockTransferItems, ({ one }) => ({
  transfer: one(stockTransfers, {
    fields: [stockTransferItems.transferId],
    references: [stockTransfers.id],
  }),
  product: one(products, {
    fields: [stockTransferItems.productId],
    references: [products.id],
  }),
}));
