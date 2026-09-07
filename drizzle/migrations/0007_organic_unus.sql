ALTER TYPE "public"."user_role" ADD VALUE 'super_admin' BEFORE 'owner';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'root' BEFORE 'owner';--> statement-breakpoint
CREATE TABLE "contact_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(50),
	"subject" varchar(255) DEFAULT 'General Inquiry',
	"message" text NOT NULL,
	"status" varchar(30) DEFAULT 'unread' NOT NULL,
	"admin_notes" text,
	"admin_reply" text,
	"replied_at" timestamp with time zone,
	"customer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_profile" ADD COLUMN "ssnit_number" varchar(50);--> statement-breakpoint
ALTER TABLE "staff_profile" ADD COLUMN "tin_number" varchar(50);--> statement-breakpoint
ALTER TABLE "staff_profile" ADD COLUMN "bank_name" varchar(100);--> statement-breakpoint
ALTER TABLE "staff_profile" ADD COLUMN "bank_account_name" varchar(150);--> statement-breakpoint
ALTER TABLE "staff_profile" ADD COLUMN "bank_account_number" varchar(50);--> statement-breakpoint
ALTER TABLE "staff_profile" ADD COLUMN "bank_branch" varchar(100);--> statement-breakpoint
ALTER TABLE "staff_profile" ADD COLUMN "mobile_money_provider" varchar(50);--> statement-breakpoint
ALTER TABLE "staff_profile" ADD COLUMN "mobile_money_number" varchar(30);--> statement-breakpoint
ALTER TABLE "staff_profile" ADD COLUMN "basic_salary_pesewas" integer;--> statement-breakpoint
ALTER TABLE "staff_profile" ADD COLUMN "employment_type" varchar(20);--> statement-breakpoint
ALTER TABLE "staff_profile" ADD COLUMN "employment_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "staff_profile" ADD COLUMN "next_of_kin_name" varchar(150);--> statement-breakpoint
ALTER TABLE "staff_profile" ADD COLUMN "next_of_kin_phone" varchar(30);--> statement-breakpoint
ALTER TABLE "staff_profile" ADD COLUMN "next_of_kin_relationship" varchar(50);--> statement-breakpoint
ALTER TABLE "staff_profile" ADD COLUMN "payroll_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase" ADD COLUMN "paid_amount_pesewas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase" ADD COLUMN "balance_pesewas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase" ADD COLUMN "payment_status" "payment_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_message" ADD CONSTRAINT "contact_message_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_msg_status_idx" ON "contact_message" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contact_msg_created_idx" ON "contact_message" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "contact_msg_email_idx" ON "contact_message" USING btree ("email");