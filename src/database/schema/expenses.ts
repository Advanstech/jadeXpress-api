/**
 * Expense + ExpenseCategory + Budget + BudgetActual
 * Mirrors pharma: Expense, ExpenseCategory, Budget, BudgetActual
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
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { expenseCategoryEnum } from './enums';
import { stores } from './organisation';
import { staffProfile } from './staff';

// ─── Expense Category (custom, user-defined) ──────────────────────────────────
// Mirrors pharma ExpenseCategory — allows manager to add store-specific categories
// NOTE: Table name is 'expense_categories' (plural) to avoid collision with
// the Postgres enum type 'expense_category' in the same schema.
export const expenseCategories = pgTable('expense_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  storeId: uuid('store_id').references(() => stores.id), // null = org-wide
  // Maps to the system enum for default categories; null for custom
  systemCode: expenseCategoryEnum('system_code'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Expense ──────────────────────────────────────────────────────────────────
export const expenses = pgTable(
  'expense',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => expenseCategories.id),
    description: varchar('description', { length: 500 }).notNull(),
    amountPesewas: integer('amount_pesewas').notNull(),
    expenseDate: timestamp('expense_date', { withTimezone: true }).defaultNow().notNull(),
    recordedById: uuid('recorded_by_id').references(() => staffProfile.id),
    approvedById: uuid('approved_by_id').references(() => staffProfile.id),
    // Receipt image (from device camera via Tauri or uploaded file)
    receiptImageUrl: text('receipt_image_url'),
    // OCR extraction tracking
    ocrExtracted: boolean('ocr_extracted').notNull().default(false),
    ocrConfirmed: boolean('ocr_confirmed').notNull().default(false),
    vendor: varchar('vendor', { length: 255 }),
    referenceNumber: varchar('reference_number', { length: 100 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('expense_store_date_idx').on(t.storeId, t.expenseDate),
    index('expense_category_idx').on(t.categoryId),
  ],
);

// ─── Budget ───────────────────────────────────────────────────────────────────
// Mirrors pharma Budget
export const budgets = pgTable('budget', {
  id: uuid('id').defaultRandom().primaryKey(),
  storeId: uuid('store_id').notNull().references(() => stores.id),
  categoryId: uuid('category_id').references(() => expenseCategories.id),
  periodMonth: varchar('period_month', { length: 7 }).notNull(), // "2026-07"
  budgetedAmountPesewas: integer('budgeted_amount_pesewas').notNull(),
  notes: text('notes'),
  createdById: uuid('created_by_id').references(() => staffProfile.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Budget Actual ────────────────────────────────────────────────────────────
// Mirrors pharma BudgetActual — computed actuals linked to budgets
export const budgetActuals = pgTable('budget_actual', {
  id: uuid('id').defaultRandom().primaryKey(),
  budgetId: uuid('budget_id')
    .notNull()
    .references(() => budgets.id, { onDelete: 'cascade' }),
  actualAmountPesewas: integer('actual_amount_pesewas').notNull().default(0),
  variancePesewas: integer('variance_pesewas').notNull().default(0), // budget - actual
  computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const expenseCategoriesRelations = relations(expenseCategories, ({ one, many }) => ({
  store: one(stores, { fields: [expenseCategories.storeId], references: [stores.id] }),
  expenses: many(expenses),
  budgets: many(budgets),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  store: one(stores, { fields: [expenses.storeId], references: [stores.id] }),
  category: one(expenseCategories, {
    fields: [expenses.categoryId],
    references: [expenseCategories.id],
  }),
  recordedBy: one(staffProfile, {
    fields: [expenses.recordedById],
    references: [staffProfile.id],
  }),
  approvedBy: one(staffProfile, {
    fields: [expenses.approvedById],
    references: [staffProfile.id],
  }),
}));

export const budgetsRelations = relations(budgets, ({ one, many }) => ({
  store: one(stores, { fields: [budgets.storeId], references: [stores.id] }),
  category: one(expenseCategories, {
    fields: [budgets.categoryId],
    references: [expenseCategories.id],
  }),
  actuals: many(budgetActuals),
}));

export const budgetActualsRelations = relations(budgetActuals, ({ one }) => ({
  budget: one(budgets, { fields: [budgetActuals.budgetId], references: [budgets.id] }),
}));
