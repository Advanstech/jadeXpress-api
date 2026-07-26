import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  text,
  date,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { stores } from './organisation';
import { staffProfile } from './staff';
import { customers } from './customers';

// ─── Invoice ──────────────────────────────────────────────────────────────────
export const invoices = pgTable(
  'customer_invoice',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    customerId: uuid('customer_id').notNull().references(() => customers.id),
    createdById: uuid('created_by_id').references(() => staffProfile.id),
    
    invoiceNumber: varchar('invoice_number', { length: 60 }).notNull().unique(),
    status: varchar('status', { length: 20 }).notNull().default('draft'), // draft, sent, paid, overdue, cancelled
    
    issueDate: date('issue_date').notNull(),
    dueDate: date('due_date').notNull(),
    
    subtotalPesewas: integer('subtotal_pesewas').notNull().default(0),
    vatAmountPesewas: integer('vat_amount_pesewas').notNull().default(0),
    nhilAmountPesewas: integer('nhil_amount_pesewas').notNull().default(0),
    getfundAmountPesewas: integer('getfund_amount_pesewas').notNull().default(0),
    discountAmountPesewas: integer('discount_amount_pesewas').notNull().default(0),
    totalPesewas: integer('total_pesewas').notNull().default(0),
    
    amountPaidPesewas: integer('amount_paid_pesewas').notNull().default(0),
    
    notes: text('notes'),
    terms: text('terms'), // specific terms for this invoice
    
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('invoice_store_idx').on(t.storeId),
    index('invoice_customer_idx').on(t.customerId),
    index('invoice_status_idx').on(t.status),
  ],
);

// ─── Invoice Item ─────────────────────────────────────────────────────────────
export const invoiceItems = pgTable('customer_invoice_item', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  
  description: varchar('description', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull(),
  unitPricePesewas: integer('unit_price_pesewas').notNull(),
  discountAmountPesewas: integer('discount_amount_pesewas').notNull().default(0),
  lineTotalPesewas: integer('line_total_pesewas').notNull(),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  store: one(stores, { fields: [invoices.storeId], references: [stores.id] }),
  customer: one(customers, { fields: [invoices.customerId], references: [customers.id] }),
  createdBy: one(staffProfile, { fields: [invoices.createdById], references: [staffProfile.id] }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
}));
