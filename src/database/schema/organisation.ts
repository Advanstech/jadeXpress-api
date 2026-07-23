/**
 * Organisation & Store (Branch) tables
 * Mirrors the pharma schema's Organisation + Branch pattern.
 * JadeXpress starts with two stores: Israel Park + Sowutuom.
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { storeStatusEnum } from './enums';

// ─── Organisation (top-level entity) ─────────────────────────────────────────
export const organisation = pgTable('organisation', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().default('JadeXpress Enterprise'),
  tradingName: varchar('trading_name', { length: 255 }).default('The Vitamin Shop'),
  logoUrl: text('logo_url'),
  taxId: varchar('tax_id', { length: 100 }),           // Ghana TIN
  ghanaVatNumber: varchar('ghana_vat_number', { length: 100 }),
  currencyCode: varchar('currency_code', { length: 10 }).notNull().default('GHS'),
  // Ghana tax configuration (rates stored as basis points: 1500 = 15.00%)
  vatRateBps: integer('vat_rate_bps').notNull().default(1500),
  nhilRateBps: integer('nhil_rate_bps').notNull().default(250),
  getfundRateBps: integer('getfund_rate_bps').notNull().default(250),
  // Loyalty: points earned per GHS 1 spent
  loyaltyPointsPerGhs: integer('loyalty_points_per_ghs').notNull().default(1),
  // Points needed to redeem GHS 1
  loyaltyRedemptionRate: integer('loyalty_redemption_rate').notNull().default(100),
  settings: jsonb('settings').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Store (Branch) ───────────────────────────────────────────────────────────
export const stores = pgTable('store', {
  id: uuid('id').defaultRandom().primaryKey(),
  organisationId: uuid('organisation_id').notNull().references(() => organisation.id),
  code: varchar('code', { length: 20 }).notNull().unique(), // e.g. 'ISR', 'SWT'
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  city: varchar('city', { length: 100 }).notNull().default('Accra'),
  phone: varchar('phone', { length: 30 }),
  email: varchar('email', { length: 255 }),
  status: storeStatusEnum('status').notNull().default('active'),
  // Rx-capable store flag (Phase 2)
  rxEnabled: boolean('rx_enabled').notNull().default(false),
  // Terminal config: printer IP, cash drawer port, etc.
  terminalConfig: jsonb('terminal_config').$type<{
    printerIp?: string;
    printerPort?: number;
    printerType?: '58mm' | '80mm';
    cashDrawerEnabled?: boolean;
    receiptFooter?: string;
  }>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const organisationRelations = relations(organisation, ({ many }) => ({
  stores: many(stores),
}));

export const storesRelations = relations(stores, ({ one }) => ({
  organisation: one(organisation, {
    fields: [stores.organisationId],
    references: [organisation.id],
  }),
}));
