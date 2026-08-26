ALTER TABLE "sales"."orders" ADD COLUMN IF NOT EXISTS "organization_id" text DEFAULT 'DEFAULT' NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "orders_document_number_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_organization_id_document_number_unique" ON "sales"."orders" ("organization_id", "document_number");
