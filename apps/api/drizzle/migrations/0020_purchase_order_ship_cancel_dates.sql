ALTER TABLE "purchasing"."purchase_orders" ADD COLUMN IF NOT EXISTS "ship_date" date;
--> statement-breakpoint
ALTER TABLE "purchasing"."purchase_orders" ADD COLUMN IF NOT EXISTS "cancel_date" date;
