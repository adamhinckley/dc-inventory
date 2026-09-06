WITH "ranked_defaults" AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "customer_id"
      ORDER BY "created_at", "id"
    ) AS "row_number"
  FROM "customers"."ship_tos"
  WHERE "is_default" = true
)
UPDATE "customers"."ship_tos" AS "ship_to"
SET "is_default" = false
FROM "ranked_defaults"
WHERE "ship_to"."id" = "ranked_defaults"."id"
  AND "ranked_defaults"."row_number" > 1;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ship_tos_customer_id_default_unique"
ON "customers"."ship_tos" ("customer_id")
WHERE "is_default" = true;
