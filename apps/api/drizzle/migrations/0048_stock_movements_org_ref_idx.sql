CREATE INDEX IF NOT EXISTS "stock_movements_organization_id_ref_type_ref_id_idx"
  ON "inventory"."stock_movements" ("organization_id", "ref_type", "ref_id");
