ALTER TABLE "customers"."customers" ADD COLUMN IF NOT EXISTS "customer_number" text;--> statement-breakpoint
WITH "numbered" AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "organization_id" ORDER BY "created_at", "id") AS "seq"
  FROM "customers"."customers"
)
UPDATE "customers"."customers" AS "c"
SET "customer_number" = 'CUST-' || lpad("n"."seq"::text, 5, '0')
FROM "numbered" AS "n"
WHERE "c"."id" = "n"."id" AND "c"."customer_number" IS NULL;--> statement-breakpoint
ALTER TABLE "customers"."customers" ALTER COLUMN "customer_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "customers"."customers" ADD COLUMN IF NOT EXISTS "tax_id" text;--> statement-breakpoint
ALTER TABLE "customers"."customers" ADD COLUMN IF NOT EXISTS "account_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers"."customers" ADD COLUMN IF NOT EXISTS "customer_note" text;--> statement-breakpoint
ALTER TABLE "customers"."customers" ADD COLUMN IF NOT EXISTS "staff_note" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customers_organization_id_customer_number_unique" ON "customers"."customers" USING btree ("organization_id", "customer_number");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers"."bill_tos" (
  "customer_id" uuid PRIMARY KEY NOT NULL,
  "line_1" text NOT NULL,
  "line_2" text,
  "city" text NOT NULL,
  "region" text NOT NULL,
  "postal" text NOT NULL,
  "country" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "customers"."bill_tos" ADD CONSTRAINT "bill_tos_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers"."document_number_counters" (
  "organization_id" text PRIMARY KEY NOT NULL,
  "last_value" integer NOT NULL CHECK ("last_value" > 0)
);--> statement-breakpoint
INSERT INTO "customers"."document_number_counters" ("organization_id", "last_value")
SELECT
  "organization_id",
  MAX((substring("customer_number" FROM '^CUST-([0-9]+)'))::integer)
FROM "customers"."customers"
WHERE "customer_number" ~ '^CUST-[0-9]+'
GROUP BY "organization_id"
HAVING MAX((substring("customer_number" FROM '^CUST-([0-9]+)'))::integer) > 0
ON CONFLICT ("organization_id") DO UPDATE
SET "last_value" = GREATEST(
  "customers"."document_number_counters"."last_value",
  EXCLUDED."last_value"
);
