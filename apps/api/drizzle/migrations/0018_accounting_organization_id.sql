ALTER TABLE "accounting"."invoices" ADD COLUMN IF NOT EXISTS "organization_id" text DEFAULT 'DEFAULT' NOT NULL;
--> statement-breakpoint
ALTER TABLE "accounting"."payments" ADD COLUMN IF NOT EXISTS "organization_id" text DEFAULT 'DEFAULT' NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "invoices_document_number_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_organization_id_document_number_unique" ON "accounting"."invoices" ("organization_id", "document_number");
--> statement-breakpoint
DROP INDEX IF EXISTS "payments_idempotency_key_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_organization_id_idempotency_key_unique" ON "accounting"."payments" ("organization_id", "idempotency_key");
