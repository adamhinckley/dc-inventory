ALTER TABLE "purchasing"."suppliers" ADD COLUMN IF NOT EXISTS "po_prefix" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_organization_id_po_prefix_unique"
ON "purchasing"."suppliers" ("organization_id", "po_prefix")
WHERE "po_prefix" IS NOT NULL;
