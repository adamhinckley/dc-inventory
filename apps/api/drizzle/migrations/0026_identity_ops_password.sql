ALTER TABLE "identity"."ops_users" ADD COLUMN IF NOT EXISTS "password_hash" text;
