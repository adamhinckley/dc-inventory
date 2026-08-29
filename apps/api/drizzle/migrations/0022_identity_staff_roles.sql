DO $$ BEGIN
 CREATE TYPE "identity"."staff_role" AS ENUM('admin', 'purchasing', 'warehouse', 'sales_support');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "identity"."staff_users"
  ADD COLUMN IF NOT EXISTS "roles" "identity"."staff_role"[] DEFAULT ARRAY['admin']::"identity"."staff_role"[] NOT NULL;
