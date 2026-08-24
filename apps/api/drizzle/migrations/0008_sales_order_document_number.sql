ALTER TABLE "sales"."orders" ADD COLUMN "document_number" text;--> statement-breakpoint
UPDATE "sales"."orders" SET "document_number" = 'SO-LEGACY-' || "id"::text WHERE "document_number" IS NULL;--> statement-breakpoint
ALTER TABLE "sales"."orders" ALTER COLUMN "document_number" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_document_number_unique" ON "sales"."orders" USING btree ("document_number");
