-- Track which purchase order created a product (supplier-invoice wizard).
-- Durable provenance so invoice deletion can distinguish products the
-- invoice brought (delete) from pre-existing catalog items (keep + reverse
-- stock). Heuristic inference was unreliable — a product created moments
-- before the PO looks identical to one created by it.

ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "created_by_purchase_order_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_created_by_po_fk') THEN
    ALTER TABLE "product" ADD CONSTRAINT "product_created_by_po_fk"
      FOREIGN KEY ("created_by_purchase_order_id") REFERENCES "purchase"("id")
      ON DELETE SET NULL;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_created_by_po_idx" ON "product" ("created_by_purchase_order_id");
