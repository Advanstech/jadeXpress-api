import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  text,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { stores } from './organisation';
import { staffProfile } from './staff';

// ─── Payroll Cycle ────────────────────────────────────────────────────────────
export const payrollCycles = pgTable(
  'payroll_cycle',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    periodMonth: integer('period_month').notNull(),
    periodYear: integer('period_year').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('draft'), // draft, finalized, paid
    totalBasicPesewas: integer('total_basic_pesewas').notNull().default(0),
    totalDeductionsPesewas: integer('total_deductions_pesewas').notNull().default(0),
    totalNetPesewas: integer('total_net_pesewas').notNull().default(0),
    processedById: uuid('processed_by_id').references(() => staffProfile.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('payroll_cycle_store_idx').on(t.storeId),
  ],
);

// ─── Payslip ──────────────────────────────────────────────────────────────────
export const payslips = pgTable(
  'payslip',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    payrollCycleId: uuid('payroll_cycle_id').notNull().references(() => payrollCycles.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id').notNull().references(() => staffProfile.id),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    
    basicSalaryPesewas: integer('basic_salary_pesewas').notNull(),
    bonusesPesewas: integer('bonuses_pesewas').notNull().default(0),
    
    ssnitTier1Pesewas: integer('ssnit_tier1_pesewas').notNull().default(0),
    payeTaxPesewas: integer('paye_tax_pesewas').notNull().default(0),
    otherDeductionsPesewas: integer('other_deductions_pesewas').notNull().default(0),
    
    netPayPesewas: integer('net_pay_pesewas').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, paid
    
    paymentDate: timestamp('payment_date', { withTimezone: true }),
    paymentMethod: varchar('payment_method', { length: 50 }),
    paymentReference: varchar('payment_reference', { length: 100 }),
    notes: text('notes'),
    
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('payslip_staff_idx').on(t.staffId),
    index('payslip_cycle_idx').on(t.payrollCycleId),
  ],
);

export const payrollCyclesRelations = relations(payrollCycles, ({ one, many }) => ({
  store: one(stores, { fields: [payrollCycles.storeId], references: [stores.id] }),
  processedBy: one(staffProfile, { fields: [payrollCycles.processedById], references: [staffProfile.id] }),
  payslips: many(payslips),
}));

export const payslipsRelations = relations(payslips, ({ one }) => ({
  payrollCycle: one(payrollCycles, { fields: [payslips.payrollCycleId], references: [payrollCycles.id] }),
  staff: one(staffProfile, { fields: [payslips.staffId], references: [staffProfile.id] }),
  store: one(stores, { fields: [payslips.storeId], references: [stores.id] }),
}));
