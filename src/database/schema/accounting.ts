/**
 * Accounting: LedgerEntry + PlSnapshot + TaxRemittance
 * Mirrors pharma LedgerEntry pattern — double-entry bookkeeping layer.
 * Every financial event (sale, refund, expense, purchase payment) writes
 * a ledger entry. PlSnapshot is a pre-computed aggregate for fast dashboard reads.
 */
import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  text,
  jsonb,
  date,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { ledgerEntryTypeEnum, ledgerCategoryEnum } from './enums';
import { stores } from './organisation';
import { staffProfile } from './staff';

// ─── Ledger Entry (double-entry, append-only) ─────────────────────────────────
// Mirrors pharma LedgerEntry
export const ledgerEntries = pgTable(
  'ledger_entry',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    entryType: ledgerEntryTypeEnum('entry_type').notNull(),
    category: ledgerCategoryEnum('category').notNull(),
    amountPesewas: integer('amount_pesewas').notNull(), // always positive; type determines sign
    // Tax breakdown for revenue entries
    vatAmountPesewas: integer('vat_amount_pesewas').notNull().default(0),
    nhilAmountPesewas: integer('nhil_amount_pesewas').notNull().default(0),
    getfundAmountPesewas: integer('getfund_amount_pesewas').notNull().default(0),
    description: text('description').notNull(),
    // Source document reference
    referenceType: varchar('reference_type', { length: 50 }),  // 'sale'|'refund'|'expense'|'purchase'
    referenceId: uuid('reference_id'),
    performedById: uuid('performed_by_id').references(() => staffProfile.id),
    entryDate: timestamp('entry_date', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('ledger_store_date_idx').on(t.storeId, t.entryDate),
    index('ledger_category_idx').on(t.category),
    index('ledger_ref_idx').on(t.referenceType, t.referenceId),
  ],
);

// ─── P&L Snapshot (pre-computed, refreshed daily) ────────────────────────────
export const plSnapshots = pgTable(
  'pl_snapshot',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    periodType: varchar('period_type', { length: 20 }).notNull(), // 'daily'|'weekly'|'monthly'
    periodDate: date('period_date').notNull(),

    grossRevenuePesewas: integer('gross_revenue_pesewas').notNull().default(0),
    refundsTotalPesewas: integer('refunds_total_pesewas').notNull().default(0),
    netRevenuePesewas: integer('net_revenue_pesewas').notNull().default(0),

    // Ghana tax collected
    vatCollectedPesewas: integer('vat_collected_pesewas').notNull().default(0),
    nhilCollectedPesewas: integer('nhil_collected_pesewas').notNull().default(0),
    getfundCollectedPesewas: integer('getfund_collected_pesewas').notNull().default(0),

    // COGS
    cogsPesewas: integer('cogs_pesewas').notNull().default(0),
    grossProfitPesewas: integer('gross_profit_pesewas').notNull().default(0),

    totalExpensesPesewas: integer('total_expenses_pesewas').notNull().default(0),
    expenseBreakdown: jsonb('expense_breakdown').$type<Record<string, number>>().default({}),

    netProfitPesewas: integer('net_profit_pesewas').notNull().default(0),
    saleCount: integer('sale_count').notNull().default(0),

    computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('pl_snapshot_store_period_idx').on(t.storeId, t.periodType, t.periodDate),
  ],
);

// ─── Tax Remittance ───────────────────────────────────────────────────────────
export const taxRemittances = pgTable('tax_remittance', {
  id: uuid('id').defaultRandom().primaryKey(),
  storeId: uuid('store_id').notNull().references(() => stores.id),
  periodStartDate: date('period_start_date').notNull(),
  periodEndDate: date('period_end_date').notNull(),
  vatAmountPesewas: integer('vat_amount_pesewas').notNull().default(0),
  nhilAmountPesewas: integer('nhil_amount_pesewas').notNull().default(0),
  getfundAmountPesewas: integer('getfund_amount_pesewas').notNull().default(0),
  totalAmountPesewas: integer('total_amount_pesewas').notNull().default(0),
  remittedAt: timestamp('remitted_at', { withTimezone: true }),
  remittedById: uuid('remitted_by_id').references(() => staffProfile.id),
  referenceNumber: varchar('reference_number', { length: 100 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  store: one(stores, { fields: [ledgerEntries.storeId], references: [stores.id] }),
  performedBy: one(staffProfile, {
    fields: [ledgerEntries.performedById],
    references: [staffProfile.id],
  }),
}));

export const plSnapshotsRelations = relations(plSnapshots, ({ one }) => ({
  store: one(stores, { fields: [plSnapshots.storeId], references: [stores.id] }),
}));

export const taxRemittancesRelations = relations(taxRemittances, ({ one }) => ({
  store: one(stores, { fields: [taxRemittances.storeId], references: [stores.id] }),
  remittedBy: one(staffProfile, {
    fields: [taxRemittances.remittedById],
    references: [staffProfile.id],
  }),
}));
