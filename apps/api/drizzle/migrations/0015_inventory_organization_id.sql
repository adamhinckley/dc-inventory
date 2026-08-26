ALTER TABLE "inventory"."locations" ADD COLUMN IF NOT EXISTS "organization_id" text DEFAULT 'DEFAULT' NOT NULL;
--> statement-breakpoint
ALTER TABLE "inventory"."locations" DROP CONSTRAINT IF EXISTS "locations_code_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "locations_organization_id_code_unique" ON "inventory"."locations" ("organization_id", "code");
--> statement-breakpoint
ALTER TABLE "inventory"."reorder_policies" ADD COLUMN IF NOT EXISTS "organization_id" text DEFAULT 'DEFAULT' NOT NULL;
--> statement-breakpoint
ALTER TABLE "inventory"."reorder_policies" DROP CONSTRAINT IF EXISTS "reorder_policies_sku_location_id_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reorder_policies_organization_id_sku_location_id_unique" ON "inventory"."reorder_policies" ("organization_id", "sku", "location_id");
--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ADD COLUMN IF NOT EXISTS "organization_id" text DEFAULT 'DEFAULT' NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "inventory"."stock_movements_idempotency_key_sku";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_movements_organization_id_idempotency_key_sku" ON "inventory"."stock_movements" ("organization_id", "idempotency_key", "sku");
--> statement-breakpoint
DROP INDEX IF EXISTS "inventory"."stock_movements_once_only_provenance";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_movements_organization_id_once_only_provenance" ON "inventory"."stock_movements" ("organization_id", "ref_type", "ref_id", "sku", "movement_type") WHERE "movement_type" in ('InboundFromPo', 'Allocated', 'Deallocated', 'Shipped');
--> statement-breakpoint
ALTER TABLE "inventory"."stock_snapshots" ADD COLUMN IF NOT EXISTS "organization_id" text DEFAULT 'DEFAULT' NOT NULL;
--> statement-breakpoint
ALTER TABLE "inventory"."stock_snapshots" DROP CONSTRAINT IF EXISTS "stock_snapshots_sku_location_id_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_snapshots_organization_id_sku_location_id_unique" ON "inventory"."stock_snapshots" ("organization_id", "sku", "location_id");
