import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { staffProfile } from './staff';
import { stores } from './organisation';
import { relations } from 'drizzle-orm';

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  staffId: uuid('staff_id').references(() => staffProfile.id),
  storeId: uuid('store_id').references(() => stores.id),
  action: varchar('action', { length: 255 }).notNull(),
  entityType: varchar('entity_type', { length: 255 }).notNull(),
  entityId: varchar('entity_id', { length: 255 }),
  oldData: jsonb('old_data').$type<Record<string, unknown>>(),
  newData: jsonb('new_data').$type<Record<string, unknown>>(),
  ipAddress: varchar('ip_address', { length: 100 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  staff: one(staffProfile, {
    fields: [auditLogs.staffId],
    references: [staffProfile.id],
  }),
  store: one(stores, {
    fields: [auditLogs.storeId],
    references: [stores.id],
  }),
}));
