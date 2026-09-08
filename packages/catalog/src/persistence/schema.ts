import {
  bigint,
  boolean,
  char,
  integer,
  pgSchema,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Catalog persistence models. Shop unit price is LP (`list_price_cents`).
 * `member_price_cents` is master pack price from dump `mp_price` (case/carton).
 * Wholesale visibility is `web_wholesale` only.
 */
export const catalog = pgSchema("catalog");

export const identifierKind = catalog.enum("identifier_kind", [
  "upc",
  "mfg",
  "alt",
]);

function timestamps() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  };
}

export const products = catalog.table(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("DEFAULT"),
    sku: text("sku").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  uom: text("uom").notNull(),
  countryOfOrigin: text("country_of_origin"),
  material: text("material"),
  length: text("length"),
  width: text("width"),
  height: text("height"),
  diameter: text("diameter"),
  size: text("size"),
  weight: text("weight"),
  weightUom: text("weight_uom"),
  memberPriceCents: bigint("member_price_cents", { mode: "number" }).notNull(),
  listPriceCents: bigint("list_price_cents", { mode: "number" }),
  originalWholesalePriceCents: bigint("original_wholesale_price_cents", { mode: "number" }),
  currency: char("currency", { length: 3 }).notNull().default("USD"),
  catalogPage: text("catalog_page"),
  defaultOrderQty: integer("default_order_qty"),
  defaultWeight: text("default_weight"),
  defaultWeightUom: text("default_weight_uom"),
  inactive: boolean("inactive").notNull().default(false),
  discontinued: boolean("discontinued").notNull().default(false),
  nonStock: boolean("non_stock").notNull().default(false),
  noExport: boolean("no_export").notNull().default(false),
  webWholesale: boolean("web_wholesale").notNull().default(false),
  webRetail: boolean("web_retail").notNull().default(false),
  taxCategoryCode: text("tax_category_code"),
  ...timestamps(),
  },
  (table) => [unique().on(table.organizationId, table.sku)],
);

export const productIdentifiers = catalog.table(
  "product_identifiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    kind: identifierKind("kind").notNull(),
    code: text("code").notNull(),
    ...timestamps(),
  },
  (table) => [unique().on(table.productId, table.kind, table.code)],
);

export const productPackaging = catalog.table("product_packaging", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .unique()
    .references(() => products.id),
  packLength: text("pack_length"),
  packWidth: text("pack_width"),
  packHeight: text("pack_height"),
  packWeight: text("pack_weight"),
  packWeightUom: text("pack_weight_uom"),
  innerPackQty: integer("inner_pack_qty"),
  innerPackLength: text("inner_pack_length"),
  innerPackWidth: text("inner_pack_width"),
  innerPackHeight: text("inner_pack_height"),
  innerPackWeight: text("inner_pack_weight"),
  innerPackWeightUom: text("inner_pack_weight_uom"),
  caseQty: integer("case_qty"),
  caseLength: text("case_length"),
  caseWidth: text("case_width"),
  caseHeight: text("case_height"),
  caseWeight: text("case_weight"),
  caseWeightUom: text("case_weight_uom"),
  ...timestamps(),
});

export const categories = catalog.table(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("DEFAULT"),
    name: text("name").notNull(),
    ...timestamps(),
  },
  (table) => [unique().on(table.organizationId, table.name)],
);

export const productCategories = catalog.table(
  "product_categories",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    ...timestamps(),
  },
  (table) => [unique().on(table.productId, table.categoryId)],
);

export const productImages = catalog.table("product_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type"),
  ...timestamps(),
});
