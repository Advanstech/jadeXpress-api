CREATE TABLE "payroll_cycle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"period_month" integer NOT NULL,
	"period_year" integer NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"total_basic_pesewas" integer DEFAULT 0 NOT NULL,
	"total_deductions_pesewas" integer DEFAULT 0 NOT NULL,
	"total_net_pesewas" integer DEFAULT 0 NOT NULL,
	"processed_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payslip" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payroll_cycle_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"basic_salary_pesewas" integer NOT NULL,
	"bonuses_pesewas" integer DEFAULT 0 NOT NULL,
	"ssnit_tier1_pesewas" integer DEFAULT 0 NOT NULL,
	"paye_tax_pesewas" integer DEFAULT 0 NOT NULL,
	"other_deductions_pesewas" integer DEFAULT 0 NOT NULL,
	"net_pay_pesewas" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"payment_date" timestamp with time zone,
	"payment_method" varchar(50),
	"payment_reference" varchar(100),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_invoice_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" varchar(255) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_pesewas" integer NOT NULL,
	"discount_amount_pesewas" integer DEFAULT 0 NOT NULL,
	"line_total_pesewas" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"created_by_id" uuid,
	"invoice_number" varchar(60) NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"subtotal_pesewas" integer DEFAULT 0 NOT NULL,
	"vat_amount_pesewas" integer DEFAULT 0 NOT NULL,
	"nhil_amount_pesewas" integer DEFAULT 0 NOT NULL,
	"getfund_amount_pesewas" integer DEFAULT 0 NOT NULL,
	"discount_amount_pesewas" integer DEFAULT 0 NOT NULL,
	"total_pesewas" integer DEFAULT 0 NOT NULL,
	"amount_paid_pesewas" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"terms" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_invoice_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
ALTER TABLE "payroll_cycle" ADD CONSTRAINT "payroll_cycle_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_cycle" ADD CONSTRAINT "payroll_cycle_processed_by_id_staff_profile_id_fk" FOREIGN KEY ("processed_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslip" ADD CONSTRAINT "payslip_payroll_cycle_id_payroll_cycle_id_fk" FOREIGN KEY ("payroll_cycle_id") REFERENCES "public"."payroll_cycle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslip" ADD CONSTRAINT "payslip_staff_id_staff_profile_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslip" ADD CONSTRAINT "payslip_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoice_item" ADD CONSTRAINT "customer_invoice_item_invoice_id_customer_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."customer_invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoice" ADD CONSTRAINT "customer_invoice_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoice" ADD CONSTRAINT "customer_invoice_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoice" ADD CONSTRAINT "customer_invoice_created_by_id_staff_profile_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payroll_cycle_store_idx" ON "payroll_cycle" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "payslip_staff_idx" ON "payslip" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "payslip_cycle_idx" ON "payslip" USING btree ("payroll_cycle_id");--> statement-breakpoint
CREATE INDEX "invoice_store_idx" ON "customer_invoice" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "invoice_customer_idx" ON "customer_invoice" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "invoice_status_idx" ON "customer_invoice" USING btree ("status");