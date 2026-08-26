ALTER TABLE "catalog"."products" ADD COLUMN IF NOT EXISTS "organization_id" text DEFAULT 'DEFAULT' NOT NULL;
--> statement-breakpoint
ALTER TABLE "catalog"."products" DROP CONSTRAINT IF EXISTS "products_sku_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_organization_id_sku_unique" ON "catalog"."products" ("organization_id", "sku");
--> statement-breakpoint
ALTER TABLE "catalog"."categories" ADD COLUMN IF NOT EXISTS "organization_id" text DEFAULT 'DEFAULT' NOT NULL;
--> statement-breakpoint
ALTER TABLE "catalog"."categories" DROP CONSTRAINT IF EXISTS "categories_name_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "categories_organization_id_name_unique" ON "catalog"."categories" ("organization_id", "name");
