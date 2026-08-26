CREATE TABLE IF NOT EXISTS "identity"."organizations" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "identity"."staff_users" ADD COLUMN IF NOT EXISTS "organization_id" text DEFAULT 'DEFAULT' NOT NULL;
--> statement-breakpoint
ALTER TABLE "identity"."staff_users" DROP CONSTRAINT IF EXISTS "staff_users_email_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "staff_users_organization_id_email_unique" ON "identity"."staff_users" ("organization_id", "email");
