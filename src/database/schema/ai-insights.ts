/**
 * AI Insights + Co-purchase Patterns + Demand Forecasts
 * Mirrors pharma AiInsight table — persists AI-generated outputs for display
 * and audit. The actual inference happens in the ai/ NestJS module; results
 * are stored here for fast retrieval without re-running inference.
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
import { aiInsightTypeEnum, alertSeverityEnum } from './enums';
import { products } from './inventory';
import { stores } from './organisation';

// ─── AI Insight (generic) ─────────────────────────────────────────────────────
// Mirrors pharma AiInsight — one row per AI output, keyed by type + entity
export const aiInsights = pgTable(
  'ai_insight',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').references(() => stores.id),
    type: aiInsightTypeEnum('type').notNull(),
    // Entity the insight is about (null = store-level)
    entityType: varchar('entity_type', { length: 50 }), // 'product'|'customer'|'sale'
    entityId: uuid('entity_id'),
    severity: alertSeverityEnum('severity').notNull().default('info'),
    title: varchar('title', { length: 255 }).notNull(),
    // Human-readable explanation — always shown alongside the insight
    reasoning: text('reasoning').notNull(),
    // Structured payload: forecast numbers, filter params, anomaly scores, etc.
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}),
    modelVersion: varchar('model_version', { length: 50 }).notNull().default('v1-stub'),
    // MOCKED_PENDING_MODEL_INTEGRATION flag — remove when real model is wired
    isMocked: boolean('is_mocked').notNull().default(true),
    isDismissed: boolean('is_dismissed').notNull().default(false),
    isActioned: boolean('is_actioned').notNull().default(false),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('ai_insight_type_entity_idx').on(t.type, t.entityType, t.entityId),
    index('ai_insight_store_idx').on(t.storeId),
  ],
);

// ─── Demand Forecast ──────────────────────────────────────────────────────────
// Structured forecast records — linked to ai_insight for the reasoning copy
export const demandForecasts = pgTable(
  'demand_forecast',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    forecastDate: date('forecast_date').notNull(),
    horizonDays: integer('horizon_days').notNull().default(30),
    predictedUnits: integer('predicted_units').notNull(),
    confidenceLow: integer('confidence_low').notNull(),
    confidenceHigh: integer('confidence_high').notNull(),
    daysOfStockLeft: integer('days_of_stock_left').notNull(),
    suggestedReorderQty: integer('suggested_reorder_qty').notNull(),
    // e.g. { trend: 'up', seasonality: 1.2, promoLift: 0.0 }
    signals: jsonb('signals').$type<Record<string, unknown>>().default({}),
    reasoning: text('reasoning').notNull(),
    isMocked: boolean('is_mocked').notNull().default(true),
    modelVersion: varchar('model_version', { length: 50 }).notNull().default('v1-stub'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('demand_forecast_product_store_idx').on(t.productId, t.storeId, t.forecastDate),
  ],
);

// ─── Co-purchase Patterns (for upsell recommendations) ───────────────────────
export const coPurchasePatterns = pgTable(
  'co_purchase_pattern',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    productAId: uuid('product_a_id').notNull().references(() => products.id),
    productBId: uuid('product_b_id').notNull().references(() => products.id),
    coOccurrenceCount: integer('co_occurrence_count').notNull().default(0),
    // 0–100 confidence that buying A predicts buying B
    confidenceScore: integer('confidence_score').notNull().default(0),
    liftScore: integer('lift_score').notNull().default(100), // 100 = no lift
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('co_purchase_store_product_idx').on(t.storeId, t.productAId),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────
export const aiInsightsRelations = relations(aiInsights, ({ one }) => ({
  store: one(stores, { fields: [aiInsights.storeId], references: [stores.id] }),
}));

export const demandForecastsRelations = relations(demandForecasts, ({ one }) => ({
  product: one(products, { fields: [demandForecasts.productId], references: [products.id] }),
  store: one(stores, { fields: [demandForecasts.storeId], references: [stores.id] }),
}));

export const coPurchasePatternsRelations = relations(coPurchasePatterns, ({ one }) => ({
  store: one(stores, { fields: [coPurchasePatterns.storeId], references: [stores.id] }),
  productA: one(products, { fields: [coPurchasePatterns.productAId], references: [products.id] }),
  productB: one(products, { fields: [coPurchasePatterns.productBId], references: [products.id] }),
}));
