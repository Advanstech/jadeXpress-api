/**
 * End-of-Day Reconciliation
 * One record per store per business date.
 * Created at initEod, updated at closeEod.
 */
import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  text,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { stores } from './organisation';
import { staffProfile } from './staff';

export const eodStatusEnum = ['in_progress', 'completed', 'discrepancy'] as const;

export const eodRecords = pgTable(
  'eod_record',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    businessDate: date('business_date').notNull(),
    status: varchar('status', { length: 30 }).notNull().default('in_progress'),

    // System-computed totals (populated at initEod)
    systemCashTotal: integer('system_cash_total').notNull().default(0),
    systemMomoTotal: integer('system_momo_total').notNull().default(0),
    systemCardTotal: integer('system_card_total').notNull().default(0),
    systemTotal: integer('system_total').notNull().default(0),
    systemSaleCount: integer('system_sale_count').notNull().default(0),
    systemRefundTotal: integer('system_refund_total').notNull().default(0),
    systemExpenseTotal: integer('system_expense_total').notNull().default(0),

    // Opening float (from the shift)
    openingFloat: integer('opening_float').notNull().default(0),

    // Physical count (populated at closeEod)
    physicalCashCount: integer('physical_cash_count').notNull().default(0),
    denominations: jsonb('denominations')
      .$type<Array<{ denom: number; count: number; total: number }>>()
      .default([]),
    momoConfirmed: integer('momo_confirmed').notNull().default(0),

    // Variances
    cashVariance: integer('cash_variance').notNull().default(0),
    momoVariance: integer('momo_variance').notNull().default(0),
    varianceNotes: text('variance_notes'),

    closedById: uuid('closed_by_id').references(() => staffProfile.id),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('eod_store_date_unique').on(t.storeId, t.businessDate),
    index('eod_store_date_idx').on(t.storeId, t.businessDate),
  ],
);

export const eodRecordsRelations = relations(eodRecords, ({ one }) => ({
  store: one(stores, { fields: [eodRecords.storeId], references: [stores.id] }),
  closedBy: one(staffProfile, { fields: [eodRecords.closedById], references: [staffProfile.id] }),
}));
