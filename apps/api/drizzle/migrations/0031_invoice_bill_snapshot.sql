ALTER TABLE "accounting"."invoices" ADD COLUMN IF NOT EXISTS "bill_line_1" text;--> statement-breakpoint
ALTER TABLE "accounting"."invoices" ADD COLUMN IF NOT EXISTS "bill_line_2" text;--> statement-breakpoint
ALTER TABLE "accounting"."invoices" ADD COLUMN IF NOT EXISTS "bill_city" text;--> statement-breakpoint
ALTER TABLE "accounting"."invoices" ADD COLUMN IF NOT EXISTS "bill_region" text;--> statement-breakpoint
ALTER TABLE "accounting"."invoices" ADD COLUMN IF NOT EXISTS "bill_postal" text;--> statement-breakpoint
ALTER TABLE "accounting"."invoices" ADD COLUMN IF NOT EXISTS "bill_country" text;--> statement-breakpoint
ALTER TABLE "accounting"."invoices" ADD COLUMN IF NOT EXISTS "due_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounting"."invoices" ADD COLUMN IF NOT EXISTS "terms" text;
