ALTER TABLE "purchasing"."suppliers" ADD COLUMN IF NOT EXISTS "organization_id" text DEFAULT 'DEFAULT' NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchasing"."suppliers" DROP CONSTRAINT IF EXISTS "suppliers_vendor_number_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_organization_id_vendor_number_unique" ON "purchasing"."suppliers" ("organization_id", "vendor_number");
--> statement-breakpoint
ALTER TABLE "purchasing"."purchase_orders" ADD COLUMN IF NOT EXISTS "organization_id" text DEFAULT 'DEFAULT' NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "purchase_orders_document_number_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_organization_id_document_number_unique" ON "purchasing"."purchase_orders" ("organization_id", "document_number");
