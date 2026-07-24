/**
 * Staff & Auth tables
 * Mirrors pharma schema: StaffProfile + User + ShiftReconciliation
 */
import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  text,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { userRoleEnum, shiftStatusEnum } from './enums';
import { stores } from './organisation';

// ─── Staff Profile ────────────────────────────────────────────────────────────
// Mirrors pharma StaffProfile — extended for JadeXpress RBAC
export const staffProfile = pgTable(
  'staff_profile',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    email: varchar('email', { length: 255 }).unique(),
    phone: varchar('phone', { length: 30 }),
    role: userRoleEnum('role').notNull().default('cashier'),
    pinHash: varchar('pin_hash', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }),
    requiresPinChange: boolean('requires_pin_change').notNull().default(false),
    requiresPasswordChange: boolean('requires_password_change').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    failedPinAttempts: integer('failed_pin_attempts').notNull().default(0),
    pinLockedUntil: timestamp('pin_locked_until', { withTimezone: true }),
    biometricEnabled: boolean('biometric_enabled').notNull().default(false),
    avatarUrl: text('avatar_url'),
    idDocumentUrl: text('id_document_url'),
    // Permissions override (fine-grained, on top of role defaults)
    permissionsOverride: jsonb('permissions_override')
      .$type<Record<string, boolean>>()
      .default({}),
    // For pharmacist role (Phase 2 Rx)
    licenseNumber: varchar('license_number', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('staff_email_idx').on(t.email),
    index('staff_store_idx').on(t.storeId),
  ],
);

// ─── Refresh tokens ───────────────────────────────────────────────────────────
export const refreshTokens = pgTable('refresh_token', {
  id: uuid('id').defaultRandom().primaryKey(),
  staffId: uuid('staff_id')
    .notNull()
    .references(() => staffProfile.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  deviceInfo: text('device_info'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── OTP Tokens ───────────────────────────────────────────────────────────────
export const otpTokens = pgTable('otp_token', {
  id: uuid('id').defaultRandom().primaryKey(),
  staffId: uuid('staff_id')
    .notNull()
    .references(() => staffProfile.id, { onDelete: 'cascade' }),
  codeHash: varchar('code_hash', { length: 255 }).notNull(),
  channel: varchar('channel', { length: 20 }).notNull(), // 'email' or 'sms'
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Shift Reconciliation ─────────────────────────────────────────────────────
// Mirrors pharma ShiftReconciliation — owns the per-shift cash/MoMo tally
export const shiftReconciliation = pgTable(
  'shift_reconciliation',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staffProfile.id),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    status: shiftStatusEnum('status').notNull().default('open'),
    clockIn: timestamp('clock_in', { withTimezone: true }).defaultNow().notNull(),
    clockOut: timestamp('clock_out', { withTimezone: true }),
    // Opening float in pesewas
    openingFloat: integer('opening_float').notNull().default(0),
    // System-computed totals
    systemCashTotal: integer('system_cash_total').notNull().default(0),
    systemMomoTotal: integer('system_momo_total').notNull().default(0),
    systemCardTotal: integer('system_card_total').notNull().default(0),
    systemSaleCount: integer('system_sale_count').notNull().default(0),
    systemRefundTotal: integer('system_refund_total').notNull().default(0),
    // Physically counted cash
    physicalCashCount: integer('physical_cash_count').notNull().default(0),
    cashVariance: integer('cash_variance').notNull().default(0),
    // GHS denomination breakdown: [{denom: 200, count: 5, total: 1000}, ...]
    denominations: jsonb('denominations')
      .$type<Array<{ denom: number; count: number; total: number }>>()
      .default([]),
    varianceNotes: text('variance_notes'),
    reviewedById: uuid('reviewed_by_id').references(() => staffProfile.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('shift_staff_idx').on(t.staffId, t.storeId)],
);

// ─── Relations ────────────────────────────────────────────────────────────────
export const staffProfileRelations = relations(staffProfile, ({ one, many }) => ({
  store: one(stores, { fields: [staffProfile.storeId], references: [stores.id] }),
  shifts: many(shiftReconciliation),
  refreshTokens: many(refreshTokens),
  otpTokens: many(otpTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  staff: one(staffProfile, {
    fields: [refreshTokens.staffId],
    references: [staffProfile.id],
  }),
}));

export const otpTokensRelations = relations(otpTokens, ({ one }) => ({
  staff: one(staffProfile, {
    fields: [otpTokens.staffId],
    references: [staffProfile.id],
  }),
}));

export const shiftReconciliationRelations = relations(shiftReconciliation, ({ one }) => ({
  staff: one(staffProfile, {
    fields: [shiftReconciliation.staffId],
    references: [staffProfile.id],
  }),
  store: one(stores, {
    fields: [shiftReconciliation.storeId],
    references: [stores.id],
  }),
  reviewedBy: one(staffProfile, {
    fields: [shiftReconciliation.reviewedById],
    references: [staffProfile.id],
  }),
}));
