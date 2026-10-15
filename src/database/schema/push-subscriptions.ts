/**
 * Web Push subscriptions — one row per browser/device per staff member.
 * The endpoint is unique: re-subscribing the same browser upserts.
 */
import { pgTable, uuid, text, varchar, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { stores } from './organisation';
import { staffProfile } from './staff';

export const pushSubscriptions = pgTable(
  'push_subscription',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    staffId: uuid('staff_id').notNull().references(() => staffProfile.id),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: varchar('user_agent', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('push_subscription_endpoint_unique').on(t.endpoint),
    index('push_subscription_store_idx').on(t.storeId),
    index('push_subscription_staff_idx').on(t.staffId),
  ],
);
