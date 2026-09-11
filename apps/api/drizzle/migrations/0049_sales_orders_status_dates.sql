ALTER TABLE "sales"."orders" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "sales"."orders" ADD COLUMN IF NOT EXISTS "shipped_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "sales"."orders" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamptz;
