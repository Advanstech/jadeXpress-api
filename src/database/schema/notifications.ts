/**
 * NotificationLog + AuditLog
 * Mirrors pharma: NotificationLog, AuditLog
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { notificationChannelEnum, auditActionEnum } from './enums';
import { stores } from './organisation';
import { staffProfile } from './staff';

// ─── Notification Log ─────────────────────────────────────────────────────────
// Mirrors pharma NotificationLog
export const notificationLog = pgTable(
  'notification_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').references(() => stores.id),
    recipientId: uuid('recipient_id').references(() => staffProfile.id),
    channel: notificationChannelEnum('channel').notNull().default('in_app'),
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body').notNull(),
    // Link to the source entity
    entityType: varchar('entity_type', { length: 50 }),
    entityId: uuid('entity_id'),
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),
    // For push/SMS — delivery status from provider
    deliveryStatus: varchar('delivery_status', { length: 50 }).default('pending'),
    externalRef: varchar('external_ref', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('notif_recipient_idx').on(t.recipientId, t.isRead),
    index('notif_store_idx').on(t.storeId),
  ],
);

// ─── Audit Log ────────────────────────────────────────────────────────────────
// Mirrors pharma AuditLog — immutable. Never updated or deleted.
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').references(() => stores.id),
    staffId: uuid('staff_id').references(() => staffProfile.id),
    action: auditActionEnum('action').notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: uuid('entity_id'),
    // Snapshot of changed fields: { before: {...}, after: {...} }
    changeset: jsonb('changeset').$type<{
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
    }>().default({}),
    ipAddress: varchar('ip_address', { length: 50 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('audit_staff_idx').on(t.staffId),
    index('audit_entity_idx').on(t.entityType, t.entityId),
    index('audit_created_idx').on(t.createdAt),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────
export const notificationLogRelations = relations(notificationLog, ({ one }) => ({
  store: one(stores, { fields: [notificationLog.storeId], references: [stores.id] }),
  recipient: one(staffProfile, {
    fields: [notificationLog.recipientId],
    references: [staffProfile.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  store: one(stores, { fields: [auditLog.storeId], references: [stores.id] }),
  staff: one(staffProfile, { fields: [auditLog.staffId], references: [staffProfile.id] }),
}));
