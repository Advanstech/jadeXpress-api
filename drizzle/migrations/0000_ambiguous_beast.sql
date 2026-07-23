CREATE TYPE "public"."ai_insight_type" AS ENUM('demand_forecast', 'reorder_suggestion', 'expiry_risk', 'upsell_recommendation', 'anomaly_detected', 'nl_query_result', 'ocr_extraction');--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'login', 'logout', 'pin_auth', 'override', 'export', 'print');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('rent', 'utilities', 'salaries', 'supplies', 'marketing', 'maintenance', 'transport', 'regulatory', 'insurance', 'miscellaneous');--> statement-breakpoint
CREATE TYPE "public"."ledger_category" AS ENUM('revenue', 'cost_of_goods', 'expense', 'tax', 'refund', 'adjustment', 'opening_balance');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'sms', 'email', 'push');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'partial', 'overpaid', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."prescription_status" AS ENUM('pending', 'verified', 'dispensed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'inactive', 'discontinued', 'pending_review');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('supplement', 'beauty', 'otc_medicine', 'rx_medicine', 'equipment', 'consumable');--> statement-breakpoint
CREATE TYPE "public"."purchase_order_status" AS ENUM('draft', 'submitted', 'acknowledged', 'partial', 'received', 'invoiced', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."refund_method" AS ENUM('cash', 'momo', 'card', 'store_credit');--> statement-breakpoint
CREATE TYPE "public"."refund_reason" AS ENUM('customer_request', 'defective_product', 'wrong_item', 'overcharge', 'duplicate_sale', 'near_expiry', 'other');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending_approval', 'approved', 'rejected', 'processed');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('held', 'in_progress', 'completed', 'voided', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('open', 'closed', 'discrepancy');--> statement-breakpoint
CREATE TYPE "public"."stock_alert_type" AS ENUM('low_stock', 'out_of_stock', 'expiry_soon', 'expiry_critical', 'overstock', 'reorder_due');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('purchase_in', 'sale_out', 'return_in', 'adjustment_in', 'adjustment_out', 'transfer_in', 'transfer_out', 'opening_stock');--> statement-breakpoint
CREATE TYPE "public"."stock_transfer_status" AS ENUM('draft', 'in_transit', 'received', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."store_status" AS ENUM('active', 'inactive', 'coming_soon');--> statement-breakpoint
CREATE TYPE "public"."supplier_performance_rating" AS ENUM('excellent', 'good', 'fair', 'poor');--> statement-breakpoint
CREATE TYPE "public"."tender_type" AS ENUM('cash', 'momo', 'card', 'store_credit', 'split');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'manager', 'supervisor', 'cashier', 'pharmacist', 'stock_officer');--> statement-breakpoint
CREATE TABLE "organisation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) DEFAULT 'JadeXpress Enterprise' NOT NULL,
	"trading_name" varchar(255) DEFAULT 'The Vitamin Shop',
	"logo_url" text,
	"tax_id" varchar(100),
	"ghana_vat_number" varchar(100),
	"currency_code" varchar(10) DEFAULT 'GHS' NOT NULL,
	"vat_rate_bps" integer DEFAULT 1500 NOT NULL,
	"nhil_rate_bps" integer DEFAULT 250 NOT NULL,
	"getfund_rate_bps" integer DEFAULT 250 NOT NULL,
	"loyalty_points_per_ghs" integer DEFAULT 1 NOT NULL,
	"loyalty_redemption_rate" integer DEFAULT 100 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"city" varchar(100) DEFAULT 'Accra' NOT NULL,
	"phone" varchar(30),
	"email" varchar(255),
	"status" "store_status" DEFAULT 'active' NOT NULL,
	"rx_enabled" boolean DEFAULT false NOT NULL,
	"terminal_config" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "refresh_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"device_info" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "shift_reconciliation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"status" "shift_status" DEFAULT 'open' NOT NULL,
	"clock_in" timestamp with time zone DEFAULT now() NOT NULL,
	"clock_out" timestamp with time zone,
	"opening_float" integer DEFAULT 0 NOT NULL,
	"system_cash_total" integer DEFAULT 0 NOT NULL,
	"system_momo_total" integer DEFAULT 0 NOT NULL,
	"system_card_total" integer DEFAULT 0 NOT NULL,
	"system_sale_count" integer DEFAULT 0 NOT NULL,
	"system_refund_total" integer DEFAULT 0 NOT NULL,
	"physical_cash_count" integer DEFAULT 0 NOT NULL,
	"cash_variance" integer DEFAULT 0 NOT NULL,
	"denominations" jsonb DEFAULT '[]'::jsonb,
	"variance_notes" text,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255),
	"phone" varchar(30),
	"role" "user_role" DEFAULT 'cashier' NOT NULL,
	"pin_hash" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"biometric_enabled" boolean DEFAULT false NOT NULL,
	"avatar_url" text,
	"permissions_override" jsonb DEFAULT '{}'::jsonb,
	"license_number" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_profile_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "invoice_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"paid_by_id" uuid,
	"amount_pesewas" integer NOT NULL,
	"payment_date" timestamp with time zone DEFAULT now() NOT NULL,
	"method" varchar(50) DEFAULT 'bank_transfer' NOT NULL,
	"reference" varchar(100),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity_ordered" integer NOT NULL,
	"quantity_received" integer DEFAULT 0 NOT NULL,
	"unit_cost_pesewas" integer NOT NULL,
	"total_cost_pesewas" integer NOT NULL,
	"batch_number" varchar(100),
	"expiry_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"po_number" varchar(60) NOT NULL,
	"store_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"raised_by_id" uuid,
	"approved_by_id" uuid,
	"status" "purchase_order_status" DEFAULT 'draft' NOT NULL,
	"order_date" timestamp with time zone DEFAULT now() NOT NULL,
	"expected_delivery_date" date,
	"delivered_at" timestamp with time zone,
	"subtotal_pesewas" integer DEFAULT 0 NOT NULL,
	"tax_pesewas" integer DEFAULT 0 NOT NULL,
	"total_pesewas" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
CREATE TABLE "_store_suppliers" (
	"store_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" varchar(100) NOT NULL,
	"supplier_id" uuid NOT NULL,
	"purchase_order_id" uuid,
	"issued_date" date NOT NULL,
	"due_date" date,
	"total_amount_pesewas" integer NOT NULL,
	"paid_amount_pesewas" integer DEFAULT 0 NOT NULL,
	"balance_pesewas" integer DEFAULT 0 NOT NULL,
	"image_url" text,
	"ocr_extracted" boolean DEFAULT false NOT NULL,
	"ocr_confirmed" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "supplier_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"period_month" varchar(7) NOT NULL,
	"on_time_delivery_rate" integer DEFAULT 0 NOT NULL,
	"fill_rate" integer DEFAULT 0 NOT NULL,
	"quality_reject_rate" integer DEFAULT 0 NOT NULL,
	"rating" "supplier_performance_rating" DEFAULT 'good' NOT NULL,
	"notes" text,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(255) NOT NULL,
	"contact_person" varchar(255),
	"email" varchar(255),
	"phone" varchar(30),
	"address" text,
	"city" varchar(100),
	"country" varchar(100) DEFAULT 'Ghana' NOT NULL,
	"tax_id" varchar(100),
	"payment_terms_days" integer DEFAULT 30 NOT NULL,
	"credit_limit_pesewas" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"catalogue_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"slug" varchar(150) NOT NULL,
	"description" text,
	"parent_id" uuid,
	"icon_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_name_unique" UNIQUE("name"),
	CONSTRAINT "category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(100) NOT NULL,
	"barcode" varchar(100),
	"name" varchar(255) NOT NULL,
	"generic_name" varchar(255),
	"description" text,
	"category_id" uuid,
	"primary_supplier_id" uuid,
	"type" "product_type" DEFAULT 'supplement' NOT NULL,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"cost_price_pesewas" integer DEFAULT 0 NOT NULL,
	"selling_price_pesewas" integer DEFAULT 0 NOT NULL,
	"taxable" boolean DEFAULT true NOT NULL,
	"unit" varchar(50) DEFAULT 'piece' NOT NULL,
	"pack_size" integer DEFAULT 1 NOT NULL,
	"image_url" text,
	"dosage_form" varchar(100),
	"strength" varchar(100),
	"manufacturer" varchar(255),
	"country_of_origin" varchar(100),
	"storage_instructions" text,
	"allergens" jsonb DEFAULT '[]'::jsonb,
	"warnings" text,
	"requires_prescription" boolean DEFAULT false NOT NULL,
	"schedule_class" varchar(20),
	"nafdac_number" varchar(100),
	"reorder_point" integer DEFAULT 5 NOT NULL,
	"reorder_qty" integer DEFAULT 10 NOT NULL,
	"min_stock_level" integer DEFAULT 0 NOT NULL,
	"max_stock_level" integer,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"search_vector" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_sku_unique" UNIQUE("sku"),
	CONSTRAINT "product_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "rx_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"prescription_id" uuid,
	"dispensed_by_id" uuid,
	"quantity" integer NOT NULL,
	"instructions" text,
	"dispensed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_alert" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"batch_id" uuid,
	"type" "stock_alert_type" NOT NULL,
	"severity" "alert_severity" DEFAULT 'warning' NOT NULL,
	"message" text NOT NULL,
	"quantity_on_hand" integer,
	"expiry_date" date,
	"is_dismissed" boolean DEFAULT false NOT NULL,
	"dismissed_by_id" uuid,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"supplier_id" uuid,
	"purchase_order_id" uuid,
	"batch_number" varchar(100),
	"quantity_received" integer NOT NULL,
	"quantity_remaining" integer NOT NULL,
	"cost_price_pesewas" integer NOT NULL,
	"expiry_date" date,
	"manufactured_date" date,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"quantity_on_hand" integer DEFAULT 0 NOT NULL,
	"quantity_reserved" integer DEFAULT 0 NOT NULL,
	"quantity_on_order" integer DEFAULT 0 NOT NULL,
	"reorder_point_override" integer,
	"reorder_qty_override" integer,
	"selling_price_override" integer,
	"last_count_date" timestamp with time zone,
	"last_movement_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"batch_id" uuid,
	"type" "stock_movement_type" NOT NULL,
	"quantity_change" integer NOT NULL,
	"quantity_before" integer NOT NULL,
	"quantity_after" integer NOT NULL,
	"cost_price_pesewas" integer,
	"reference_type" varchar(50),
	"reference_id" uuid,
	"performed_by_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_transfer_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"batch_id" uuid,
	"quantity_requested" integer NOT NULL,
	"quantity_dispatched" integer DEFAULT 0 NOT NULL,
	"quantity_received" integer DEFAULT 0 NOT NULL,
	"unit_cost_pesewas" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_transfer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_number" varchar(50) NOT NULL,
	"from_store_id" uuid NOT NULL,
	"to_store_id" uuid NOT NULL,
	"status" "stock_transfer_status" DEFAULT 'draft' NOT NULL,
	"initiated_by_id" uuid,
	"received_by_id" uuid,
	"notes" text,
	"dispatched_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_transfer_transfer_number_unique" UNIQUE("transfer_number")
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100),
	"phone" varchar(30),
	"email" varchar(255),
	"date_of_birth" date,
	"gender" varchar(20),
	"address" text,
	"loyalty_points" integer DEFAULT 0 NOT NULL,
	"loyalty_tier" varchar(30) DEFAULT 'standard' NOT NULL,
	"total_spend_pesewas" integer DEFAULT 0 NOT NULL,
	"visit_count" integer DEFAULT 0 NOT NULL,
	"last_visit_at" timestamp with time zone,
	"health_notes" text,
	"allergies" jsonb DEFAULT '[]'::jsonb,
	"preferred_brands" jsonb DEFAULT '[]'::jsonb,
	"dietary_restrictions" jsonb DEFAULT '[]'::jsonb,
	"segments" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"store_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_phone_unique" UNIQUE("phone"),
	CONSTRAINT "customer_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "loyalty_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"sale_id" uuid,
	"refund_id" uuid,
	"points_delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reason" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"prescribed_by" varchar(255) NOT NULL,
	"prescription_date" date NOT NULL,
	"expiry_date" date,
	"status" "prescription_status" DEFAULT 'pending' NOT NULL,
	"verified_by_id" uuid,
	"verified_at" timestamp with time zone,
	"image_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"method" "tender_type" NOT NULL,
	"amount_pesewas" integer NOT NULL,
	"reference" varchar(100),
	"status" "payment_status" DEFAULT 'paid' NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"refund_request_id" uuid NOT NULL,
	"sale_item_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_pesewas" integer NOT NULL,
	"line_total_pesewas" integer NOT NULL,
	"restock_to_inventory" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"initiated_by_id" uuid,
	"authorized_by_id" uuid,
	"reason" "refund_reason" NOT NULL,
	"method" "refund_method" DEFAULT 'cash' NOT NULL,
	"status" "refund_status" DEFAULT 'pending_approval' NOT NULL,
	"total_amount_pesewas" integer NOT NULL,
	"momo_reference" varchar(100),
	"inventory_restocked" boolean DEFAULT false NOT NULL,
	"accounting_adjusted" boolean DEFAULT false NOT NULL,
	"notes" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"batch_id" uuid,
	"quantity" integer NOT NULL,
	"unit_price_pesewas" integer NOT NULL,
	"discount_amount_pesewas" integer DEFAULT 0 NOT NULL,
	"line_total_pesewas" integer NOT NULL,
	"product_name_snapshot" varchar(255) NOT NULL,
	"product_sku_snapshot" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"receipt_number" varchar(60) NOT NULL,
	"store_id" uuid NOT NULL,
	"cashier_id" uuid NOT NULL,
	"customer_id" uuid,
	"shift_id" uuid,
	"status" "sale_status" DEFAULT 'in_progress' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"subtotal_pesewas" integer DEFAULT 0 NOT NULL,
	"discount_amount_pesewas" integer DEFAULT 0 NOT NULL,
	"vat_amount_pesewas" integer DEFAULT 0 NOT NULL,
	"nhil_amount_pesewas" integer DEFAULT 0 NOT NULL,
	"getfund_amount_pesewas" integer DEFAULT 0 NOT NULL,
	"total_pesewas" integer DEFAULT 0 NOT NULL,
	"tendered_pesewas" integer DEFAULT 0 NOT NULL,
	"change_pesewas" integer DEFAULT 0 NOT NULL,
	"tender_type" "tender_type" DEFAULT 'cash' NOT NULL,
	"tender_breakdown" jsonb DEFAULT '[]'::jsonb,
	"momo_reference" varchar(100),
	"card_reference" varchar(100),
	"loyalty_points_earned" integer DEFAULT 0 NOT NULL,
	"loyalty_points_redeemed" integer DEFAULT 0 NOT NULL,
	"loyalty_redeem_value_pesewas" integer DEFAULT 0 NOT NULL,
	"discount_authorized_by_id" uuid,
	"receipt_printed" boolean DEFAULT false NOT NULL,
	"receipt_printed_at" timestamp with time zone,
	"held_at" timestamp with time zone,
	"held_note" text,
	"created_offline" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone,
	"notes" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_client_id_unique" UNIQUE("client_id"),
	CONSTRAINT "sale_receipt_number_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
CREATE TABLE "budget_actual" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"actual_amount_pesewas" integer DEFAULT 0 NOT NULL,
	"variance_pesewas" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"category_id" uuid,
	"period_month" varchar(7) NOT NULL,
	"budgeted_amount_pesewas" integer NOT NULL,
	"notes" text,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"store_id" uuid,
	"system_code" "expense_category",
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"amount_pesewas" integer NOT NULL,
	"expense_date" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_by_id" uuid,
	"approved_by_id" uuid,
	"receipt_image_url" text,
	"ocr_extracted" boolean DEFAULT false NOT NULL,
	"ocr_confirmed" boolean DEFAULT false NOT NULL,
	"vendor" varchar(255),
	"reference_number" varchar(100),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"entry_type" "ledger_entry_type" NOT NULL,
	"category" "ledger_category" NOT NULL,
	"amount_pesewas" integer NOT NULL,
	"vat_amount_pesewas" integer DEFAULT 0 NOT NULL,
	"nhil_amount_pesewas" integer DEFAULT 0 NOT NULL,
	"getfund_amount_pesewas" integer DEFAULT 0 NOT NULL,
	"description" text NOT NULL,
	"reference_type" varchar(50),
	"reference_id" uuid,
	"performed_by_id" uuid,
	"entry_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pl_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"period_type" varchar(20) NOT NULL,
	"period_date" date NOT NULL,
	"gross_revenue_pesewas" integer DEFAULT 0 NOT NULL,
	"refunds_total_pesewas" integer DEFAULT 0 NOT NULL,
	"net_revenue_pesewas" integer DEFAULT 0 NOT NULL,
	"vat_collected_pesewas" integer DEFAULT 0 NOT NULL,
	"nhil_collected_pesewas" integer DEFAULT 0 NOT NULL,
	"getfund_collected_pesewas" integer DEFAULT 0 NOT NULL,
	"cogs_pesewas" integer DEFAULT 0 NOT NULL,
	"gross_profit_pesewas" integer DEFAULT 0 NOT NULL,
	"total_expenses_pesewas" integer DEFAULT 0 NOT NULL,
	"expense_breakdown" jsonb DEFAULT '{}'::jsonb,
	"net_profit_pesewas" integer DEFAULT 0 NOT NULL,
	"sale_count" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_remittance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"period_start_date" date NOT NULL,
	"period_end_date" date NOT NULL,
	"vat_amount_pesewas" integer DEFAULT 0 NOT NULL,
	"nhil_amount_pesewas" integer DEFAULT 0 NOT NULL,
	"getfund_amount_pesewas" integer DEFAULT 0 NOT NULL,
	"total_amount_pesewas" integer DEFAULT 0 NOT NULL,
	"remitted_at" timestamp with time zone,
	"remitted_by_id" uuid,
	"reference_number" varchar(100),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_insight" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid,
	"type" "ai_insight_type" NOT NULL,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"severity" "alert_severity" DEFAULT 'info' NOT NULL,
	"title" varchar(255) NOT NULL,
	"reasoning" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"model_version" varchar(50) DEFAULT 'v1-stub' NOT NULL,
	"is_mocked" boolean DEFAULT true NOT NULL,
	"is_dismissed" boolean DEFAULT false NOT NULL,
	"is_actioned" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "co_purchase_pattern" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_a_id" uuid NOT NULL,
	"product_b_id" uuid NOT NULL,
	"co_occurrence_count" integer DEFAULT 0 NOT NULL,
	"confidence_score" integer DEFAULT 0 NOT NULL,
	"lift_score" integer DEFAULT 100 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demand_forecast" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"forecast_date" date NOT NULL,
	"horizon_days" integer DEFAULT 30 NOT NULL,
	"predicted_units" integer NOT NULL,
	"confidence_low" integer NOT NULL,
	"confidence_high" integer NOT NULL,
	"days_of_stock_left" integer NOT NULL,
	"suggested_reorder_qty" integer NOT NULL,
	"signals" jsonb DEFAULT '{}'::jsonb,
	"reasoning" text NOT NULL,
	"is_mocked" boolean DEFAULT true NOT NULL,
	"model_version" varchar(50) DEFAULT 'v1-stub' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid,
	"staff_id" uuid,
	"action" "audit_action" NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid,
	"changeset" jsonb DEFAULT '{}'::jsonb,
	"ip_address" varchar(50),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid,
	"recipient_id" uuid,
	"channel" "notification_channel" DEFAULT 'in_app' NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"delivery_status" varchar(50) DEFAULT 'pending',
	"external_ref" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eod_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"business_date" date NOT NULL,
	"status" varchar(30) DEFAULT 'in_progress' NOT NULL,
	"system_cash_total" integer DEFAULT 0 NOT NULL,
	"system_momo_total" integer DEFAULT 0 NOT NULL,
	"system_card_total" integer DEFAULT 0 NOT NULL,
	"system_total" integer DEFAULT 0 NOT NULL,
	"system_sale_count" integer DEFAULT 0 NOT NULL,
	"system_refund_total" integer DEFAULT 0 NOT NULL,
	"system_expense_total" integer DEFAULT 0 NOT NULL,
	"opening_float" integer DEFAULT 0 NOT NULL,
	"physical_cash_count" integer DEFAULT 0 NOT NULL,
	"denominations" jsonb DEFAULT '[]'::jsonb,
	"momo_confirmed" integer DEFAULT 0 NOT NULL,
	"cash_variance" integer DEFAULT 0 NOT NULL,
	"momo_variance" integer DEFAULT 0 NOT NULL,
	"variance_notes" text,
	"closed_by_id" uuid,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eod_store_date_unique" UNIQUE("store_id","business_date")
);
--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_organisation_id_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_staff_id_staff_profile_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_reconciliation" ADD CONSTRAINT "shift_reconciliation_staff_id_staff_profile_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_reconciliation" ADD CONSTRAINT "shift_reconciliation_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_reconciliation" ADD CONSTRAINT "shift_reconciliation_reviewed_by_id_staff_profile_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profile" ADD CONSTRAINT "staff_profile_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_paid_by_id_staff_profile_id_fk" FOREIGN KEY ("paid_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_item" ADD CONSTRAINT "purchase_item_purchase_order_id_purchase_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_raised_by_id_staff_profile_id_fk" FOREIGN KEY ("raised_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_approved_by_id_staff_profile_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_store_suppliers" ADD CONSTRAINT "_store_suppliers_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_store_suppliers" ADD CONSTRAINT "_store_suppliers_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_purchase_order_id_purchase_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_performance" ADD CONSTRAINT "supplier_performance_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_primary_supplier_id_supplier_id_fk" FOREIGN KEY ("primary_supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rx_item" ADD CONSTRAINT "rx_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rx_item" ADD CONSTRAINT "rx_item_dispensed_by_id_staff_profile_id_fk" FOREIGN KEY ("dispensed_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_alert" ADD CONSTRAINT "stock_alert_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_alert" ADD CONSTRAINT "stock_alert_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_alert" ADD CONSTRAINT "stock_alert_batch_id_stock_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."stock_batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_alert" ADD CONSTRAINT "stock_alert_dismissed_by_id_staff_profile_id_fk" FOREIGN KEY ("dismissed_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_batch" ADD CONSTRAINT "stock_batch_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_batch" ADD CONSTRAINT "stock_batch_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_batch" ADD CONSTRAINT "stock_batch_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_batch_id_stock_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."stock_batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_performed_by_id_staff_profile_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_item" ADD CONSTRAINT "stock_transfer_item_transfer_id_stock_transfer_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."stock_transfer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_item" ADD CONSTRAINT "stock_transfer_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_item" ADD CONSTRAINT "stock_transfer_item_batch_id_stock_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."stock_batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_from_store_id_store_id_fk" FOREIGN KEY ("from_store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_to_store_id_store_id_fk" FOREIGN KEY ("to_store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_initiated_by_id_staff_profile_id_fk" FOREIGN KEY ("initiated_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_received_by_id_staff_profile_id_fk" FOREIGN KEY ("received_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transaction" ADD CONSTRAINT "loyalty_transaction_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription" ADD CONSTRAINT "prescription_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription" ADD CONSTRAINT "prescription_verified_by_id_staff_profile_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_item" ADD CONSTRAINT "refund_item_refund_request_id_refund_request_id_fk" FOREIGN KEY ("refund_request_id") REFERENCES "public"."refund_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_item" ADD CONSTRAINT "refund_item_sale_item_id_sale_item_id_fk" FOREIGN KEY ("sale_item_id") REFERENCES "public"."sale_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_item" ADD CONSTRAINT "refund_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_request" ADD CONSTRAINT "refund_request_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_request" ADD CONSTRAINT "refund_request_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_request" ADD CONSTRAINT "refund_request_initiated_by_id_staff_profile_id_fk" FOREIGN KEY ("initiated_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_request" ADD CONSTRAINT "refund_request_authorized_by_id_staff_profile_id_fk" FOREIGN KEY ("authorized_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_batch_id_stock_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."stock_batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_cashier_id_staff_profile_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_discount_authorized_by_id_staff_profile_id_fk" FOREIGN KEY ("discount_authorized_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_actual" ADD CONSTRAINT "budget_actual_budget_id_budget_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budget"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget" ADD CONSTRAINT "budget_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget" ADD CONSTRAINT "budget_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget" ADD CONSTRAINT "budget_created_by_id_staff_profile_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_recorded_by_id_staff_profile_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_approved_by_id_staff_profile_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_performed_by_id_staff_profile_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pl_snapshot" ADD CONSTRAINT "pl_snapshot_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_remittance" ADD CONSTRAINT "tax_remittance_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_remittance" ADD CONSTRAINT "tax_remittance_remitted_by_id_staff_profile_id_fk" FOREIGN KEY ("remitted_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_insight" ADD CONSTRAINT "ai_insight_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "co_purchase_pattern" ADD CONSTRAINT "co_purchase_pattern_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "co_purchase_pattern" ADD CONSTRAINT "co_purchase_pattern_product_a_id_product_id_fk" FOREIGN KEY ("product_a_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "co_purchase_pattern" ADD CONSTRAINT "co_purchase_pattern_product_b_id_product_id_fk" FOREIGN KEY ("product_b_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_forecast" ADD CONSTRAINT "demand_forecast_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_forecast" ADD CONSTRAINT "demand_forecast_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_staff_id_staff_profile_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_recipient_id_staff_profile_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eod_record" ADD CONSTRAINT "eod_record_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eod_record" ADD CONSTRAINT "eod_record_closed_by_id_staff_profile_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shift_staff_idx" ON "shift_reconciliation" USING btree ("staff_id","store_id");--> statement-breakpoint
CREATE INDEX "staff_email_idx" ON "staff_profile" USING btree ("email");--> statement-breakpoint
CREATE INDEX "staff_store_idx" ON "staff_profile" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "po_supplier_idx" ON "purchase" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "po_store_idx" ON "purchase" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "product_sku_idx" ON "product" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "product_barcode_idx" ON "product" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "product_category_idx" ON "product" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "product_type_idx" ON "product" USING btree ("type");--> statement-breakpoint
CREATE INDEX "stock_alert_product_idx" ON "stock_alert" USING btree ("product_id","store_id");--> statement-breakpoint
CREATE INDEX "stock_batch_product_idx" ON "stock_batch" USING btree ("product_id","store_id");--> statement-breakpoint
CREATE INDEX "stock_batch_expiry_idx" ON "stock_batch" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "stock_item_product_store_idx" ON "stock_item" USING btree ("product_id","store_id");--> statement-breakpoint
CREATE INDEX "stock_movement_product_idx" ON "stock_movement" USING btree ("product_id","store_id");--> statement-breakpoint
CREATE INDEX "stock_movement_created_idx" ON "stock_movement" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stock_movement_ref_idx" ON "stock_movement" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "customer_phone_idx" ON "customer" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "customer_email_idx" ON "customer" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customer_store_idx" ON "customer" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "refund_sale_idx" ON "refund_request" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_cashier_idx" ON "sale" USING btree ("cashier_id");--> statement-breakpoint
CREATE INDEX "sale_customer_idx" ON "sale" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "sale_store_created_idx" ON "sale" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "sale_client_id_idx" ON "sale" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "sale_receipt_idx" ON "sale" USING btree ("receipt_number");--> statement-breakpoint
CREATE INDEX "sale_status_idx" ON "sale" USING btree ("status");--> statement-breakpoint
CREATE INDEX "expense_store_date_idx" ON "expense" USING btree ("store_id","expense_date");--> statement-breakpoint
CREATE INDEX "expense_category_idx" ON "expense" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "ledger_store_date_idx" ON "ledger_entry" USING btree ("store_id","entry_date");--> statement-breakpoint
CREATE INDEX "ledger_category_idx" ON "ledger_entry" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ledger_ref_idx" ON "ledger_entry" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "pl_snapshot_store_period_idx" ON "pl_snapshot" USING btree ("store_id","period_type","period_date");--> statement-breakpoint
CREATE INDEX "ai_insight_type_entity_idx" ON "ai_insight" USING btree ("type","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "ai_insight_store_idx" ON "ai_insight" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "co_purchase_store_product_idx" ON "co_purchase_pattern" USING btree ("store_id","product_a_id");--> statement-breakpoint
CREATE INDEX "demand_forecast_product_store_idx" ON "demand_forecast" USING btree ("product_id","store_id","forecast_date");--> statement-breakpoint
CREATE INDEX "audit_staff_idx" ON "audit_log" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notif_recipient_idx" ON "notification_log" USING btree ("recipient_id","is_read");--> statement-breakpoint
CREATE INDEX "notif_store_idx" ON "notification_log" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "eod_store_date_idx" ON "eod_record" USING btree ("store_id","business_date");