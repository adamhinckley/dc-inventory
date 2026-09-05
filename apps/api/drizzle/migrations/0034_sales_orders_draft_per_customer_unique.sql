CREATE UNIQUE INDEX IF NOT EXISTS "orders_organization_id_customer_id_draft_unique"
ON "sales"."orders" ("organization_id", "customer_id")
WHERE "status" = 'draft';
