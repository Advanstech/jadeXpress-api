ALTER TABLE "staff_profile" ADD COLUMN "failed_pin_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_profile" ADD COLUMN "pin_locked_until" timestamp with time zone;