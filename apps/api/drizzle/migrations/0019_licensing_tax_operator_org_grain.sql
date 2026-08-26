ALTER TABLE "tax"."tax_commits" ADD COLUMN IF NOT EXISTS "organization_id" text DEFAULT 'DEFAULT' NOT NULL;
--> statement-breakpoint
ALTER TABLE "licensing"."software_payments" DROP CONSTRAINT IF EXISTS "software_payments_provider_ref_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "software_payments_tenant_id_provider_ref_unique" ON "licensing"."software_payments" ("tenant_id", "provider_ref");
--> statement-breakpoint
ALTER TABLE "operator_bridge"."operator_outbox" DROP CONSTRAINT IF EXISTS "operator_outbox_idempotency_key_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "operator_outbox_tenant_id_idempotency_key_unique" ON "operator_bridge"."operator_outbox" ("tenant_id", "idempotency_key");
