/**
 * Storefront (online orders) — CustomerAddress, CustomerRefreshToken,
 * StorefrontOrder, StorefrontOrderItem.
 *
 * Kept separate from the POS `sale` table: online orders are placed by
 * customers (no cashier/shift), carry a shipping address + courier info,
 * and may be fulfilled from any store. A future step can convert a
 * fulfilled storefront_order into a `sale` for unified accounting.
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
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { storefrontOrderStatusEnum, storefrontPaymentStatusEnum } from './enums';
import { customers } from './customers';
import { products } from './inventory';
import { stores } from './organisation';

// ─── Customer Address ─────────────────────────────────────────────────────────
export const customerAddresses = pgTable(
  'customer_address',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 50 }).notNull().default('Home'),
    recipientName: varchar('recipient_name', { length: 150 }).notNull(),
    phone: varchar('phone', { length: 30 }).notNull(),
    country: varchar('country', { length: 100 }).notNull().default('Ghana'),
    region: varchar('region', { length: 100 }).notNull(),
    city: varchar('city', { length: 100 }).notNull(),
    street: text('street').notNull(),
    digitalAddress: varchar('digital_address', { length: 30 }),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('customer_address_customer_idx').on(t.customerId)],
);

// ─── Customer Refresh Token (mirrors staff refresh_token) ─────────────────────
export const customerRefreshTokens = pgTable('customer_refresh_token', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  deviceInfo: text('device_info'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Storefront Order ─────────────────────────────────────────────────────────
export const storefrontOrders = pgTable(
  'storefront_order',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderNumber: varchar('order_number', { length: 40 }).notNull().unique(),
    customerId: uuid('customer_id').references(() => customers.id), // null = guest checkout
    storeId: uuid('store_id').references(() => stores.id), // fulfilling store, assigned later
    email: varchar('email', { length: 255 }).notNull(),

    status: storefrontOrderStatusEnum('status').notNull().default('pending'),
    paymentStatus: storefrontPaymentStatusEnum('payment_status').notNull().default('unpaid'),
    paymentReference: varchar('payment_reference', { length: 150 }),
    paymentGateway: varchar('payment_gateway', { length: 30 }), // paystack | momo
    paymentMethod: varchar('payment_method', { length: 30 }),

    subtotalPesewas: integer('subtotal_pesewas').notNull().default(0),
    shippingFeePesewas: integer('shipping_fee_pesewas').notNull().default(0),
    totalPesewas: integer('total_pesewas').notNull().default(0),
    currency: varchar('currency', { length: 10 }).notNull().default('GHS'),

    shippingAddress: jsonb('shipping_address').$type<{
      recipientName: string;
      phone: string;
      email: string;
      country: string;
      region: string;
      city: string;
      street: string;
      digitalAddress?: string | null;
      courier?: {
        provider?: string;
        service?: string;
        eta?: string;
        trackingNumber?: string;
      } | null;
    }>().notNull(),

    timeline: jsonb('timeline')
      .$type<Array<{ status: string; note: string; createdAt: string }>>()
      .default([]),

    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('storefront_order_customer_idx').on(t.customerId),
    index('storefront_order_number_idx').on(t.orderNumber),
    index('storefront_order_email_idx').on(t.email),
  ],
);

// ─── Storefront Order Item ────────────────────────────────────────────────────
export const storefrontOrderItems = pgTable('storefront_order_item', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => storefrontOrders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id),
  name: varchar('name', { length: 255 }).notNull(),
  pricePesewas: integer('price_pesewas').notNull(),
  quantity: integer('quantity').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const customerAddressesRelations = relations(customerAddresses, ({ one }) => ({
  customer: one(customers, { fields: [customerAddresses.customerId], references: [customers.id] }),
}));

export const customerRefreshTokensRelations = relations(customerRefreshTokens, ({ one }) => ({
  customer: one(customers, { fields: [customerRefreshTokens.customerId], references: [customers.id] }),
}));

export const storefrontOrdersRelations = relations(storefrontOrders, ({ one, many }) => ({
  customer: one(customers, { fields: [storefrontOrders.customerId], references: [customers.id] }),
  store: one(stores, { fields: [storefrontOrders.storeId], references: [stores.id] }),
  items: many(storefrontOrderItems),
}));

export const storefrontOrderItemsRelations = relations(storefrontOrderItems, ({ one }) => ({
  order: one(storefrontOrders, { fields: [storefrontOrderItems.orderId], references: [storefrontOrders.id] }),
  product: one(products, { fields: [storefrontOrderItems.productId], references: [products.id] }),
}));
