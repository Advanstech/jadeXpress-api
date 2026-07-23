/**
 * Sale + SaleItem + Payment + RefundRequest + RefundItem
 * Mirrors pharma: Sale, SaleItem, Payment, RefundRequest
 *
 * Key design choices:
 * - clientId (UUID) for offline idempotency — client generates this before syncing
 * - All amounts in pesewas (integer) — Ghana tax breakdown on every sale
 * - tenderBreakdown JSON for split-payment recording
 * - SaleItem snapshots product name/sku at time of sale (audit safety)
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import {
  saleStatusEnum,
  tenderTypeEnum,
  paymentStatusEnum,
  refundReasonEnum,
  refundStatusEnum,
  refundMethodEnum,
} from './enums';
import { stores } from './organisation';
import { staffProfile } from './staff';
import { customers } from './customers';
import { products, stockBatches } from './inventory';

// ─── Sale ─────────────────────────────────────────────────────────────────────
export const sales = pgTable(
  'sale',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Client-generated UUID — prevents duplicate offline sync insertions
    clientId: uuid('client_id').notNull().unique(),
    receiptNumber: varchar('receipt_number', { length: 60 }).notNull().unique(),

    storeId: uuid('store_id').notNull().references(() => stores.id),
    cashierId: uuid('cashier_id').notNull().references(() => staffProfile.id),
    customerId: uuid('customer_id').references(() => customers.id),
    shiftId: uuid('shift_id'), // FK to shift_reconciliation — resolved in index

    status: saleStatusEnum('status').notNull().default('in_progress'),
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('pending'),

    // ── Amounts (all pesewas) ──────────────────────────────────────────────
    subtotalPesewas: integer('subtotal_pesewas').notNull().default(0),
    discountAmountPesewas: integer('discount_amount_pesewas').notNull().default(0),
    // Ghana tax breakdown
    vatAmountPesewas: integer('vat_amount_pesewas').notNull().default(0),
    nhilAmountPesewas: integer('nhil_amount_pesewas').notNull().default(0),
    getfundAmountPesewas: integer('getfund_amount_pesewas').notNull().default(0),
    totalPesewas: integer('total_pesewas').notNull().default(0),
    tenderedPesewas: integer('tendered_pesewas').notNull().default(0),
    changePesewas: integer('change_pesewas').notNull().default(0),

    // ── Payment ────────────────────────────────────────────────────────────
    tenderType: tenderTypeEnum('tender_type').notNull().default('cash'),
    tenderBreakdown: jsonb('tender_breakdown')
      .$type<Array<{ type: string; amountPesewas: number; reference?: string }>>()
      .default([]),
    momoReference: varchar('momo_reference', { length: 100 }),
    cardReference: varchar('card_reference', { length: 100 }),

    // ── Loyalty ────────────────────────────────────────────────────────────
    loyaltyPointsEarned: integer('loyalty_points_earned').notNull().default(0),
    loyaltyPointsRedeemed: integer('loyalty_points_redeemed').notNull().default(0),
    loyaltyRedeemValuePesewas: integer('loyalty_redeem_value_pesewas').notNull().default(0),

    // ── Discount authorization ─────────────────────────────────────────────
    discountAuthorizedById: uuid('discount_authorized_by_id').references(() => staffProfile.id),

    // ── Receipt ────────────────────────────────────────────────────────────
    receiptPrinted: boolean('receipt_printed').notNull().default(false),
    receiptPrintedAt: timestamp('receipt_printed_at', { withTimezone: true }),

    // ── Hold / Resume ──────────────────────────────────────────────────────
    heldAt: timestamp('held_at', { withTimezone: true }),
    heldNote: text('held_note'),

    // ── Offline sync ──────────────────────────────────────────────────────
    createdOffline: boolean('created_offline').notNull().default(false),
    syncedAt: timestamp('synced_at', { withTimezone: true }),

    notes: text('notes'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('sale_cashier_idx').on(t.cashierId),
    index('sale_customer_idx').on(t.customerId),
    index('sale_store_created_idx').on(t.storeId, t.createdAt),
    index('sale_client_id_idx').on(t.clientId),
    index('sale_receipt_idx').on(t.receiptNumber),
    index('sale_status_idx').on(t.status),
  ],
);

// ─── Sale Item ────────────────────────────────────────────────────────────────
export const saleItems = pgTable('sale_item', {
  id: uuid('id').defaultRandom().primaryKey(),
  saleId: uuid('sale_id')
    .notNull()
    .references(() => sales.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  batchId: uuid('batch_id').references(() => stockBatches.id), // FIFO batch tracking
  quantity: integer('quantity').notNull(),
  unitPricePesewas: integer('unit_price_pesewas').notNull(),
  discountAmountPesewas: integer('discount_amount_pesewas').notNull().default(0),
  lineTotalPesewas: integer('line_total_pesewas').notNull(),
  // Snapshots — audit safety (price/name at time of sale)
  productNameSnapshot: varchar('product_name_snapshot', { length: 255 }).notNull(),
  productSkuSnapshot: varchar('product_sku_snapshot', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Payment ──────────────────────────────────────────────────────────────────
// Mirrors pharma Payment — payment records are separate from sale tender for
// split-payment granularity and reconciliation
export const payments = pgTable('payment', {
  id: uuid('id').defaultRandom().primaryKey(),
  saleId: uuid('sale_id').notNull().references(() => sales.id, { onDelete: 'cascade' }),
  storeId: uuid('store_id').notNull().references(() => stores.id),
  method: tenderTypeEnum('method').notNull(),
  amountPesewas: integer('amount_pesewas').notNull(),
  reference: varchar('reference', { length: 100 }),
  status: paymentStatusEnum('status').notNull().default('paid'),
  processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Refund Request ───────────────────────────────────────────────────────────
// Mirrors pharma RefundRequest
export const refundRequests = pgTable(
  'refund_request',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    saleId: uuid('sale_id').notNull().references(() => sales.id),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    initiatedById: uuid('initiated_by_id').references(() => staffProfile.id),
    // Manager PIN authorization — required for all refunds
    authorizedById: uuid('authorized_by_id').references(() => staffProfile.id),
    reason: refundReasonEnum('reason').notNull(),
    method: refundMethodEnum('method').notNull().default('cash'),
    status: refundStatusEnum('status').notNull().default('pending_approval'),
    totalAmountPesewas: integer('total_amount_pesewas').notNull(),
    momoReference: varchar('momo_reference', { length: 100 }),
    inventoryRestocked: boolean('inventory_restocked').notNull().default(false),
    accountingAdjusted: boolean('accounting_adjusted').notNull().default(false),
    notes: text('notes'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('refund_sale_idx').on(t.saleId)],
);

// ─── Refund Items ─────────────────────────────────────────────────────────────
export const refundItems = pgTable('refund_item', {
  id: uuid('id').defaultRandom().primaryKey(),
  refundRequestId: uuid('refund_request_id')
    .notNull()
    .references(() => refundRequests.id, { onDelete: 'cascade' }),
  saleItemId: uuid('sale_item_id').notNull().references(() => saleItems.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  quantity: integer('quantity').notNull(),
  unitPricePesewas: integer('unit_price_pesewas').notNull(),
  lineTotalPesewas: integer('line_total_pesewas').notNull(),
  restockToInventory: boolean('restock_to_inventory').notNull().default(true),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const salesRelations = relations(sales, ({ one, many }) => ({
  store: one(stores, { fields: [sales.storeId], references: [stores.id] }),
  cashier: one(staffProfile, { fields: [sales.cashierId], references: [staffProfile.id] }),
  customer: one(customers, { fields: [sales.customerId], references: [customers.id] }),
  items: many(saleItems),
  payments: many(payments),
  refundRequests: many(refundRequests),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
  product: one(products, { fields: [saleItems.productId], references: [products.id] }),
  batch: one(stockBatches, { fields: [saleItems.batchId], references: [stockBatches.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  sale: one(sales, { fields: [payments.saleId], references: [sales.id] }),
  store: one(stores, { fields: [payments.storeId], references: [stores.id] }),
}));

export const refundRequestsRelations = relations(refundRequests, ({ one, many }) => ({
  sale: one(sales, { fields: [refundRequests.saleId], references: [sales.id] }),
  store: one(stores, { fields: [refundRequests.storeId], references: [stores.id] }),
  initiatedBy: one(staffProfile, {
    fields: [refundRequests.initiatedById],
    references: [staffProfile.id],
  }),
  authorizedBy: one(staffProfile, {
    fields: [refundRequests.authorizedById],
    references: [staffProfile.id],
  }),
  items: many(refundItems),
}));

export const refundItemsRelations = relations(refundItems, ({ one }) => ({
  refundRequest: one(refundRequests, {
    fields: [refundItems.refundRequestId],
    references: [refundRequests.id],
  }),
  saleItem: one(saleItems, {
    fields: [refundItems.saleItemId],
    references: [saleItems.id],
  }),
  product: one(products, { fields: [refundItems.productId], references: [products.id] }),
}));
