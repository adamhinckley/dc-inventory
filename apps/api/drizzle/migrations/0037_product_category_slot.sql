ALTER TABLE "catalog"."product_categories" ADD COLUMN IF NOT EXISTS "slot" smallint DEFAULT 1 NOT NULL;
