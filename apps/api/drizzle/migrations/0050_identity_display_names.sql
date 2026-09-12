ALTER TABLE "identity"."organizations" ADD COLUMN IF NOT EXISTS "name" text;
--> statement-breakpoint
UPDATE "identity"."organizations"
SET "name" = initcap(replace("slug", '-', ' '))
WHERE "name" IS NULL OR btrim("name") = '';
--> statement-breakpoint
ALTER TABLE "identity"."organizations" ALTER COLUMN "name" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "identity"."staff_users" ADD COLUMN IF NOT EXISTS "display_name" text;
--> statement-breakpoint
UPDATE "identity"."staff_users"
SET "display_name" = 'Staff User'
WHERE "display_name" IS NULL OR btrim("display_name") = '';
--> statement-breakpoint
ALTER TABLE "identity"."staff_users" ALTER COLUMN "display_name" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "identity"."wholesale_users" ADD COLUMN IF NOT EXISTS "display_name" text;
--> statement-breakpoint
UPDATE "identity"."wholesale_users"
SET "display_name" = 'Wholesale User'
WHERE "display_name" IS NULL OR btrim("display_name") = '';
--> statement-breakpoint
ALTER TABLE "identity"."wholesale_users" ALTER COLUMN "display_name" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "identity"."ops_users" ADD COLUMN IF NOT EXISTS "display_name" text;
--> statement-breakpoint
UPDATE "identity"."ops_users"
SET "display_name" = 'Ops User'
WHERE "display_name" IS NULL OR btrim("display_name") = '';
--> statement-breakpoint
ALTER TABLE "identity"."ops_users" ALTER COLUMN "display_name" SET NOT NULL;
