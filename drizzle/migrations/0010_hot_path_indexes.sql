-- Hot-path indexes for POS, reporting, accounting, and dashboard performance.
-- These cover the queries that run most frequently under concurrent load.

-- sale_item: critical for voidSale and refunds (WHERE sale_id = ?)
CREATE INDEX IF NOT EXISTS "sale_item_sale_idx" ON "sale_item" ("sale_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_item_product_idx" ON "sale_item" ("product_id");--> statement-breakpoint

-- sale: composite for store-scoped status+date queries (accounting, reporting, dashboard)
CREATE INDEX IF NOT EXISTS "sale_store_status_created_idx" ON "sale" ("store_id", "status", "created_at");--> statement-breakpoint

-- stock_movement: store-scoped date queries (dashboard live feed, COGS)
CREATE INDEX IF NOT EXISTS "stock_movement_store_created_idx" ON "stock_movement" ("store_id", "created_at");--> statement-breakpoint

-- refund_request: store-scoped date queries (dashboard live feed)
CREATE INDEX IF NOT EXISTS "refund_store_created_idx" ON "refund_request" ("store_id", "created_at");--> statement-breakpoint

-- stock_alert: store-scoped dismissed filter (dashboard alerts)
CREATE INDEX IF NOT EXISTS "stock_alert_store_dismissed_idx" ON "stock_alert" ("store_id", "is_dismissed");--> statement-breakpoint

-- stock_batch: store-scoped active filter (expiring batches query)
CREATE INDEX IF NOT EXISTS "stock_batch_store_active_idx" ON "stock_batch" ("store_id", "is_active");
