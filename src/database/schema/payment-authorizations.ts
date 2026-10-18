/**
 * Payment Authorization Schema
 * Supports manager/owner approval workflows for vendor disbursements,
 * supplier payments, expense authorizations, and inter-branch settlements.
 * Integrates optional AI Vision receipt/invoice scanning (Gemini OCR) or manual entry.
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
  doublePrecision,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { stores } from './organisation';
import { staffProfile } from './staff';
import { ledgerEntries } from './accounting';

export const paymentAuthorizations = pgTable(
  'payment_authorization',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    authorizationNumber: varchar('authorization_number', { length: 60 }).notNull().unique(),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    title: varchar('title', { length: 255 }).notNull(),
    category: varchar('category', { length: 50 }).notNull().default('operational_expense'),
    // categories: 'supplier_invoice' | 'operational_expense' | 'inter_branch_settlement' | 'refund_payout' | 'payroll_advance' | 'utility' | 'general'

    referenceType: varchar('reference_type', { length: 50 }), // 'supplier_invoice' | 'expense' | 'stock_transfer' | 'custom'
    referenceId: uuid('reference_id'),

    payeeName: varchar('payee_name', { length: 255 }).notNull(),
    amountPesewas: integer('amount_pesewas').notNull(),
    currencyCode: varchar('currency_code', { length: 10 }).notNull().default('GHS'),

    paymentMethod: varchar('payment_method', { length: 50 }).notNull().default('momo'),
    // 'momo' | 'bank_transfer' | 'cash' | 'card' | 'cheque'
    momoPhoneNumber: varchar('momo_phone_number', { length: 30 }),
    momoNetwork: varchar('momo_network', { length: 50 }), // MTN, Telecel, AT
    bankName: varchar('bank_name', { length: 100 }),
    bankAccountNumber: varchar('bank_account_number', { length: 100 }),

    status: varchar('status', { length: 50 }).notNull().default('pending'),
    // 'pending' | 'approved' | 'rejected' | 'disbursed' | 'cancelled'

    requestedById: uuid('requested_by_id').references(() => staffProfile.id),
    authorizedById: uuid('authorized_by_id').references(() => staffProfile.id),
    authorizedAt: timestamp('authorized_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    notes: text('notes'),

    // ─── AI Vision Receipt & OCR Data ─────────────────────────────────────────
    receiptUrl: text('receipt_url'),
    receiptOcrExtracted: boolean('receipt_ocr_extracted').notNull().default(false),
    receiptOcrConfidence: doublePrecision('receipt_ocr_confidence'),
    receiptOcrData: jsonb('receipt_ocr_data').$type<{
      vendor?: string;
      invoiceNumber?: string;
      date?: string;
      subtotal?: number;
      tax?: number;
      total?: number;
      lineItems?: Array<{
        description: string;
        quantity: number;
        unitCost: number;
        total: number;
        batchNo?: string;
      }>;
      notes?: string;
      rawText?: string;
    }>(),
    receiptUploadedAt: timestamp('receipt_uploaded_at', { withTimezone: true }),

    // ─── Disbursal & Accounting Sync ──────────────────────────────────────────
    disbursedAt: timestamp('disbursed_at', { withTimezone: true }),
    disbursedById: uuid('disbursed_by_id').references(() => staffProfile.id),
    transactionReference: varchar('transaction_reference', { length: 100 }),
    ledgerEntryId: uuid('ledger_entry_id').references(() => ledgerEntries.id),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('payment_auth_store_idx').on(t.storeId),
    index('payment_auth_status_idx').on(t.status),
    index('payment_auth_created_idx').on(t.createdAt),
    index('payment_auth_number_idx').on(t.authorizationNumber),
    index('payment_auth_category_idx').on(t.category),
  ],
);

export const paymentAuthorizationsRelations = relations(paymentAuthorizations, ({ one }) => ({
  store: one(stores, {
    fields: [paymentAuthorizations.storeId],
    references: [stores.id],
  }),
  requestedBy: one(staffProfile, {
    fields: [paymentAuthorizations.requestedById],
    references: [staffProfile.id],
    relationName: 'paymentAuthRequestedBy',
  }),
  authorizedBy: one(staffProfile, {
    fields: [paymentAuthorizations.authorizedById],
    references: [staffProfile.id],
    relationName: 'paymentAuthAuthorizedBy',
  }),
  disbursedBy: one(staffProfile, {
    fields: [paymentAuthorizations.disbursedById],
    references: [staffProfile.id],
    relationName: 'paymentAuthDisbursedBy',
  }),
  ledgerEntry: one(ledgerEntries, {
    fields: [paymentAuthorizations.ledgerEntryId],
    references: [ledgerEntries.id],
  }),
}));
