-- Phase 2 inventory ledger identity (ADA-108): idempotency + provenance constraints.

ALTER TABLE "inventory"."stock_movements" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
UPDATE "inventory"."stock_movements" SET "idempotency_key" = "id"::text WHERE "idempotency_key" IS NULL;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ALTER COLUMN "idempotency_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory"."stock_movements" ADD CONSTRAINT "stock_movements_qty_positive" CHECK ("qty" > 0);--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_idempotency_key_sku" ON "inventory"."stock_movements" USING btree ("idempotency_key","sku");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_once_only_provenance" ON "inventory"."stock_movements" USING btree ("ref_type","ref_id","sku","movement_type") WHERE "movement_type" in ('InboundFromPo', 'Allocated', 'Deallocated', 'Shipped');
