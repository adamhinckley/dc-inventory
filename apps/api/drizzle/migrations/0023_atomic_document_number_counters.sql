CREATE TABLE IF NOT EXISTS "purchasing"."document_number_counters" (
  "organization_id" text PRIMARY KEY NOT NULL,
  "last_value" integer NOT NULL CHECK ("last_value" > 0)
);
--> statement-breakpoint
INSERT INTO "purchasing"."document_number_counters" ("organization_id", "last_value")
SELECT
  "organization_id",
  MAX((substring("document_number" FROM '^PO-([0-9]+)'))::integer)
FROM "purchasing"."purchase_orders"
WHERE "document_number" ~ '^PO-[0-9]+'
GROUP BY "organization_id"
HAVING MAX((substring("document_number" FROM '^PO-([0-9]+)'))::integer) > 0
ON CONFLICT ("organization_id") DO UPDATE
SET "last_value" = GREATEST(
  "purchasing"."document_number_counters"."last_value",
  EXCLUDED."last_value"
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales"."document_number_counters" (
  "organization_id" text PRIMARY KEY NOT NULL,
  "last_value" integer NOT NULL CHECK ("last_value" > 0)
);
--> statement-breakpoint
INSERT INTO "sales"."document_number_counters" ("organization_id", "last_value")
SELECT
  "organization_id",
  MAX((substring("document_number" FROM '^SO-([0-9]+)'))::integer)
FROM "sales"."orders"
WHERE "document_number" ~ '^SO-[0-9]+'
GROUP BY "organization_id"
HAVING MAX((substring("document_number" FROM '^SO-([0-9]+)'))::integer) > 0
ON CONFLICT ("organization_id") DO UPDATE
SET "last_value" = GREATEST(
  "sales"."document_number_counters"."last_value",
  EXCLUDED."last_value"
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounting"."document_number_counters" (
  "organization_id" text PRIMARY KEY NOT NULL,
  "last_value" integer NOT NULL CHECK ("last_value" > 0)
);
--> statement-breakpoint
INSERT INTO "accounting"."document_number_counters" ("organization_id", "last_value")
SELECT
  "organization_id",
  MAX((substring("document_number" FROM '^INV-([0-9]+)'))::integer)
FROM "accounting"."invoices"
WHERE "document_number" ~ '^INV-[0-9]+'
GROUP BY "organization_id"
HAVING MAX((substring("document_number" FROM '^INV-([0-9]+)'))::integer) > 0
ON CONFLICT ("organization_id") DO UPDATE
SET "last_value" = GREATEST(
  "accounting"."document_number_counters"."last_value",
  EXCLUDED."last_value"
);
