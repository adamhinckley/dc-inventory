ALTER TABLE "customers"."customers" ADD COLUMN IF NOT EXISTS "organization_id" text DEFAULT 'DEFAULT' NOT NULL;
