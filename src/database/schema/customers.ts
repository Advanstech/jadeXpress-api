/**
 * Customer + LoyaltyTransaction + Prescription (Phase 2 Rx)
 * Mirrors pharma: Customer, Prescription
 * Extensions: supplement health profile, loyalty, AI segments
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
import { prescriptionStatusEnum } from './enums';
import { staffProfile } from './staff';

// ─── Customer ─────────────────────────────────────────────────────────────────
export const customers = pgTable(
  'customer',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }),
    phone: varchar('phone', { length: 30 }).unique(),
    email: varchar('email', { length: 255 }).unique(),
    // Online storefront authentication (nullable — walk-in POS customers have no login)
    passwordHash: varchar('password_hash', { length: 255 }),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    avatarUrl: text('avatar_url'),
    dateOfBirth: date('date_of_birth'),
    gender: varchar('gender', { length: 20 }),
    address: text('address'),

    // Loyalty
    loyaltyPoints: integer('loyalty_points').notNull().default(0),
    loyaltyTier: varchar('loyalty_tier', { length: 30 }).notNull().default('standard'), // standard | gold | platinum
    totalSpendPesewas: integer('total_spend_pesewas').notNull().default(0),
    visitCount: integer('visit_count').notNull().default(0),
    lastVisitAt: timestamp('last_visit_at', { withTimezone: true }),

    // Supplement / health preferences — drives upsell prompts at checkout
    healthNotes: text('health_notes'),
    allergies: jsonb('allergies').$type<string[]>().default([]),
    preferredBrands: jsonb('preferred_brands').$type<string[]>().default([]),
    dietaryRestrictions: jsonb('dietary_restrictions').$type<string[]>().default([]),

    // AI-generated segment tags e.g. ["magnesium_buyer", "lapsed_60d", "vip"]
    segments: jsonb('segments').$type<string[]>().default([]),

    isActive: boolean('is_active').notNull().default(true),
    storeId: uuid('store_id'), // home store (nullable = multi-store customer)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('customer_phone_idx').on(t.phone),
    index('customer_email_idx').on(t.email),
    index('customer_store_idx').on(t.storeId),
  ],
);

// ─── Loyalty Transactions ─────────────────────────────────────────────────────
export const loyaltyTransactions = pgTable('loyalty_transaction', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  saleId: uuid('sale_id'),       // FK resolved after sales table
  refundId: uuid('refund_id'),   // FK resolved after refunds table
  pointsDelta: integer('points_delta').notNull(),  // + earn / - redeem
  balanceAfter: integer('balance_after').notNull(),
  reason: varchar('reason', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Prescription (DORMANT — Phase 2 Rx) ─────────────────────────────────────
// Mirrors pharma Prescription. Not active until store.rxEnabled = true.
export const prescriptions = pgTable('prescription', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  prescribedById: varchar('prescribed_by', { length: 255 }).notNull(), // doctor name/reg
  prescriptionDate: date('prescription_date').notNull(),
  expiryDate: date('expiry_date'),
  status: prescriptionStatusEnum('status').notNull().default('pending'),
  verifiedById: uuid('verified_by_id').references(() => staffProfile.id),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  imageUrl: text('image_url'), // scanned prescription photo
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const customersRelations = relations(customers, ({ many }) => ({
  loyaltyTransactions: many(loyaltyTransactions),
  prescriptions: many(prescriptions),
}));

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  customer: one(customers, {
    fields: [loyaltyTransactions.customerId],
    references: [customers.id],
  }),
}));

export const prescriptionsRelations = relations(prescriptions, ({ one }) => ({
  customer: one(customers, {
    fields: [prescriptions.customerId],
    references: [customers.id],
  }),
  verifiedBy: one(staffProfile, {
    fields: [prescriptions.verifiedById],
    references: [staffProfile.id],
  }),
}));
