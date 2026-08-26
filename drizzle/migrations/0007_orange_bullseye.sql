CREATE TYPE "public"."storefront_order_status" AS ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."storefront_payment_status" AS ENUM('unpaid', 'paid', 'demo');--> statement-breakpoint
CREATE TABLE "customer_address" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"label" varchar(50) DEFAULT 'Home' NOT NULL,
	"recipient_name" varchar(150) NOT NULL,
	"phone" varchar(30) NOT NULL,
	"country" varchar(100) DEFAULT 'Ghana' NOT NULL,
	"region" varchar(100) NOT NULL,
	"city" varchar(100) NOT NULL,
	"street" text NOT NULL,
	"digital_address" varchar(30),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_refresh_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"device_info" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_refresh_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "storefront_order_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"name" varchar(255) NOT NULL,
	"price_pesewas" integer NOT NULL,
	"quantity" integer NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storefront_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(40) NOT NULL,
	"customer_id" uuid,
	"store_id" uuid,
	"email" varchar(255) NOT NULL,
	"status" "storefront_order_status" DEFAULT 'pending' NOT NULL,
	"payment_status" "storefront_payment_status" DEFAULT 'unpaid' NOT NULL,
	"payment_reference" varchar(150),
	"payment_gateway" varchar(30),
	"payment_method" varchar(30),
	"subtotal_pesewas" integer DEFAULT 0 NOT NULL,
	"shipping_fee_pesewas" integer DEFAULT 0 NOT NULL,
	"total_pesewas" integer DEFAULT 0 NOT NULL,
	"currency" varchar(10) DEFAULT 'GHS' NOT NULL,
	"shipping_address" jsonb NOT NULL,
	"timeline" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storefront_order_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "tagline" varchar(255);--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "slug" varchar(255);--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "brand" varchar(150);--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "short_description" varchar(500);--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "images" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "is_bestseller" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "rating" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "review_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "ingredients" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "usage_instructions" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "benefits" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "compare_at_price_pesewas" integer;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "password_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "customer_address" ADD CONSTRAINT "customer_address_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_refresh_token" ADD CONSTRAINT "customer_refresh_token_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storefront_order_item" ADD CONSTRAINT "storefront_order_item_order_id_storefront_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."storefront_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storefront_order_item" ADD CONSTRAINT "storefront_order_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storefront_order" ADD CONSTRAINT "storefront_order_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storefront_order" ADD CONSTRAINT "storefront_order_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_address_customer_idx" ON "customer_address" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "storefront_order_customer_idx" ON "storefront_order" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "storefront_order_number_idx" ON "storefront_order" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "storefront_order_email_idx" ON "storefront_order" USING btree ("email");--> statement-breakpoint
CREATE INDEX "product_slug_idx" ON "product" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_slug_unique" UNIQUE("slug");