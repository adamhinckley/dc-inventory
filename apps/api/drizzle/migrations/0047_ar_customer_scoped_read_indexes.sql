CREATE INDEX IF NOT EXISTS "invoices_organization_id_customer_id_idx"
  ON "accounting"."invoices" ("organization_id", "customer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_organization_id_customer_id_idx"
  ON "accounting"."payments" ("organization_id", "customer_id");
