ALTER TABLE "identity"."wholesale_users" ADD COLUMN IF NOT EXISTS "organization_id" text DEFAULT 'DEFAULT' NOT NULL;
--> statement-breakpoint
ALTER TABLE "identity"."wholesale_users" DROP CONSTRAINT IF EXISTS "wholesale_users_email_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wholesale_users_organization_id_email_unique" ON "identity"."wholesale_users" ("organization_id", "email");
--> statement-breakpoint
ALTER TABLE "identity"."ops_users" DROP CONSTRAINT IF EXISTS "ops_users_email_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ops_users_tenant_id_email_unique" ON "identity"."ops_users" ("tenant_id", "email");
--> statement-breakpoint
ALTER TABLE "identity"."sessions" ADD COLUMN IF NOT EXISTS "organization_id" text DEFAULT 'DEFAULT' NOT NULL;
