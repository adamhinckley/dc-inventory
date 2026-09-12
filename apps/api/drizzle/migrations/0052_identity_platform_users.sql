ALTER TYPE "identity"."actor_type" ADD VALUE IF NOT EXISTS 'platform';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity"."platform_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_users_email_unique" ON "identity"."platform_users" USING btree ("email");--> statement-breakpoint
ALTER TABLE "identity"."sessions" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "identity"."sessions" ALTER COLUMN "organization_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "identity"."sessions" ADD COLUMN IF NOT EXISTS "platform_user_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."sessions" ADD CONSTRAINT "sessions_platform_user_id_platform_users_id_fk" FOREIGN KEY ("platform_user_id") REFERENCES "identity"."platform_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION identity.enforce_staff_platform_email_disjoint()
RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'platform_users' THEN
    IF EXISTS (SELECT 1 FROM identity.staff_users WHERE email = NEW.email) THEN
      RAISE EXCEPTION 'email already used by staff user';
    END IF;
  ELSIF TG_TABLE_NAME = 'staff_users' THEN
    IF EXISTS (SELECT 1 FROM identity.platform_users WHERE email = NEW.email) THEN
      RAISE EXCEPTION 'email already used by platform user';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS platform_users_staff_platform_email_disjoint ON identity.platform_users;--> statement-breakpoint
CREATE TRIGGER platform_users_staff_platform_email_disjoint
BEFORE INSERT OR UPDATE OF email ON identity.platform_users
FOR EACH ROW EXECUTE FUNCTION identity.enforce_staff_platform_email_disjoint();--> statement-breakpoint
DROP TRIGGER IF EXISTS staff_users_staff_platform_email_disjoint ON identity.staff_users;--> statement-breakpoint
CREATE TRIGGER staff_users_staff_platform_email_disjoint
BEFORE INSERT OR UPDATE OF email ON identity.staff_users
FOR EACH ROW EXECUTE FUNCTION identity.enforce_staff_platform_email_disjoint();
