ALTER TYPE "inventory"."movement_type" ADD VALUE IF NOT EXISTS 'Committed';--> statement-breakpoint
ALTER TYPE "inventory"."movement_type" ADD VALUE IF NOT EXISTS 'Decommitted';--> statement-breakpoint
ALTER TABLE "inventory"."stock_snapshots" ADD COLUMN IF NOT EXISTS "committed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory"."stock_snapshots" ADD COLUMN IF NOT EXISTS "sticky_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory"."stock_snapshots" ADD COLUMN IF NOT EXISTS "window_opens_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inventory"."stock_snapshots" ADD COLUMN IF NOT EXISTS "window_closes_at" timestamp with time zone;--> statement-breakpoint
DROP INDEX IF EXISTS "inventory"."stock_movements_organization_id_once_only_provenance";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_movements_organization_id_once_only_provenance" ON "inventory"."stock_movements" ("organization_id","ref_type","ref_id","sku","movement_type") WHERE "inventory"."stock_movements"."movement_type" in ('InboundFromPo', 'InboundCancelled', 'Deallocated', 'Shipped');
