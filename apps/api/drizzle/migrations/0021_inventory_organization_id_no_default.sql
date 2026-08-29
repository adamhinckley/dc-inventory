ALTER TABLE "inventory"."locations" ALTER COLUMN "organization_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "inventory"."reorder_policies" ALTER COLUMN "organization_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ALTER COLUMN "organization_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "inventory"."stock_snapshots" ALTER COLUMN "organization_id" DROP DEFAULT;
