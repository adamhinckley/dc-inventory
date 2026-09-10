CREATE INDEX IF NOT EXISTS "stock_movements_organization_id_sku_location_id_idx"
  ON "inventory"."stock_movements" ("organization_id", "sku", "location_id");
