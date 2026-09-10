CREATE INDEX IF NOT EXISTS "purchase_orders_organization_id_status_idx"
  ON "purchasing"."purchase_orders" ("organization_id", "status");
