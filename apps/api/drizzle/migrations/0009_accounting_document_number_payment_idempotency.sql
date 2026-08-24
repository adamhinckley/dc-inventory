ALTER TABLE "accounting"."invoices" ADD COLUMN "document_number" text;--> statement-breakpoint
UPDATE "accounting"."invoices" SET "document_number" = 'INV-LEGACY-' || "id"::text WHERE "document_number" IS NULL;--> statement-breakpoint
ALTER TABLE "accounting"."invoices" ALTER COLUMN "document_number" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_document_number_unique" ON "accounting"."invoices" USING btree ("document_number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_order_id_unique" ON "accounting"."invoices" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "accounting"."payments" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
UPDATE "accounting"."payments" SET "idempotency_key" = 'legacy-' || "id"::text WHERE "idempotency_key" IS NULL;--> statement-breakpoint
ALTER TABLE "accounting"."payments" ALTER COLUMN "idempotency_key" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_idempotency_key_unique" ON "accounting"."payments" USING btree ("idempotency_key");
