/**
 * Supplier + PurchaseOrder + Invoice + SupplierPerformance
 * Mirrors pharma: Supplier, Purchase, PurchaseItem, Invoice, InvoicePayment, SupplierPerformance
 * Added: _BranchSuppliers (store-level supplier assignments)
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
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import {
  purchaseOrderStatusEnum,
  supplierPerformanceRatingEnum,
  paymentStatusEnum,
} from './enums';
import { stores } from './organisation';
import { staffProfile } from './staff';

// ─── Supplier ─────────────────────────────────────────────────────────────────
export const suppliers = pgTable('supplier', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  contactPerson: varchar('contact_person', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 30 }),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 100 }).notNull().default('Ghana'),
  taxId: varchar('tax_id', { length: 100 }),
  paymentTermsDays: integer('payment_terms_days').notNull().default(30),
  creditLimitPesewas: integer('credit_limit_pesewas').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  // Supplier-provided product catalogue (optional metadata)
  catalogueUrl: text('catalogue_url'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Branch–Supplier assignments (mirrors pharma _BranchSuppliers) ────────────
export const storeSuppliers = pgTable(
  '_store_suppliers',
  {
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    supplierId: uuid('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'cascade' }),
    isPrimary: boolean('is_primary').notNull().default(false),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
  },
);

// ─── Purchase Order ───────────────────────────────────────────────────────────
export const purchaseOrders = pgTable(
  'purchase',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    poNumber: varchar('po_number', { length: 60 }).notNull().unique(),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    supplierId: uuid('supplier_id').notNull().references(() => suppliers.id),
    raisedById: uuid('raised_by_id').references(() => staffProfile.id),
    approvedById: uuid('approved_by_id').references(() => staffProfile.id),
    status: purchaseOrderStatusEnum('status').notNull().default('draft'),
    orderDate: timestamp('order_date', { withTimezone: true }).defaultNow().notNull(),
    expectedDeliveryDate: date('expected_delivery_date'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    subtotalPesewas: integer('subtotal_pesewas').notNull().default(0),
    taxPesewas: integer('tax_pesewas').notNull().default(0),
    totalPesewas: integer('total_pesewas').notNull().default(0),
    paidAmountPesewas: integer('paid_amount_pesewas').notNull().default(0),
    balancePesewas: integer('balance_pesewas').notNull().default(0),
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('pending'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('po_supplier_idx').on(t.supplierId),
    index('po_store_idx').on(t.storeId),
  ],
);

// ─── Purchase Items ───────────────────────────────────────────────────────────
export const purchaseItems = pgTable('purchase_item', {
  id: uuid('id').defaultRandom().primaryKey(),
  purchaseOrderId: uuid('purchase_order_id')
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  // productId set after product table — FK added in index.ts barrel
  productId: uuid('product_id').notNull(),
  quantityOrdered: integer('quantity_ordered').notNull(),
  quantityReceived: integer('quantity_received').notNull().default(0),
  unitCostPesewas: integer('unit_cost_pesewas').notNull(),
  totalCostPesewas: integer('total_cost_pesewas').notNull(),
  batchNumber: varchar('batch_number', { length: 100 }),
  expiryDate: date('expiry_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Supplier Invoice ─────────────────────────────────────────────────────────
export const supplierInvoices = pgTable('invoice', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceNumber: varchar('invoice_number', { length: 100 }).notNull().unique(),
  supplierId: uuid('supplier_id').notNull().references(() => suppliers.id),
  purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id),
  issuedDate: date('issued_date').notNull(),
  dueDate: date('due_date'),
  totalAmountPesewas: integer('total_amount_pesewas').notNull(),
  paidAmountPesewas: integer('paid_amount_pesewas').notNull().default(0),
  balancePesewas: integer('balance_pesewas').notNull().default(0),
  imageUrl: text('image_url'), // scanned invoice / OCR source
  ocrExtracted: boolean('ocr_extracted').notNull().default(false),
  ocrConfirmed: boolean('ocr_confirmed').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Invoice Payment ──────────────────────────────────────────────────────────
export const invoicePayments = pgTable('invoice_payment', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => supplierInvoices.id, { onDelete: 'cascade' }),
  paidById: uuid('paid_by_id').references(() => staffProfile.id),
  amountPesewas: integer('amount_pesewas').notNull(),
  paymentDate: timestamp('payment_date', { withTimezone: true }).defaultNow().notNull(),
  method: varchar('method', { length: 50 }).notNull().default('bank_transfer'),
  reference: varchar('reference', { length: 100 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Supplier Performance ─────────────────────────────────────────────────────
export const supplierPerformance = pgTable('supplier_performance', {
  id: uuid('id').defaultRandom().primaryKey(),
  supplierId: uuid('supplier_id')
    .notNull()
    .references(() => suppliers.id, { onDelete: 'cascade' }),
  periodMonth: varchar('period_month', { length: 7 }).notNull(), // "2026-07"
  onTimeDeliveryRate: integer('on_time_delivery_rate').notNull().default(0), // 0–100
  fillRate: integer('fill_rate').notNull().default(0), // % of ordered qty received
  qualityRejectRate: integer('quality_reject_rate').notNull().default(0),
  rating: supplierPerformanceRatingEnum('rating').notNull().default('good'),
  notes: text('notes'),
  computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchaseOrders: many(purchaseOrders),
  invoices: many(supplierInvoices),
  performance: many(supplierPerformance),
  storeAssignments: many(storeSuppliers),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  store: one(stores, { fields: [purchaseOrders.storeId], references: [stores.id] }),
  supplier: one(suppliers, { fields: [purchaseOrders.supplierId], references: [suppliers.id] }),
  raisedBy: one(staffProfile, { fields: [purchaseOrders.raisedById], references: [staffProfile.id] }),
  approvedBy: one(staffProfile, { fields: [purchaseOrders.approvedById], references: [staffProfile.id] }),
  items: many(purchaseItems),
  invoices: many(supplierInvoices),
}));

export const purchaseItemsRelations = relations(purchaseItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseItems.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
}));

export const supplierInvoicesRelations = relations(supplierInvoices, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [supplierInvoices.supplierId], references: [suppliers.id] }),
  purchaseOrder: one(purchaseOrders, {
    fields: [supplierInvoices.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  payments: many(invoicePayments),
}));

export const invoicePaymentsRelations = relations(invoicePayments, ({ one }) => ({
  invoice: one(supplierInvoices, {
    fields: [invoicePayments.invoiceId],
    references: [supplierInvoices.id],
  }),
  paidBy: one(staffProfile, {
    fields: [invoicePayments.paidById],
    references: [staffProfile.id],
  }),
}));

export const supplierPerformanceRelations = relations(supplierPerformance, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierPerformance.supplierId],
    references: [suppliers.id],
  }),
}));
