CREATE TYPE "purchasing"."po_status" AS ENUM('draft', 'confirmed', 'received', 'cancelled');--> statement-breakpoint
ALTER TABLE "purchasing"."purchase_orders" ADD COLUMN "status" "purchasing"."po_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchasing"."purchase_orders" ADD COLUMN "document_number" text;--> statement-breakpoint
UPDATE "purchasing"."purchase_orders" SET "document_number" = 'PO-LEGACY-' || "id"::text WHERE "document_number" IS NULL;--> statement-breakpoint
ALTER TABLE "purchasing"."purchase_orders" ALTER COLUMN "document_number" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_document_number_unique" ON "purchasing"."purchase_orders" USING btree ("document_number");--> statement-breakpoint
ALTER TABLE "purchasing"."purchase_order_lines" ADD COLUMN "received_qty" integer DEFAULT 0 NOT NULL;
