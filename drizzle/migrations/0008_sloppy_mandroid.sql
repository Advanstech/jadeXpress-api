ALTER TABLE "eod_record" ADD COLUMN "initiated_by_id" uuid;--> statement-breakpoint
ALTER TABLE "eod_record" ADD COLUMN "approved_by_id" uuid;--> statement-breakpoint
ALTER TABLE "eod_record" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "eod_record" ADD CONSTRAINT "eod_record_initiated_by_id_staff_profile_id_fk" FOREIGN KEY ("initiated_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eod_record" ADD CONSTRAINT "eod_record_approved_by_id_staff_profile_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."staff_profile"("id") ON DELETE no action ON UPDATE no action;