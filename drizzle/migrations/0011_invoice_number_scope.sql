-- Scope invoice_number uniqueness per supplier instead of globally.
-- Two different suppliers can legitimately use the same invoice number
-- ("INV-001"), which previously caused a unique-violation 500 mid-import.

ALTER TABLE "invoice" DROP CONSTRAINT IF EXISTS "invoice_invoice_number_unique";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_supplier_number_unique" ON "invoice" ("supplier_id", "invoice_number");
